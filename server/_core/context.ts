import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import * as db from "../db";

// 开发模式下的默认用户
const DEV_USER_OPEN_ID = "dev-user-temp";
const DEV_TENANT_SLUG = "dev-tenant";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

async function ensureDevUserAndTenant(): Promise<User> {
  // 确保开发租户存在
  let tenant = await db.getTenantBySlug(DEV_TENANT_SLUG);
  if (!tenant) {
    await db.createTenant({
      name: "Development Tenant",
      slug: DEV_TENANT_SLUG,
      isActive: 1,
    });
    tenant = await db.getTenantBySlug(DEV_TENANT_SLUG);
  }

  // 确保开发用户存在
  let user = await db.getUserByOpenId(DEV_USER_OPEN_ID);
  if (!user) {
    await db.upsertUser({
      openId: DEV_USER_OPEN_ID,
      name: "Developer",
      email: "dev@localhost",
      role: "admin",
      tenantId: tenant?.id,
    });
    user = await db.getUserByOpenId(DEV_USER_OPEN_ID);
  }

  return user!;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // 开发模式：如果没有用户，使用临时开发用户
  if (!user && process.env.NODE_ENV === "development") {
    try {
      user = await ensureDevUserAndTenant();
      console.log("[Dev] Using temporary dev user for development");
    } catch (error) {
      console.error("[Dev] Failed to create dev user:", error);
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
