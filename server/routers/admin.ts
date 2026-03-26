import { router, adminProcedure } from "../_core/trpc";
import { randomBytes } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { hashPassword } from "../_core/auth";
import {
  getUserByUsername,
  upsertUser,
  updateUser,
  createAuditLog,
  batchUpdateUsers,
  batchDeleteUsers,
  getUserById,
  deleteUser,
  getAllUsers,
  getAdminDashboardStats,
  getPlatformUsageStats,
  getAuditLogs,
  getAllLinks,
  searchAllLinks,
  adminDeleteLink,
  adminBatchUpdateLinks,
  adminBatchDeleteLinks,
  getAdminQuickStats,
  // 黑名单
  addToBlacklist,
  getBlacklist,
  removeFromBlacklist,
  // 系统配置
  getSystemConfig,
  updateSystemConfig,
} from "../db";

export const adminRouter = router({
  // === 用户管理 (User Management) ===

  createUser: adminProcedure
    .input(
      z.object({
        username: z.string().min(3),
        password: z.string().min(6),
        name: z.string().optional(),
        role: z.enum(["user", "admin"]).default("user"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existingUser = await getUserByUsername(input.username);
      if (existingUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "AUTH_USERNAME_EXISTS",
        });
      }

      const passwordHash = await hashPassword(input.password);
      const openId = `manual_${randomBytes(4).toString("hex")}`;

      await upsertUser({
        openId,
        username: input.username,
        passwordHash,
        name: input.name,
        role: input.role,
        subscriptionTier: "free",
      });

      await createAuditLog({
        userId: ctx.user.id,
        action: "user_created_manually",
        targetType: "user",
        details: { createdUsername: input.username, role: input.role },
      });

      return { success: true };
    }),

  batchUpdateUsers: adminProcedure
    .input(
      z.object({
        userIds: z.array(z.number()).min(1),
        data: z
          .object({
            role: z.enum(["user", "admin"]).optional(),
            isActive: z.number().optional(),
            subscriptionTier: z.string().optional(),
            licenseExpiresAt: z.date().nullable().optional(),
          })
          .refine(
            data => Object.keys(data).length > 0,
            "No data provided for update"
          ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.data.role === "user" || input.data.isActive === 0) {
        const adminsToDemote = [];
        for (const uid of input.userIds) {
          const u = await getUserById(uid);
          if (u?.role === "admin") adminsToDemote.push(uid);
        }
        if (adminsToDemote.includes(ctx.user.id)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You cannot demote or deactivate your own admin account.",
          });
        }
      }

      await batchUpdateUsers(input.userIds, input.data);
      await createAuditLog({
        userId: ctx.user.id,
        action: "users_batch_updated",
        targetType: "user",
        details: { userIds: input.userIds, updates: input.data },
      });
      return { success: true };
    }),

  batchDeleteUsers: adminProcedure
    .input(z.object({ userIds: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (input.userIds.includes(ctx.user.id)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot delete your own account.",
        });
      }

      const adminsToDelete = [];
      for (const uid of input.userIds) {
        const u = await getUserById(uid);
        if (u?.role === "admin") adminsToDelete.push(uid);
      }
      if (adminsToDelete.length > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Cannot bulk delete administrator accounts for safety. Please delete them individually.",
        });
      }

      await batchDeleteUsers(input.userIds);
      await createAuditLog({
        userId: ctx.user.id,
        action: "users_batch_deleted",
        targetType: "user",
        details: { userIds: input.userIds },
      });
      return { success: true };
    }),

  updateUser: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        name: z.string().optional(),
        email: z.string().optional(),
        role: z.enum(["user", "admin"]).optional(),
        subscriptionTier: z.string().optional(),
        isActive: z.number().optional(),
        licenseExpiresAt: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 这里的逻辑已由 trpc.ts 中的中间件处理，但手动更新自己的角色/状态仍需防护
      if (
        input.userId === ctx.user.id &&
        (input.role === "user" || input.isActive === 0)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot demote or deactivate your own admin account.",
        });
      }

      await updateUser(input.userId, {
        name: input.name,
        email: input.email,
        role: input.role,
        subscriptionTier: input.subscriptionTier,
        isActive: input.isActive,
        licenseExpiresAt: input.licenseExpiresAt,
      });

      await createAuditLog({
        userId: ctx.user.id,
        action: "user_updated",
        targetType: "user",
        targetId: input.userId,
        details: {
          role: input.role,
          tier: input.subscriptionTier,
          isActive: input.isActive,
          licenseExpiresAt: input.licenseExpiresAt,
        },
      });

      return { success: true };
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot delete your own account.",
        });
      }
      await deleteUser(input.userId);
      await createAuditLog({
        userId: ctx.user.id,
        action: "user_deleted",
        targetType: "user",
        targetId: input.userId,
      });
      return { success: true };
    }),

  getAllUsers: adminProcedure.query(async () => {
    return await getAllUsers();
  }),

  // === 链接中心 (Link Management) ===

  getAllLinks: adminProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return await getAllLinks(input?.limit, input?.offset);
    }),

  searchLinks: adminProcedure
    .input(
      z.object({
        query: z.string().optional(),
        userId: z.number().optional(),
        domain: z.string().optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      return await searchAllLinks({
        search: input.query,
        userId: input.userId,
        domain: input.domain,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  deleteLink: adminProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await adminDeleteLink(input.linkId);
      await createAuditLog({
        userId: ctx.user.id,
        action: "link_deleted_by_admin",
        targetType: "link",
        targetId: input.linkId,
      });
      return { success: true };
    }),

  batchUpdateLinks: adminProcedure
    .input(
      z.object({
        linkIds: z.array(z.number()).min(1),
        data: z.object({ isActive: z.number().min(0).max(1).optional() }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await adminBatchUpdateLinks(input.linkIds, input.data);
      await createAuditLog({
        userId: ctx.user.id,
        action: "links_batch_updated_by_admin",
        targetType: "link",
        details: { linkIds: input.linkIds, updates: input.data },
      });
      return { success: true };
    }),

  batchDeleteLinks: adminProcedure
    .input(z.object({ linkIds: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await adminBatchDeleteLinks(input.linkIds);
      await createAuditLog({
        userId: ctx.user.id,
        action: "links_batch_deleted_by_admin",
        targetType: "link",
        details: { linkIds: input.linkIds },
      });
      return { success: true };
    }),

  // === 系统全局管理 (System Overview) ===

  getPlatformStats: adminProcedure.query(async () => {
    return await getPlatformUsageStats();
  }),

  getDashboardStats: adminProcedure.query(async () => {
    return await getAdminDashboardStats();
  }),

  getAuditLogs: adminProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return await getAuditLogs({ limit: input?.limit, offset: input?.offset });
    }),

  getQuickStats: adminProcedure.query(async () => {
    return await getAdminQuickStats();
  }),

  // === 系统级控制 (System Settings & Blacklist) ===

  getSystemConfig: adminProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      return await getSystemConfig(input.key);
    }),

  updateSystemConfig: adminProcedure
    .input(z.record(z.string(), z.any()))
    .mutation(async ({ ctx, input }) => {
      for (const [key, value] of Object.entries(input)) {
        await updateSystemConfig(key, value);
      }
      await createAuditLog({
        userId: ctx.user.id,
        action: "system_config_updated",
        targetType: "system",
        details: input,
      });
      return { success: true };
    }),

  getBlacklist: adminProcedure.query(async () => {
    return await getBlacklist();
  }),

  addToBlacklist: adminProcedure
    .input(
      z.object({
        ip: z.string(),
        reason: z.string().optional(),
        expiresAt: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await addToBlacklist({
        ipPattern: input.ip,
        reason: input.reason,
        expiresAt: input.expiresAt || undefined,
        createdBy: ctx.user.id,
      });
      await createAuditLog({
        userId: ctx.user.id,
        action: "ip_blacklisted",
        targetType: "system",
        details: { ip: input.ip, reason: input.reason },
      });
      return { success: true };
    }),

  removeFromBlacklist: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await removeFromBlacklist(input.id, ctx.user.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "ip_unblacklisted",
        targetType: "system",
        targetId: input.id,
      });
      return { success: true };
    }),

  testAiConnection: adminProcedure
    .input(
      z.object({
        baseUrl: z.string().optional(),
        apiKey: z.string().optional(),
        model: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // 动态导入以避免循环依赖或加载顺序问题
      const { testAiConnection } = await import("../aiSeoService");
      return await testAiConnection(input);
    }),
});
