import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ErrorCodes } from "@shared/errorCodes";
import { getLinkStats, getLinkById } from "../db";

export const statsRouter = router({
  get: protectedProcedure
    .input(
      z.object({
        linkId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const link = await getLinkById(input.linkId);

      if (!link) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      }

      // Admin or Owner
      if (ctx.user.role !== "admin" && link.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      }

      return await getLinkStats(input.linkId);
    }),
});
