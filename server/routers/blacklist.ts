import { router, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  getBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  createAuditLog,
} from "../db";

export const blacklistRouter = router({
  list: adminProcedure.query(async () => {
    return await getBlacklist();
  }),

  add: adminProcedure
    .input(
      z.object({
        ipPattern: z.string(),
        reason: z.string().optional(),
        expiresAt: z.date().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await addToBlacklist({
        ipPattern: input.ipPattern,
        reason: input.reason,
        expiresAt: input.expiresAt || undefined,
        createdBy: ctx.user.id,
      });

      await createAuditLog({
        userId: ctx.user.id,
        action: "ip_blacklisted",
        targetType: "system",
        details: { ip: input.ipPattern, reason: input.reason },
      });

      return { success: true };
    }),

  remove: adminProcedure
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
});
