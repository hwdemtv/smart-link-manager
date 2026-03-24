import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import {
  getUserById,
  getUserByUsername,
  updateUser,
  deleteUser,
  getAllUsers,
  getUserLinkCount,
  getUserDomainCount,
  getAdminDashboardStats,
  getPlatformUsageStats,
  createAuditLog,
  getAuditLogs,
  getAllLinks,
  searchAllLinks,
  adminDeleteLink,
  updateLink,
  getNotificationsForUser,
  getNotificationCount,
  getAllNotifications,
  getNotificationStats,
  markNotificationRead,
  markAllNotificationsRead,
  sendBroadcastNotification,
  deleteNotification,
  upsertUser,
  batchUpdateUsers,
  batchDeleteUsers,
  adminBatchUpdateLinks,
  adminBatchDeleteLinks,
  getAdminQuickStats,
} from "../db";
import { hashPassword } from "../_core/auth";
import { licenseService } from "../licenseService";

export const userRouter = router({
  // === Admin Operations ===

  create: adminProcedure
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
      const openId = `manual_${Math.random().toString(36).slice(2, 10)}`;

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
        details: {
          createdUsername: input.username,
          role: input.role,
        },
      });

      return { success: true };
    }),

  batchUpdate: adminProcedure
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
      await batchUpdateUsers(input.userIds, input.data as any);

      await createAuditLog({
        userId: ctx.user.id,
        action: "users_batch_updated",
        targetType: "users",
        details: {
          count: input.userIds.length,
          updatedData: input.data,
        },
      });

      return { success: true };
    }),

  batchDelete: adminProcedure
    .input(
      z.object({
        userIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userIds.includes(ctx.user.id)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete your own account in a batch operation",
        });
      }

      await batchDeleteUsers(input.userIds);

      await createAuditLog({
        userId: ctx.user.id,
        action: "users_batch_deleted",
        targetType: "users",
        details: {
          count: input.userIds.length,
        },
      });

      return { success: true };
    }),

  getQuickStats: adminProcedure.query(async () => {
    return await getAdminQuickStats();
  }),

  exportUsersCSV: adminProcedure.mutation(async ({ ctx }) => {
    await createAuditLog({
      userId: ctx.user.id,
      action: "users_exported_csv",
      targetType: "users",
      details: { exportTime: new Date().toISOString() },
    });

    const { users } = await getAllUsers(100000, 0);
    let csv =
      "ID,Username,Name,Role,Tier,Status,Created At,Last Signed In,Last IP Address\n";

    const escapeCsv = (str: string | null | undefined) => {
      if (!str) return '""';
      return `"${String(str).replace(/"/g, '""')}"`;
    };

    for (const u of users) {
      csv += `${u.id},${escapeCsv(u.username)},${escapeCsv(u.name)},${u.role},${u.subscriptionTier || "free"},${u.isActive ? "Active" : "Banned"},"${u.createdAt.toISOString()}","${u.lastSignedIn ? u.lastSignedIn.toISOString() : ""}",${escapeCsv(u.lastIpAddress)}\n`;
    }
    return csv;
  }),

  // === License Management ===

  activateLicense: protectedProcedure
    .input(
      z.object({
        licenseKey: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await licenseService.verifyLicense(
        input.licenseKey,
        ctx.user.id.toString(),
        ctx.user.name || ctx.user.username || `User ${ctx.user.id}`
      );

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.message,
        });
      }

      await updateUser(ctx.user.id, {
        licenseKey: input.licenseKey,
        subscriptionTier: result.tier || "free",
        licenseExpiresAt: result.expiresAt,
        licenseToken: result.token,
      });

      await createAuditLog({
        userId: ctx.user.id,
        action: "license_activated",
        targetType: "user",
        targetId: ctx.user.id,
        details: {
          tier: result.tier,
          expiresAt: result.expiresAt?.toISOString(),
        },
      });

      return {
        success: true,
        tier: result.tier,
        expiresAt: result.expiresAt,
      };
    }),

  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const limits = licenseService.getTierLimits(
      user.subscriptionTier || "free"
    );
    const linkCount = await getUserLinkCount(ctx.user.id);
    const domainCount = await getUserDomainCount(ctx.user.id);

    const isValid = licenseService.isSubscriptionValid(user.licenseExpiresAt);

    return {
      tier: user.subscriptionTier || "free",
      licenseKey: user.licenseKey
        ? `${user.licenseKey.substring(0, 8)}****`
        : null,
      expiresAt: user.licenseExpiresAt,
      isValid,
      limits,
      usage: {
        links: linkCount,
        domains: domainCount,
      },
    };
  }),

  unbindLicense: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || !user.licenseKey) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No active license to unbind",
      });
    }

    const result = await licenseService.unbindLicense(
      user.licenseKey,
      ctx.user.id.toString()
    );

    if (!result.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: result.message,
      });
    }

    await updateUser(ctx.user.id, {
      subscriptionTier: "free",
      licenseKey: null,
      licenseExpiresAt: null,
      licenseToken: null,
    });

    await createAuditLog({
      userId: ctx.user.id,
      action: "license_unbound",
      targetType: "user",
      targetId: ctx.user.id,
    });

    return { success: true };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateUser(ctx.user.id, input);

      await createAuditLog({
        userId: ctx.user.id,
        action: "user.update_profile",
        targetType: "user",
        targetId: ctx.user.id,
        details: input,
      });

      return { success: true };
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        oldPassword: z.string(),
        newPassword: z.string().min(6),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || !user.username) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "User not found or social login user cannot change password here",
        });
      }

      const scryptAsync = promisify(scrypt);
      const userWithPassword = user as any;
      if (!userWithPassword.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Social login user cannot change password here",
        });
      }

      const [salt, storedHash] = userWithPassword.passwordHash.split(":");
      const buf = (await scryptAsync(input.oldPassword, salt, 64)) as Buffer;
      const storedBuf = Buffer.from(storedHash, "hex");

      // 使用 timingSafeEqual 防止时序攻击
      if (buf.length !== storedBuf.length || !timingSafeEqual(buf, storedBuf)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Incorrect current password",
        });
      }

      const newSalt = randomBytes(16).toString("hex");
      const newBuf = (await scryptAsync(
        input.newPassword,
        newSalt,
        64
      )) as Buffer;
      const newPasswordHash = `${newSalt}:${newBuf.toString("hex")}`;

      const { resetUserPassword } = await import("../db");
      await resetUserPassword(ctx.user.id, newPasswordHash);

      await createAuditLog({
        userId: ctx.user.id,
        action: "user.change_password",
        targetType: "user",
        targetId: ctx.user.id,
      });

      return { success: true };
    }),

  // === User Management (Admin) ===

  list: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { users, total } = await getAllUsers(
        input.limit,
        input.offset,
        input.search
      );
      return { users, total };
    }),

  getById: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const user = await getUserById(input.userId);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const linkCount = await getUserLinkCount(input.userId);
      const domainCount = await getUserDomainCount(input.userId);

      return {
        ...user,
        usage: {
          links: linkCount,
          domains: domainCount,
        },
      };
    }),

  update: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "admin"]).optional(),
        subscriptionTier: z.string().optional(),
        licenseExpiresAt: z.date().nullable().optional(),
        isActive: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, ...updates } = input;

      const user = await getUserById(userId);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      await updateUser(userId, updates);

      await createAuditLog({
        userId: ctx.user.id,
        action: "user_updated",
        targetType: "user",
        targetId: userId,
        details: updates,
      });

      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(input.userId);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete yourself",
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

  resetPassword: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        password: z.string().min(6),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const scryptAsync = promisify(scrypt);
      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(input.password, salt, 64)) as Buffer;
      const passwordHash = `${salt}:${buf.toString("hex")}`;

      const { resetUserPassword } = await import("../db");
      await resetUserPassword(input.userId, passwordHash);

      await createAuditLog({
        userId: ctx.user.id,
        action: "user_password_reset",
        targetType: "user",
        targetId: input.userId,
      });

      return { success: true };
    }),

  // === Statistics ===

  getAdminStats: adminProcedure.query(async () => {
    return getAdminDashboardStats();
  }),

  getPlatformUsage: adminProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      return getPlatformUsageStats(input.days);
    }),

  // === Audit Logs ===

  getAuditLogs: adminProcedure
    .input(
      z.object({
        userId: z.number().optional(),
        action: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const { logs, total } = await getAuditLogs({
        userId: input.userId,
        action: input.action,
        limit: input.limit,
        offset: input.offset,
      });
      const totalPages = Math.ceil(total / input.limit);
      return { logs, total, totalPages };
    }),

  getAuditLogActions: adminProcedure.query(async () => {
    return [
      { value: "user.login", label: "User Login" },
      { value: "user.logout", label: "User Logout" },
      { value: "user.create", label: "Create User" },
      { value: "user.update", label: "Update User" },
      { value: "user.delete", label: "Delete User" },
      { value: "user_updated", label: "User Updated" },
      { value: "user_deleted", label: "User Deleted" },
      { value: "license_activated", label: "License Activated" },
      { value: "license_unbound", label: "License Unbound" },
      { value: "link.create", label: "Create Link" },
      { value: "link.update", label: "Update Link" },
      { value: "link.delete", label: "Delete Link" },
      { value: "domain.add", label: "Add Domain" },
      { value: "domain.verify", label: "Verify Domain" },
      { value: "domain.delete", label: "Delete Domain" },
      { value: "apikey.create", label: "Create API Key" },
      { value: "apikey.revoke", label: "Revoke API Key" },
    ];
  }),

  // === Link Management ===

  getAllLinks: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        isActive: z.number().optional(),
        isValid: z.number().optional(),
        userId: z.number().optional(),
        domain: z.string().optional(),
        expiresSoon: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const { links, total } = await searchAllLinks({
        search: input.search,
        isActive: input.isActive,
        isValid: input.isValid,
        userId: input.userId,
        domain: input.domain,
        expiresSoon: input.expiresSoon,
        limit: input.limit,
        offset: input.offset,
      });
      const totalPages = Math.ceil(total / input.limit);
      return { links, total, totalPages };
    }),

  adminDeleteLink: adminProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await adminDeleteLink(input.linkId);
      await createAuditLog({
        userId: ctx.user.id,
        action: "link.delete",
        targetType: "link",
        targetId: input.linkId,
      });
      return { success: true };
    }),

  adminToggleLinkStatus: adminProcedure
    .input(
      z.object({
        linkId: z.number(),
        isActive: z.number().min(0).max(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateLink(input.linkId, { isActive: input.isActive });
      await createAuditLog({
        userId: ctx.user.id,
        action: "link.update",
        targetType: "link",
        targetId: input.linkId,
        details: { isActive: input.isActive },
      });
      return { success: true };
    }),

  adminBatchToggleLinkStatus: adminProcedure
    .input(
      z.object({
        linkIds: z.array(z.number()).min(1),
        isActive: z.number().min(0).max(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await adminBatchUpdateLinks(input.linkIds, { isActive: input.isActive });

      await createAuditLog({
        userId: ctx.user.id,
        action: "links_batch_updated",
        targetType: "links",
        details: {
          count: input.linkIds.length,
          isActive: input.isActive,
        },
      });
      return { success: true };
    }),

  adminBatchDeleteLinks: adminProcedure
    .input(
      z.object({
        linkIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await adminBatchDeleteLinks(input.linkIds);

      await createAuditLog({
        userId: ctx.user.id,
        action: "links_batch_deleted",
        targetType: "links",
        details: { count: input.linkIds.length },
      });
      return { success: true };
    }),

  // === Notification Management ===

  getNotificationStats: adminProcedure.query(async () => {
    return await getNotificationStats();
  }),

  listNotifications: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        type: z.string().optional(),
        userId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const notifications = await getAllNotifications(
        input.limit,
        input.offset,
        input.type,
        input.userId
      );
      return notifications;
    }),

  sendNotification: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        message: z.string().min(1),
        type: z.enum(["announcement", "warning", "info", "system"]),
        priority: z.enum(["low", "normal", "high"]).default("normal"),
        targetUserIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await sendBroadcastNotification({
        title: input.title,
        message: input.message,
        type: input.type,
        priority: input.priority,
        senderId: ctx.user.id,
        targetUserIds: input.targetUserIds,
      });

      await createAuditLog({
        userId: ctx.user.id,
        action: "notification.send",
        targetType: "notification",
        targetId: 0,
        details: {
          type: input.type,
          title: input.title,
          targetCount: result.count,
          isBroadcast: !input.targetUserIds,
        },
      });

      return result;
    }),

  deleteNotification: adminProcedure
    .input(
      z.object({
        notificationId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await deleteNotification(input.notificationId);
      await createAuditLog({
        userId: ctx.user.id,
        action: "notification.delete",
        targetType: "notification",
        targetId: input.notificationId,
      });
      return { success: true };
    }),

  // === User Notifications ===

  getMyNotifications: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const notifications = await getNotificationsForUser(
        ctx.user.id,
        input.limit,
        input.offset
      );
      const counts = await getNotificationCount(ctx.user.id);
      return { notifications, ...counts };
    }),

  markNotificationRead: protectedProcedure
    .input(
      z.object({
        notificationId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await markNotificationRead(input.notificationId, ctx.user.id);
      return { success: true };
    }),

  markAllNotificationsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markAllNotificationsRead(ctx.user.id);
    return { success: true };
  }),
});
