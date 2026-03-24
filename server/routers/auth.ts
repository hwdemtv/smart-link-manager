import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { hashPassword, verifyPassword } from "../_core/auth";
import { getUserByUsername, upsertUser } from "../db";
import { authService } from "../_core/sdk";
import { ENV } from "../_core/env";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { ErrorCodes } from "@shared/errorCodes";

export const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  // 用户名密码登录
  login: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 安全日志：仅记录用户名，不记录任何用户数据
      const user = await getUserByUsername(input.username);

      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        });
      }

      if (user.isActive === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account suspended. Please contact administrator.",
        });
      }

      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: ErrorCodes.AUTH_INVALID_CREDENTIALS,
        });
      }

      // 签发 JWT Session Token
      const sessionToken = await authService.createSessionToken(user.openId, {
        name: user.name || user.username || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      const ip =
        ctx.req.headers["x-forwarded-for"] ||
        ctx.req.socket.remoteAddress ||
        "";
      const ipStr =
        typeof ip === "string"
          ? ip.split(",")[0].trim()
          : Array.isArray(ip)
            ? ip[0]
            : "";
      const lastIpAddress = ipStr ? ipStr.substring(0, 45) : undefined;

      // 更新最后登录时间与 IP
      await upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
        ...(lastIpAddress ? { lastIpAddress } : {}),
      });

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          subscriptionTier: user.subscriptionTier,
        },
        registrationDisabled: process.env.REGISTRATION_DISABLED === "true",
      };
    }),

  // 用户注册
  register: publicProcedure
    .input(
      z.object({
        username: z
          .string()
          .min(3)
          .max(32)
          .regex(/^[a-zA-Z0-9_-]+$/, ErrorCodes.AUTH_USERNAME_FORMAT),
        password: z.string().min(6).max(128),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 检查是否禁用注册
      if (ENV.registrationDisabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Registration is currently disabled",
        });
      }

      // 检查用户名是否已存在
      const existing = await getUserByUsername(input.username);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: ErrorCodes.AUTH_USERNAME_EXISTS,
        });
      }

      const passwordHash = await hashPassword(input.password);
      const openId = `user-${randomBytes(12).toString("hex")}`;

      const ip =
        ctx.req.headers["x-forwarded-for"] ||
        ctx.req.socket.remoteAddress ||
        "";
      const ipStr =
        typeof ip === "string"
          ? ip.split(",")[0].trim()
          : Array.isArray(ip)
            ? ip[0]
            : "";
      const lastIpAddress = ipStr ? ipStr.substring(0, 45) : undefined;

      await upsertUser({
        openId,
        username: input.username,
        passwordHash,
        name: input.name || input.username,
        role: "user",
        subscriptionTier: "free",
        isActive: 1,
        lastSignedIn: new Date(),
        ...(lastIpAddress ? { lastIpAddress } : {}),
      });

      // 签发 JWT Session Token 自动登录
      const sessionToken = await authService.createSessionToken(openId, {
        name: input.name || input.username,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      return {
        success: true,
        user: {
          username: input.username,
          name: input.name || input.username,
        },
      };
    }),
});
