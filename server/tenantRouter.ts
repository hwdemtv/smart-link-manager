import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  createTenant,
  getTenantBySlug,
  getTenantById,
  getAllTenants,
  updateTenant,
  deleteTenant,
  getSubscriptionPlans,
  getSubscriptionPlanById,
  getFreePlan,
  createSubscription,
  getTenantSubscription,
  updateSubscription,
  getTenantUsage,
  recordUsage,
  getTenantLinkCount,
  getSubscriptionsWithDetails,
  upsertUser,
  getUserByUsername,
  getUserByOpenId,
  getUserById,
  getUsersByTenant,
  updateUser,
  deleteUser,
  getTenantAdminCount,
} from "./db";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { authService } from "./_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

const scryptAsync = promisify(scrypt);

// 密码哈希工具
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString("hex")}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuf = Buffer.from(key, "hex");
  return timingSafeEqual(buf, keyBuf);
}

/**
 * Platform admin procedures - for managing tenants
 */
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

/**
 * Tenant admin procedures - for managing own tenant
 */
const tenantAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "tenant_admin" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Tenant admin access required" });
  }
  return next({ ctx });
});

export const tenantRouter = router({
  // ===== TENANT MANAGEMENT (Admin only) =====

  // Create a new tenant with optional admin account
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
        description: z.string().optional(),
        logo: z.string().url().optional(),
        primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
        // Optional: create admin account for the tenant
        adminUsername: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/).optional(),
        adminPassword: z.string().min(6).max(128).optional(),
        adminName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Check if slug already exists
      const existing = await getTenantBySlug(input.slug);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Slug already exists",
        });
      }

      // Check if admin username is provided and already exists
      if (input.adminUsername) {
        const existingUser = await getUserByUsername(input.adminUsername);
        if (existingUser) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Admin username already exists",
          });
        }
      }

      // Create tenant
      const tenant = await createTenant({
        name: input.name,
        slug: input.slug,
        description: input.description,
        logo: input.logo,
        primaryColor: input.primaryColor,
        isActive: 1,
      });

      // Create admin account if credentials provided
      let adminUser = null;
      if (input.adminUsername && input.adminPassword) {
        const passwordHash = await hashPassword(input.adminPassword);
        const openId = `tenant-admin-${randomBytes(12).toString("hex")}`;

        await upsertUser({
          openId,
          username: input.adminUsername,
          passwordHash,
          name: input.adminName || input.adminUsername,
          role: "tenant_admin",
          tenantId: tenant.id,
          lastSignedIn: new Date(),
        });

        adminUser = {
          username: input.adminUsername,
          name: input.adminName || input.adminUsername,
        };
      }

      return {
        success: true,
        slug: input.slug,
        tenantId: tenant.id,
        adminUser,
      };
    }),

  // List all tenants
  list: adminProcedure.query(async () => {
    const tenants = await getAllTenants();
    return tenants;
  }),

  // Get tenant details
  getById: adminProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      const tenant = await getTenantById(input.tenantId);
      if (!tenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tenant not found",
        });
      }
      return tenant;
    }),

  // Update tenant
  update: adminProcedure
    .input(
      z.object({
        tenantId: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        logo: z.string().url().optional(),
        primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
        isActive: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { tenantId, ...data } = input;
      await updateTenant(tenantId, data);
      return { success: true };
    }),

  // Delete tenant
  delete: adminProcedure
    .input(z.object({ tenantId: z.number() }))
    .mutation(async ({ input }) => {
      await deleteTenant(input.tenantId);
      return { success: true };
    }),

  // ===== TENANT ADMIN REGISTRATION & LOGIN =====

  // Check if tenant exists and is active (public)
  checkTenant: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const tenant = await getTenantBySlug(input.slug);
      if (!tenant) {
        return { exists: false, active: false };
      }
      return {
        exists: true,
        active: tenant.isActive === 1,
        name: tenant.name,
        primaryColor: tenant.primaryColor,
      };
    }),

  // Register tenant admin (public, requires tenant slug)
  registerAdmin: publicProcedure
    .input(
      z.object({
        tenantSlug: z.string().min(3),
        username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores and hyphens"),
        password: z.string().min(6).max(128),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify tenant exists and is active
      const tenant = await getTenantBySlug(input.tenantSlug);
      if (!tenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tenant not found",
        });
      }
      if (tenant.isActive !== 1) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tenant is not active",
        });
      }

      // Check if username already exists
      const existingUser = await getUserByUsername(input.username);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Username already exists",
        });
      }

      // Create tenant admin
      const passwordHash = await hashPassword(input.password);
      const openId = `tenant-admin-${randomBytes(12).toString("hex")}`;

      await upsertUser({
        openId,
        username: input.username,
        passwordHash,
        name: input.name || input.username,
        role: "tenant_admin",
        tenantId: tenant.id,
        lastSignedIn: new Date(),
      });

      // Auto login: sign JWT Session Token
      const sessionToken = await authService.createSessionToken(openId, {
        name: input.name || input.username,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return {
        success: true,
        user: {
          username: input.username,
          name: input.name || input.username,
          role: "tenant_admin",
          tenantId: tenant.id,
        },
      };
    }),

  // Get tenant admin info (for logged-in tenant admin)
  getAdminInfo: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "tenant_admin" && ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Tenant admin access required",
      });
    }

    if (!ctx.user.tenantId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User must belong to a tenant",
      });
    }

    const tenant = await getTenantById(ctx.user.tenantId);
    return {
      user: {
        id: ctx.user.id,
        username: ctx.user.username,
        name: ctx.user.name,
        role: ctx.user.role,
      },
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        primaryColor: tenant.primaryColor,
      } : null,
    };
  }),

  // ===== SUBSCRIPTION MANAGEMENT =====

  // Get available subscription plans
  getPlans: protectedProcedure.query(async () => {
    const plans = await getSubscriptionPlans();
    return plans;
  }),

  // Get all subscriptions with details (admin only)
  getAllSubscriptions: adminProcedure.query(async () => {
    const subscriptions = await getSubscriptionsWithDetails();
    return subscriptions;
  }),

  // Get tenant's current subscription
  getSubscription: tenantAdminProcedure.query(async ({ ctx }) => {
    if (!ctx.user.tenantId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User must belong to a tenant",
      });
    }

    const subscription = await getTenantSubscription(ctx.user.tenantId);
    if (!subscription) {
      // Return Free plan as default for tenants without subscription
      const freePlan = await getFreePlan();
      return {
        id: 0,
        tenantId: ctx.user.tenantId,
        planId: freePlan?.id || 1,
        status: "active" as const,
        billingCycle: "monthly" as const,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        plan: freePlan,
        isDefaultFree: true,
      };
    }

    const plan = await getSubscriptionPlanById(subscription.planId);
    return { ...subscription, plan, isDefaultFree: false };
  }),

  // Subscribe to a plan (or upgrade/downgrade)
  subscribe: tenantAdminProcedure
    .input(
      z.object({
        planId: z.number(),
        billingCycle: z.enum(["monthly", "yearly"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User must belong to a tenant",
        });
      }

      const plan = await getSubscriptionPlanById(input.planId);
      if (!plan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Plan not found",
        });
      }

      // Check if tenant already has active subscription
      const existing = await getTenantSubscription(ctx.user.tenantId);
      if (existing) {
        // Update existing subscription (upgrade/downgrade)
        const now = new Date();
        const endDate = new Date(now);
        if (input.billingCycle === "monthly") {
          endDate.setMonth(endDate.getMonth() + 1);
        } else {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }

        await updateSubscription(existing.id, {
          planId: input.planId,
          billingCycle: input.billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: endDate,
          status: "active",
          cancelledAt: null,
        });

        return { success: true, upgraded: true };
      }

      const now = new Date();
      const endDate = new Date(now);
      if (input.billingCycle === "monthly") {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      await createSubscription({
        tenantId: ctx.user.tenantId,
        planId: input.planId,
        status: "active",
        billingCycle: input.billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: endDate,
      });

      return { success: true, upgraded: false };
    }),

  // Cancel subscription
  cancel: tenantAdminProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user.tenantId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User must belong to a tenant",
      });
    }

    const subscription = await getTenantSubscription(ctx.user.tenantId);
    if (!subscription) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No active subscription found",
      });
    }

    await updateSubscription(subscription.id, {
      status: "cancelled",
      cancelledAt: new Date(),
    });

    return { success: true };
  }),

  // ===== USAGE AND ANALYTICS =====

  // Get tenant usage statistics
  getUsage: tenantAdminProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User must belong to a tenant",
        });
      }

      const usage = await getTenantUsage(ctx.user.tenantId, input.days || 30);
      
      // Calculate totals
      const totals = usage.reduce(
        (acc: { linksCreated: number, apiCalls: number, totalClicks: number }, log: any) => ({
          linksCreated: acc.linksCreated + (log.linksCreated || 0),
          apiCalls: acc.apiCalls + (log.apiCalls || 0),
          totalClicks: acc.totalClicks + (log.totalClicks || 0),
        }),
        { linksCreated: 0, apiCalls: 0, totalClicks: 0 }
      );

      return {
        daily: usage,
        totals,
      };
    }),

  // Record usage (internal - called from other routers)
  recordUsageInternal: protectedProcedure
    .input(
      z.object({
        linksCreated: z.number().optional(),
        apiCalls: z.number().optional(),
        totalClicks: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User must belong to a tenant",
        });
      }

      const today = new Date().toISOString().split("T")[0];
      await recordUsage({
        tenantId: ctx.user.tenantId,
        date: today,
        linksCreated: input.linksCreated || 0,
        apiCalls: input.apiCalls || 0,
        totalClicks: input.totalClicks || 0,
      });

      return { success: true };
    }),

  // ===== QUOTA CHECKING =====

  // Check if tenant can create more links
  canCreateLink: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.tenantId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User must belong to a tenant",
      });
    }

    // Get subscription or default to Free plan
    const subscription = await getTenantSubscription(ctx.user.tenantId);
    let plan;
    if (subscription) {
      plan = await getSubscriptionPlanById(subscription.planId);
    } else {
      // No subscription - use Free plan as default
      plan = await getFreePlan();
    }

    if (!plan) {
      return { canCreate: false, reason: "Plan not found" };
    }

    const currentLinks = await getTenantLinkCount(ctx.user.tenantId);
    const canCreate = plan.maxLinks === -1 || currentLinks < plan.maxLinks;

    return {
      canCreate,
      reason: canCreate ? undefined : "Plan limit reached",
      maxLinks: plan.maxLinks,
      currentLinks,
      maxApiCallsPerDay: plan.maxApiCallsPerDay,
      planName: plan.name,
      hasSubscription: !!subscription,
    };
  }),

  // Check API rate limit
  checkRateLimit: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.tenantId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User must belong to a tenant",
      });
    }

    // Get subscription or default to Free plan
    const subscription = await getTenantSubscription(ctx.user.tenantId);
    let plan;
    if (subscription) {
      plan = await getSubscriptionPlanById(subscription.planId);
    } else {
      // No subscription - use Free plan as default
      plan = await getFreePlan();
    }

    if (!plan) {
      return { allowed: false, reason: "Plan not found" };
    }

    const usage = await getTenantUsage(ctx.user.tenantId, 1);
    const todayLog = usage.find((log: any) => log.date === new Date().toISOString().split('T')[0]);
    const apiCallsToday = todayLog?.apiCalls || 0;

    // -1 means unlimited
    const allowed = plan.maxApiCallsPerDay === -1 || apiCallsToday < plan.maxApiCallsPerDay;

    return {
      allowed,
      reason: allowed ? undefined : "Daily API limit reached",
      dailyLimit: plan.maxApiCallsPerDay,
      remaining: plan.maxApiCallsPerDay === -1 ? -1 : Math.max(0, plan.maxApiCallsPerDay - apiCallsToday),
      planName: plan.name,
      hasSubscription: !!subscription,
    };
  }),

  // ===== MEMBER MANAGEMENT =====

  // Get all members in the tenant
  getMembers: tenantAdminProcedure.query(async ({ ctx }) => {
    if (!ctx.user.tenantId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User must belong to a tenant",
      });
    }

    const members = await getUsersByTenant(ctx.user.tenantId);
    // Remove sensitive data
    return members.map((member: any) => ({
      id: member.id,
      username: member.username,
      name: member.name,
      email: member.email,
      role: member.role,
      lastSignedIn: member.lastSignedIn,
      createdAt: member.createdAt,
    }));
  }),

  // Invite a new member (create user account)
  inviteMember: tenantAdminProcedure
    .input(
      z.object({
        username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores and hyphens"),
        password: z.string().min(6).max(128),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "tenant_admin"]).default("user"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User must belong to a tenant",
        });
      }

      // Check if username already exists
      const existing = await getUserByUsername(input.username);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Username already exists",
        });
      }

      const passwordHash = await hashPassword(input.password);
      const openId = `user-${randomBytes(12).toString("hex")}`;

      await upsertUser({
        openId,
        username: input.username,
        passwordHash,
        name: input.name || input.username,
        email: input.email,
        role: input.role,
        tenantId: ctx.user.tenantId,
        lastSignedIn: new Date(),
      });

      return {
        success: true,
        user: {
          username: input.username,
          name: input.name || input.username,
          role: input.role,
        },
      };
    }),

  // Update member info
  updateMember: tenantAdminProcedure
    .input(
      z.object({
        userId: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "tenant_admin"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User must belong to a tenant",
        });
      }

      // Verify the user belongs to the same tenant
      const user = await getUserById(input.userId);
      if (!user || user.tenantId !== ctx.user.tenantId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in this tenant",
        });
      }

      // Prevent self-demotion if user is the last admin
      if (input.role && input.role !== user.role) {
        if (user.role === "tenant_admin" && user.id === ctx.user.id) {
          const adminCount = await getTenantAdminCount(ctx.user.tenantId);
          if (adminCount <= 1) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cannot demote yourself - you are the last tenant admin",
            });
          }
        }
      }

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.role !== undefined) updateData.role = input.role;

      await updateUser(input.userId, updateData);

      return { success: true };
    }),

  // Reset member password
  resetMemberPassword: tenantAdminProcedure
    .input(
      z.object({
        userId: z.number(),
        newPassword: z.string().min(6).max(128),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User must belong to a tenant",
        });
      }

      // Verify the user belongs to the same tenant
      const user = await getUserById(input.userId);
      if (!user || user.tenantId !== ctx.user.tenantId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in this tenant",
        });
      }

      const passwordHash = await hashPassword(input.newPassword);
      await updateUser(input.userId, { passwordHash });

      return { success: true };
    }),

  // Delete member
  deleteMember: tenantAdminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "User must belong to a tenant",
        });
      }

      // Cannot delete yourself
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete yourself",
        });
      }

      // Verify the user belongs to the same tenant
      const user = await getUserById(input.userId);
      if (!user || user.tenantId !== ctx.user.tenantId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in this tenant",
        });
      }

      // Check if trying to delete the last tenant admin
      if (user.role === "tenant_admin") {
        const adminCount = await getTenantAdminCount(ctx.user.tenantId);
        if (adminCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot delete the last tenant admin",
          });
        }
      }

      await deleteUser(input.userId);

      return { success: true };
    }),
});

export type TenantRouter = typeof tenantRouter;
