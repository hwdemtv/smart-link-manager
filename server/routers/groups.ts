import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  createLinkGroup,
  getLinkGroups,
  updateLinkGroup,
  deleteLinkGroup,
} from "../db";

export const groupsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await getLinkGroups(ctx.user.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(64),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const group = await createLinkGroup(ctx.user.id, input);
      return { success: true, ...group };
    }),

  update: protectedProcedure
    .input(
      z.object({
        groupId: z.number(),
        name: z.string().min(1).max(64),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { groupId, ...data } = input;
      await updateLinkGroup(groupId, ctx.user.id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteLinkGroup(input.groupId, ctx.user.id);
      return { success: true };
    }),
});
