import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ErrorCodes } from "@shared/errorCodes";
import {
  getDeletedLinks,
  softDeleteLink,
  getLinkById,
  restoreLink,
  permanentDeleteLink,
  emptyRecycleBin,
} from "../db";

export const recycleBinRouter = router({
  getDeleted: protectedProcedure.query(async ({ ctx }) => {
    return await getDeletedLinks(ctx.user.id);
  }),

  softDelete: protectedProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const link = await getLinkById(input.linkId);
      if (!link || link.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      }
      await softDeleteLink(input.linkId, ctx.user.id);
      return { success: true };
    }),

  restore: protectedProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const link = await getLinkById(input.linkId);
      if (!link || link.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      }
      const result = await restoreLink(input.linkId, ctx.user.id);
      if (!result.success) {
        if (result.error === "SHORT_CODE_TAKEN") {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "原始短码已被其他链接占用，无法恢复。请手动修改短码或先释放占用的短码。",
          });
        }
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      return { success: true };
    }),

  permanentDelete: protectedProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const link = await getLinkById(input.linkId);
      if (!link || link.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      }
      await permanentDeleteLink(input.linkId, ctx.user.id);
      return { success: true };
    }),

  emptyRecycleBin: protectedProcedure.mutation(async ({ ctx }) => {
    await emptyRecycleBin(ctx.user.id);
    return { success: true };
  }),
});
