import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authService } from "./sdk";
import * as db from "../db";

// 开发模式下的默认用户
const DEV_USER_OPEN_ID = "dev-user-temp";

// 开发模式安全检查：仅允许本地回环地址
const DEV_ALLOWED_IPS = ["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"];

function isDevAllowedIp(ip: string | undefined): boolean {
  if (!ip) return false;
  return DEV_ALLOWED_IPS.includes(ip);
}

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

async function ensureDevUser(): Promise<User> {
  // 确保开发用户存在
  let user = await db.getUserByOpenId(DEV_USER_OPEN_ID);
  if (!user) {
    await db.upsertUser({
      openId: DEV_USER_OPEN_ID,
      username: "dev",
      name: "Developer",
      email: "dev@localhost",
      role: "admin",
      subscriptionTier: "business", // 开发用户默认 business 权限
    });
    user = await db.getUserByOpenId(DEV_USER_OPEN_ID);
  }

  if (!user) {
    throw new Error("Failed to ensure development user");
  }

  return user;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // 从 Cookie 中获取 JWT Session Token 并验证
  try {
    const cookieHeader = opts.req.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader);
      const sessionCookie = cookies[COOKIE_NAME];
      if (sessionCookie) {
        const session = await authService.verifySession(sessionCookie);

        if (session) {
          const dbUser = await db.getUserByOpenId(session.openId);
          if (dbUser) {
            user = dbUser;
          }
        }
      }
    }
  } catch (error) {
    // 认证失败不影响公开接口
    console.error("[Auth] Session verification error:", error);
    user = null;
  }

  // 开发模式：只有在没有任何 cookie 时才使用临时开发用户
  // 如果有 session cookie（无论有效与否），说明用户正在尝试登录，不应该自动使用开发用户
  const hasAnyCookie =
    opts.req.headers.cookie && opts.req.headers.cookie.length > 0;

  // 获取客户端 IP
  const clientIp =
    (opts.req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    opts.req.ip ||
    opts.req.socket.remoteAddress;

  if (!user && !hasAnyCookie && process.env.NODE_ENV === "development") {
    // 额外安全检查：仅允许本地 IP 访问开发用户
    if (isDevAllowedIp(clientIp)) {
      try {
        user = await ensureDevUser();
        console.log(
          "[Dev] Using temporary dev user for development (no cookies, IP verified)"
        );
      } catch (error) {
        console.error("[Dev] Failed to create dev user:", error);
      }
    } else {
      console.warn(
        `[Dev] Blocked dev auto-login from non-local IP: ${clientIp}`
      );
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
