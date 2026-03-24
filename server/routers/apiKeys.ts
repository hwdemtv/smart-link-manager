import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { apiKeyService } from "../apiKeyService";
import { licenseService } from "../licenseService";

export const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return apiKeyService.listKeys(ctx.user.id);
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      // Check API key quota
      const tier = ctx.user.subscriptionTier || "free";
      const limits = licenseService.getTierLimits(tier);
      const existingKeys = await apiKeyService.listKeys(ctx.user.id);
      const activeKeys = existingKeys.filter((k: any) => k.isActive);

      if (limits.maxApiKeys !== -1 && activeKeys.length >= limits.maxApiKeys) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Maximum ${limits.maxApiKeys} API keys for your current plan.`,
        });
      }

      return apiKeyService.generateKey(ctx.user.id, input.name);
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return apiKeyService.revokeKey(input.id, ctx.user.id);
    }),
});
