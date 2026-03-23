import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { protectedProcedure, adminProcedure, router } from "./_core/trpc";
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
} from "./db";
import { licenseService } from "./licenseService";

export const userRouter = router({
  // === License Management ===

  /**
   * Activate a license key for the current user
   */
  activateLicense: protectedProcedure
    .input(z.object({
      licenseKey: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify license with hw-license-center
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

      // Update user's license information
      await updateUser(ctx.user.id, {
        licenseKey: input.licenseKey,
        subscriptionTier: result.tier || 'free',
        licenseExpiresAt: result.expiresAt,
        licenseToken: result.token,
      });

      // Log the activation
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

  /**
   * Get current user's subscription info
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const limits = licenseService.getTierLimits(user.subscriptionTier || 'free');
    const linkCount = await getUserLinkCount(ctx.user.id);
    const domainCount = await getUserDomainCount(ctx.user.id);

    const isValid = licenseService.isSubscriptionValid(user.licenseExpiresAt);

    return {
      tier: user.subscriptionTier || 'free',
      licenseKey: user.licenseKey ? `${user.licenseKey.substring(0, 8)}****` : null, // Masked
      expiresAt: user.licenseExpiresAt,
      isValid,
      limits,
      usage: {
        links: linkCount,
        domains: domainCount,
      },
    };
  }),

  /**
   * Unbind current license from user
   */
  unbindLicense: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await getUserById(ctx.user.id);
    if (!user || !user.licenseKey) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No active license to unbind",
      });
    }

    // Notify license server to unbind
    const result = await licenseService.unbindLicense(user.licenseKey, ctx.user.id.toString());

    if (!result.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: result.message,
      });
    }

    // Reset user's subscription to free
    await updateUser(ctx.user.id, {
      subscriptionTier: 'free',
      licenseKey: null,
      licenseExpiresAt: null,
      licenseToken: null,
    });

    // Log the unbind
    await createAuditLog({
      userId: ctx.user.id,
      action: "license_unbound",
      targetType: "user",
      targetId: ctx.user.id,
    });

    return { success: true };
  }),

  /**
   * Update current user's profile
   */
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
    }))
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

  /**
   * Change current user's password
   */
  changePassword: protectedProcedure
    .input(z.object({
      oldPassword: z.string(),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user || user.openId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User not found or social login user cannot change password here",
        });
      }

      // Verify old password
      const scryptAsync = promisify(scrypt);
      const [salt, storedHash] = (user as any).passwordHash.split(":");
      const buf = (await scryptAsync(input.oldPassword, salt, 64)) as Buffer;
      
      if (buf.toString("hex") !== storedHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Incorrect current password",
        });
      }

      // Hash new password
      const newSalt = randomBytes(16).toString("hex");
      const newBuf = (await scryptAsync(input.newPassword, newSalt, 64)) as Buffer;
      const newPasswordHash = `${newSalt}:${newBuf.toString("hex")}`;

      const { resetUserPassword } = await import("./db");
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

  /**
   * List all users (admin only)
   */
  list: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { users, total } = await getAllUsers(input.limit, input.offset, input.search);
      return { users, total };
    }),

  /**
   * Get user by ID (admin only)
   */
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

      // Get usage stats
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

  /**
   * Update user (admin only)
   */
  update: adminProcedure
    .input(z.object({
      userId: z.number(),
      name: z.string().optional(),
      email: z.string().email().optional(),
      role: z.enum(["user", "admin"]).optional(),
      subscriptionTier: z.string().optional(),
    }))
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

  /**
   * Delete user (admin only)
   */
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

      // Prevent deleting yourself
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
 
   /**
    * Reset user password (admin only)
    */
   resetPassword: adminProcedure
     .input(z.object({
       userId: z.number(),
       password: z.string().min(6),
     }))
     .mutation(async ({ ctx, input }) => {
       const scryptAsync = promisify(scrypt);
       const salt = randomBytes(16).toString("hex");
       const buf = (await scryptAsync(input.password, salt, 64)) as Buffer;
       const passwordHash = `${salt}:${buf.toString("hex")}`;
 
       const { resetUserPassword } = await import("./db");
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

  /**
   * Get admin dashboard statistics
   */
  getAdminStats: adminProcedure.query(async () => {
    return getAdminDashboardStats();
  }),

  /**
   * Get platform usage statistics
   */
  getPlatformUsage: adminProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      return getPlatformUsageStats(input.days);
    }),

  // === Audit Logs (Admin) ===

  /**
   * Get audit logs
   */
  getAuditLogs: adminProcedure
    .input(z.object({
      userId: z.number().optional(),
      action: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
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

  /**
   * Get audit log action types
   */
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

  // === Link Management (Admin) ===

  /**
   * Get all links with pagination
   */
  getAllLinks: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      isActive: z.number().optional(),
      isValid: z.number().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const { links, total } = await searchAllLinks({
        search: input.search,
        isActive: input.isActive,
        isValid: input.isValid,
        limit: input.limit,
        offset: input.offset,
      });
      const totalPages = Math.ceil(total / input.limit);
      return { links, total, totalPages };
    }),

  /**
   * Delete a link (admin)
   */
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

  /**
   * Toggle link status (admin)
   */
  adminToggleLinkStatus: adminProcedure
    .input(z.object({
      linkId: z.number(),
      isActive: z.number().min(0).max(1),
    }))
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

  // === Notification Management ===

  /**
   * Get notification statistics (admin)
   */
  getNotificationStats: adminProcedure
    .query(async () => {
      return await getNotificationStats();
    }),

  /**
   * List all notifications (admin)
   */
  listNotifications: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      type: z.string().optional(),
      userId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const notifications = await getAllNotifications(input.limit, input.offset, input.type, input.userId);
      return notifications;
    }),

  /**
   * Send notification to users (admin)
   */
  sendNotification: adminProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      message: z.string().min(1),
      type: z.enum(['announcement', 'warning', 'info', 'system']),
      priority: z.enum(['low', 'normal', 'high']).default('normal'),
      targetUserIds: z.array(z.number()).optional(), // undefined = broadcast to all
    }))
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

  /**
   * Delete notification (admin)
   */
  deleteNotification: adminProcedure
    .input(z.object({
      notificationId: z.number(),
    }))
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

  // === User Notifications (for regular users) ===

  /**
   * Get current user's notifications
   */
  getMyNotifications: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const notifications = await getNotificationsForUser(ctx.user.id, input.limit, input.offset);
      const counts = await getNotificationCount(ctx.user.id);
      return { notifications, ...counts };
    }),

  /**
   * Mark notification as read
   */
  markNotificationRead: protectedProcedure
    .input(z.object({
      notificationId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await markNotificationRead(input.notificationId, ctx.user.id);
      return { success: true };
    }),

  /**
   * Mark all notifications as read
   */
  markAllNotificationsRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      await markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
});
