import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import {
  createTenant,
  getTenantBySlug,
  getTenantById,
  getAllTenants,
  updateTenant,
  deleteTenant,
  getSubscriptionPlans,
  getSubscriptionPlanById,
  createSubscription,
  getTenantSubscription,
  updateSubscription,
  getTenantUsage,
  recordUsage,
} from "./db";

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
  
  // Create a new tenant
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
        description: z.string().optional(),
        logo: z.string().url().optional(),
        primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
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

      await createTenant({
        name: input.name,
        slug: input.slug,
        description: input.description,
        logo: input.logo,
        primaryColor: input.primaryColor,
        isActive: 1,
      });

      return { success: true, slug: input.slug };
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

  // ===== SUBSCRIPTION MANAGEMENT =====

  // Get available subscription plans
  getPlans: protectedProcedure.query(async () => {
    const plans = await getSubscriptionPlans();
    return plans;
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
      return null;
    }

    const plan = await getSubscriptionPlanById(subscription.planId);
    return { ...subscription, plan };
  }),

  // Subscribe to a plan
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
        throw new TRPCError({
          code: "CONFLICT",
          message: "Tenant already has an active subscription",
        });
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

      return { success: true };
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
        (acc, log) => ({
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

    const subscription = await getTenantSubscription(ctx.user.tenantId);
    if (!subscription) {
      return { canCreate: false, reason: "No active subscription" };
    }

    const plan = await getSubscriptionPlanById(subscription.planId);
    if (!plan) {
      return { canCreate: false, reason: "Plan not found" };
    }

    // TODO: Check actual link count against plan limit
    // For now, just return true if subscription is active
    return {
      canCreate: true,
      maxLinks: plan.maxLinks,
      maxApiCallsPerDay: plan.maxApiCallsPerDay,
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

    const subscription = await getTenantSubscription(ctx.user.tenantId);
    if (!subscription) {
      return { allowed: false, reason: "No active subscription" };
    }

    const plan = await getSubscriptionPlanById(subscription.planId);
    if (!plan) {
      return { allowed: false, reason: "Plan not found" };
    }

    // TODO: Check actual API calls today against plan limit
    return {
      allowed: true,
      dailyLimit: plan.maxApiCallsPerDay,
      remaining: plan.maxApiCallsPerDay, // TODO: Calculate actual remaining
    };
  }),
});

export type TenantRouter = typeof tenantRouter;
