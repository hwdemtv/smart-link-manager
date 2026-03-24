import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ErrorCodes } from "@shared/errorCodes";
import {
  addDomain,
  getUserDomains,
  deleteDomain,
  verifyDomain,
  getUserDomainCount,
  getDomainByName,
} from "../db";
import { licenseService } from "../licenseService";

export const domainsRouter = router({
  add: protectedProcedure
    .input(
      z.object({
        domain: z
          .string()
          .min(3)
          .max(255)
          .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check quota
      const tier = ctx.user.subscriptionTier || "free";
      const limits = licenseService.getTierLimits(tier);

      if (limits.maxDomains === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Custom domains are not available on your current plan.",
        });
      }

      const currentDomains = await getUserDomainCount(ctx.user.id);
      if (limits.maxDomains !== -1 && currentDomains >= limits.maxDomains) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Quota exceeded: Maximum ${limits.maxDomains} domains for your current plan.`,
        });
      }

      const existing = await getDomainByName(input.domain);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: ErrorCodes.DOMAIN_ALREADY_REGISTERED,
        });
      }

      return await addDomain({
        userId: ctx.user.id,
        domain: input.domain,
        isVerified: 0,
      });
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return await getUserDomains(ctx.user.id);
  }),

  delete: protectedProcedure
    .input(z.object({ domainId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // 验证域名是否属于该用户
      const domains = await getUserDomains(ctx.user.id);
      if (!domains.find((d: any) => d.id === input.domainId)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.DOMAIN_NOT_FOUND,
        });
      }
      await deleteDomain(input.domainId);
      return { success: true };
    }),

  verify: protectedProcedure
    .input(z.object({ domainId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // 验证域名是否属于该用户
      const domains = await getUserDomains(ctx.user.id);
      const domain = domains.find((d: any) => d.id === input.domainId);
      if (!domain) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.DOMAIN_NOT_FOUND,
        });
      }

      // 注意：真实生产环境应查询该域名的 CNAME 记录是否正确指向服务器
      // await dns.resolveCname(domain.domain) 等检查，现在仅做状态更新模拟
      await verifyDomain(input.domainId);
      return { success: true };
    }),
});
