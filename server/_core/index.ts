import crypto from "node:crypto";
// Polyfill for crypto.hash (required for Vite 7 on Node.js < 21.7)
if (!(crypto as any).hash) {
  (crypto as any).hash = (algorithm: string, data: any) => crypto.createHash(algorithm).update(data).digest("hex");
}
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import compression from "compression";

import { registerChatRoutes } from "./chat";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleShortLinkRedirect } from "../redirectHandler";
import { ENV } from "./env";
import * as db from "../db";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { logger } from "./logger";
import { hashPassword } from "./auth";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// 确保默认管理员账户存在
async function ensureDefaultAdmin() {
  const username = ENV.defaultAdminUsername;
  const password = ENV.defaultAdminPassword;

  const existing = await db.getUserByUsername(username);
  if (existing) return;

  logger.info(`[Init] Creating default admin account: ${username}`);

  // 确保默认管理员账户存在

  const passwordHash = await hashPassword(password);
  await db.upsertUser({
    openId: `admin-${randomBytes(8).toString("hex")}`,
    username,
    passwordHash,
    name: "Administrator",
    role: "admin",
    subscriptionTier: "ENTERPRISE",
    lastSignedIn: new Date(),
  });

  logger.info(`[Init] Default admin created successfully (${username}/${password})`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // 初始化默认管理员账户
  try {
    await ensureDefaultAdmin();
  } catch (error) {
    logger.warn("[Init] Failed to create default admin:", error);
  }

  // --- FORCE DISABLE CACHE IN DEV ---
  if (process.env.NODE_ENV === "development") {
    app.use((_req, res, next) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      next();
    });
  }

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Enable Gzip/Deflate compression for all responses
  app.use(compression());

  // Chat API with streaming and tool calling
  registerChatRoutes(app);
  
  // 引入放刷风控组件
  const { redirectRateLimiter, strictAuthRateLimiter } = await import("./rateLimiter");
  
  // 引入 REST API 路由 (OpenAPI)
  const restRouter = (await import("../restRouter")).default;
  app.use("/api/v1", restRouter);

  // 1. 保护公开的短链跳转解析引擎 (防大量爬虫或扫描器探底)
  app.get("/s/:shortCode", redirectRateLimiter, async (req, res) => {
    await handleShortLinkRedirect(req, res, req.params.shortCode);
  });

  // 2. 自定义域名短链路由 (Host 不是默认域名时，直接匹配短码)
  app.get("/:shortCode", redirectRateLimiter, async (req, res, next) => {
    const host = req.get('host') || '';
    const defaultHost = process.env.VITE_APP_ID?.replace(/^https?:\/\//, '') || 'localhost';

    // 如果是默认域名，跳过（交给前端路由处理）
    if (host === defaultHost || host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.includes(':3000')) {
      return next();
    }

    // 自定义域名：提取域名部分（去掉端口）
    const customDomain = host.split(':')[0];
    const shortCode = req.params.shortCode;

    // 排除静态资源和 API 路由
    if (shortCode.startsWith('api') || shortCode.startsWith('assets') || shortCode.includes('.')) {
      return next();
    }

    // 查询该域名下的短链
    const { getLinkByDomainAndCode } = await import("../db");
    const link = await getLinkByDomainAndCode(customDomain, shortCode);

    if (link) {
      logger.info(`[自定义域名] ${customDomain}/${shortCode} -> ${link.originalUrl}`);
      await handleShortLinkRedirect(req, res, shortCode);
    } else {
      // 不是短链，交给前端路由
      next();
    }
  });

  // 2. 保护高危鉴权接口 (防止暴力破解和撞库)
  app.use("/api/trpc", (req, res, next) => {
    const isHighRiskEndpoint = 
      req.path.includes("auth.login") || 
      req.path.includes("auth.register") || 
      req.path.includes("links.verifyPassword");

    if (isHighRiskEndpoint) {
      strictAuthRateLimiter(req, res, next);
    } else {
      next();
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ path, error, type }) => {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          logger.error(`[tRPC 致命异常] ${type} on ${path}: ${error.message}`, error);
        } else {
          // 常规业务报错如 UNAUTHORIZED, CONFLICT 等作为 warn 即可
          logger.warn(`[tRPC 拦截] ${type} on ${path}: ${error.message}`);
        }
      }
    })
  );
  // development mode uses Vite
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.warn(`端口 ${preferredPort} 被占用，改用端口 ${port} 启动`);
  }

  server.listen(port, () => {
    logger.info(`🚀 SaaS 系统启动成功，运行在 http://localhost:${port}/`);
  });
}

startServer().catch((err) => {
  logger.error("系统启动崩溃", err);
});

// Trigger server reload to load new .env variables
