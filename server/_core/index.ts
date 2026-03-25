import crypto from "node:crypto";
// Polyfill for crypto.hash (required for Vite 7 on Node.js < 21.7)
if (!(crypto as any).hash) {
  (crypto as any).hash = (algorithm: string, data: any) =>
    crypto.createHash(algorithm).update(data).digest("hex");
}
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import compression from "compression";

import { registerChatRoutes } from "./chat";
import { appRouter } from "../routers/index";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleShortLinkRedirect } from "../redirectHandler";
import { handleRobotsTxt, handleSitemap } from "../seoHandler";
import { ENV, generatedPassword } from "./env";
import * as db from "../db";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { logger } from "./logger";
import { hashPassword } from "./auth";

// ============================================================================
// 安全响应头中间件 (Security Headers Middleware)
// ============================================================================
const securityHeadersMiddleware = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  // 防止点击劫持
  res.setHeader("X-Frame-Options", "DENY");
  // 防止 MIME 类型嗅探
  res.setHeader("X-Content-Type-Options", "nosniff");
  // XSS 保护
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // 引用策略
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // 权限策略
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
};

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

  if (!password) {
    logger.warn(
      "[Init] No default admin password configured, skipping admin creation"
    );
    return;
  }

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

  // 如果是自动生成的密码，需要特别提示
  if (generatedPassword) {
    logger.info(
      `[Init] ⚠️  Auto-generated admin password: ${username}/${password}`
    );
    logger.info(
      "[Init] Please change this password immediately after first login!"
    );
  } else {
    logger.info(`[Init] Default admin created successfully (${username})`);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // 应用安全响应头 (必须在所有路由之前)
  app.use(securityHeadersMiddleware);

  // 初始化默认管理员账户
  try {
    await ensureDefaultAdmin();
  } catch (error) {
    logger.warn("[Init] Failed to create default admin:", error);
  }

  // 初始化 IP 黑名单缓存
  try {
    const { initBlacklistCache } = await import("./ipBlacklist");
    await initBlacklistCache();
  } catch (error) {
    logger.warn("[Init] Failed to initialize blacklist cache:", error);
  }

  // --- FORCE DISABLE CACHE IN DEV ---
  if (process.env.NODE_ENV === "development") {
    app.use((_req, res, next) => {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      next();
    });
  }

  // CORS 配置：开发环境允许所有来源，生产环境限制为配置的域名
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(o => o.trim())
    : [];

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    // 开发环境允许所有来源，生产环境检查白名单
    if (process.env.NODE_ENV === "development" || !origin) {
      res.header("Access-Control-Allow-Origin", origin || "*");
    } else if (allowedOrigins.length > 0 && origin && allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    } else if (allowedOrigins.length === 0) {
      // 生产环境安全加固：若未配置 CORS_ORIGINS，默认仅允许同源请求
      // 不再回退到 "*" 以防止滥用
      if (process.env.NODE_ENV === "production" && origin) {
        // 如果是生产环境且有 origin，但不匹配白名单（当前为空），则保持不设置（即禁止跨域）
      } else {
        res.header("Access-Control-Allow-Origin", origin || "*");
      }
    } else {
      // 不在白名单的来源，不设置 CORS 头
    }

    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Security Headers & Proxy Trust (Issue 15)
  app.set("trust proxy", 1);

  // Configure body parser with reasonable size limit
  // 生产环境建议收紧至 2MB (Issue 14)
  const bodyLimit = process.env.BODY_LIMIT || "2mb";
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ limit: bodyLimit, extended: true }));

  // Enable Gzip/Deflate compression for all responses
  app.use(compression());

  // Chat API with streaming and tool calling
  registerChatRoutes(app);

  // 引入放刷风控组件
  const { redirectRateLimiter, strictAuthRateLimiter, stopAllRateLimiters } =
    await import("./rateLimiter");

  // 引入 IP 黑名单中间件
  const { redirectBlacklistMiddleware, stopBlacklistCache } =
    await import("./ipBlacklist");

  // 引入任务队列关闭逻辑
  const { shutdownJobQueues } = await import("../jobs");

  // 优雅关闭逻辑 (Issue 1)
  const gracefulShutdown = async (signal: string) => {
    logger.info(`[System] Received ${signal}, starting graceful shutdown...`);

    // 1. 停止定时器
    stopBlacklistCache();
    stopAllRateLimiters();

    // 2. 关闭队列
    await shutdownJobQueues();

    // 3. 关闭数据库连接
    await db.closeDb();

    logger.info("[System] Graceful shutdown complete. Exiting.");
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // 引入 REST API 路由 (OpenAPI)
  const restRouter = (await import("../restRouter")).default;
  app.use("/api/v1", restRouter);

  // SEO 路由: robots.txt 和 sitemap.xml
  app.get("/robots.txt", handleRobotsTxt);
  app.get("/sitemap.xml", handleSitemap);

  // 1. 保护公开的短链跳转解析引擎 (防大量爬虫或扫描器探底)
  app.get(
    "/s/:shortCode",
    redirectBlacklistMiddleware,
    redirectRateLimiter,
    async (req, res) => {
      await handleShortLinkRedirect(req, res, req.params.shortCode);
    }
  );

  // 2. 自定义域名短链路由 (Host 不是默认域名时，直接匹配短码)
  app.get(
    "/:shortCode",
    redirectBlacklistMiddleware,
    redirectRateLimiter,
    async (req, res, next) => {
      const host = req.get("host") || "";
      const defaultHost =
        process.env.VITE_APP_ID?.replace(/^https?:\/\//, "") || "localhost";

      // 如果是默认域名，跳过（交给前端路由处理）
      if (
        host === defaultHost ||
        host.startsWith("localhost") ||
        host.startsWith("127.0.0.1") ||
        host.includes(":3000")
      ) {
        return next();
      }

      // 自定义域名：提取域名部分（去掉端口）
      const customDomain = host.split(":")[0];
      const shortCode = req.params.shortCode;

      // 排除静态资源和 API 路由
      if (
        shortCode.startsWith("api") ||
        shortCode.startsWith("assets") ||
        shortCode.includes(".")
      ) {
        return next();
      }

      // 查询该域名下的短链
      const { getLinkByDomainAndCode } = await import("../db");
      const link = await getLinkByDomainAndCode(customDomain, shortCode);

      if (link) {
        logger.info(
          `[自定义域名] ${customDomain}/${shortCode} -> ${link.originalUrl}`
        );
        await handleShortLinkRedirect(req, res, shortCode);
      } else {
        // 不是短链，交给前端路由
        next();
      }
    }
  );

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
          logger.error(
            `[tRPC 致命异常] ${type} on ${path}: ${error.message}`,
            error
          );
        } else {
          // 常规业务报错如 UNAUTHORIZED, CONFLICT 等作为 warn 即可
          logger.warn(`[tRPC 拦截] ${type} on ${path}: ${error.message}`);
        }
      },
    })
  );

  // ============================================================================
  // 全局错误处理中间件 (Global Error Handler)
  // 必须放在所有路由之后
  // ============================================================================
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error("[Express] Unhandled error:", err);

    // 避免在错误响应中泄露敏感信息
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev ? err.message : "Internal Server Error";

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message,
      ...(isDev && { stack: err.stack }),
    });
  });

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

startServer().catch(err => {
  logger.error("系统启动崩溃", err);
});

// Trigger server reload to load new .env variables
