import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ErrorCodes } from "@shared/errorCodes";
import { hashPassword, verifyPassword } from "../_core/auth";
import { ensureNullIfEmpty } from "../_core/utils";
import { licenseService } from "../licenseService";
import { generateSeoFromUrl } from "../aiSeoService";
import { authService } from "../_core/sdk";
import { resolveGeoIp } from "../geoIpResolver";
import {
  createLink,
  getLinkByShortCode,
  getLinksByUserId,
  getLinkById,
  updateLink,
  deleteLink,
  searchLinks,
  getLinkStatsSummary,
  updateLinkClickCount,
  recordLinkStat,
  getGlobalStatsSummary,
  checkShortCodes,
  batchDeleteLinks,
  batchUpdateLinks,
  batchUpdateLinksTags,
  getUserLinkCount,
  recordUsage,
  getDomainByName,
  getLinkByDomainAndCode,
  getDeletedLinks,
  softDeleteLink,
  restoreLink,
  permanentDeleteLink,
  emptyRecycleBin,
} from "../db";

export const linksRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        originalUrl: z.string().url(),
        shortCode: z
          .string()
          .min(3)
          .max(20)
          .regex(/^[a-zA-Z0-9_-]+$/),
        customDomain: z.string().optional(),
        description: z.string().optional(),
        expiresAt: z.date().optional(),
        password: z.string().optional(),
        tags: z.array(z.string()).optional(),
        seoTitle: z.string().optional(),
        seoDescription: z.string().optional(),
        seoImage: z.string().optional(),
        abTestEnabled: z.number().min(0).max(1).optional(),
        abTestUrl: z.string().url().optional(),
        abTestRatio: z.number().min(1).max(99).optional(),
        groupId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. 自定义域名权限与校验 (从原代码逻辑迁移，保持安全性)
      if (input.customDomain) {
        const domain = await getDomainByName(input.customDomain);
        if (!domain || domain.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: ErrorCodes.FORBIDDEN_DOMAIN_NOT_OWNED,
          });
        }
        if (!domain.isVerified) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: ErrorCodes.FORBIDDEN_DOMAIN_NOT_VERIFIED,
          });
        }
      }

      // 2. 配额限制校验 (从原代码逻辑迁移，防止爆库)
      const tier = ctx.user.subscriptionTier || "free";
      const limits = licenseService.getTierLimits(tier);
      const currentLinks = await getUserLinkCount(ctx.user.id);

      if (limits.maxLinks !== -1 && currentLinks >= limits.maxLinks) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Quota exceeded: Maximum ${limits.maxLinks} links for your current plan. Please upgrade your subscription.`,
        });
      }

      // 3. 密码哈希处理
      const passwordHash = input.password
        ? await hashPassword(input.password)
        : null;

      // 4. 原子化创建并捕获冲突 (修复竞态条件 TOCTOU)
      try {
        await createLink({
          userId: ctx.user.id,
          originalUrl: input.originalUrl,
          shortCode: input.shortCode,
          customDomain: input.customDomain,
          description: input.description,
          expiresAt: input.expiresAt,
          passwordHash,
          tags: input.tags || [],
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
          seoImage: input.seoImage,
          abTestEnabled: input.abTestEnabled,
          abTestUrl: input.abTestUrl,
          abTestRatio: input.abTestRatio,
          groupId: input.groupId,
        });
      } catch (error: any) {
        // 捕获唯一键冲突 (MySQL Error 1062)
        if (error.code === "ER_DUP_ENTRY" || error.message?.includes("Duplicate entry")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: input.customDomain 
              ? ErrorCodes.LINK_SHORT_CODE_DOMAIN_EXISTS 
              : ErrorCodes.LINK_SHORT_CODE_EXISTS,
          });
        }
        throw error;
      }

      await recordUsage({
        userId: ctx.user.id,
        date: new Date().toISOString().split("T")[0],
        linksCreated: 1,
      });

      return {
        success: true,
        shortCode: input.shortCode,
        customDomain: input.customDomain,
        fullUrl: input.customDomain
          ? `https://${input.customDomain}/${input.shortCode}`
          : `${process.env.VITE_APP_ID || "localhost"}/s/${input.shortCode}`,
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const links = await getLinksByUserId(ctx.user.id);
    return links.map((link: any) => ({
      ...link,
      fullUrl: link.customDomain
        ? `https://${link.customDomain}/${link.shortCode}`
        : `${process.env.VITE_APP_ID || "localhost"}/s/${link.shortCode}`,
    }));
  }),

  search: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        tag: z.string().optional(),
        status: z.enum(["all", "active", "invalid"]).optional(),
        orderBy: z.enum(["createdAt", "clickCount", "updatedAt"]).optional(),
        order: z.enum(["asc", "desc"]).optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
        groupId: z.number().nullable().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const result = await searchLinks(ctx.user.id, {
        search: input.query,
        tag: input.tag,
        status: input.status,
        orderBy: input.orderBy,
        order: input.order,
        limit: input.limit,
        offset: input.offset,
        groupId: input.groupId,
      });
      return {
        links: result.links.map((link: any) => ({
          ...link,
          fullUrl: link.customDomain
            ? `https://${link.customDomain}/${link.shortCode}`
            : `${process.env.VITE_APP_ID || "localhost"}/s/${link.shortCode}`,
        })),
        total: result.total,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ linkId: z.number() }))
    .query(async ({ ctx, input }) => {
      const link = await getLinkById(input.linkId);
      if (!link)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      if (ctx.user.role !== "admin" && link.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      }
      return {
        ...link,
        fullUrl: link.customDomain
          ? `https://${link.customDomain}/${link.shortCode}`
          : `${process.env.VITE_APP_ID || "localhost"}/s/${link.shortCode}`,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        linkId: z.number(),
        originalUrl: z.string().url().optional(),
        shortCode: z
          .string()
          .min(3)
          .max(20)
          .regex(/^[a-zA-Z0-9_-]+$/)
          .optional(),
        customDomain: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        isActive: z.number().min(0).max(1).optional(),
        expiresAt: z.date().nullable().optional(),
        password: z.string().nullable().optional(),
        tags: z.array(z.string()).nullable().optional(),
        seoTitle: z.string().nullable().optional(),
        seoDescription: z.string().nullable().optional(),
        seoImage: z.string().nullable().optional(),
        abTestEnabled: z.number().min(0).max(1).optional(),
        abTestUrl: z.string().url().nullable().optional(),
        abTestRatio: z.number().min(1).max(99).optional(),
        groupId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const link = await getLinkById(input.linkId);
      if (!link)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      if (ctx.user.role !== "admin" && link.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      }

      if (input.shortCode && input.shortCode !== link.shortCode) {
        const existing = await getLinkByShortCode(input.shortCode);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: ErrorCodes.LINK_SHORT_CODE_EXISTS,
          });
        }
      }

      let passwordHash: string | null | undefined = undefined;
      if (input.password !== undefined) {
        passwordHash = input.password
          ? await hashPassword(input.password)
          : null;
      }

      const updated = await updateLink(input.linkId, {
        originalUrl: input.originalUrl,
        shortCode: input.shortCode,
        customDomain: input.customDomain,
        description: input.description,
        isActive: input.isActive,
        expiresAt: input.expiresAt,
        passwordHash,
        tags: input.tags === undefined ? undefined : input.tags || [],
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        seoImage: input.seoImage,
        abTestEnabled: input.abTestEnabled,
        abTestUrl: input.abTestUrl,
        abTestRatio: input.abTestRatio,
        groupId: input.groupId,
      });

      return { success: true, link: updated };
    }),

  delete: protectedProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const link = await getLinkById(input.linkId);
      if (!link)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      if (ctx.user.role !== "admin" && link.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      }
      await deleteLink(input.linkId);
      return { success: true };
    }),

  getStatsSummary: protectedProcedure
    .input(z.object({ linkId: z.number() }))
    .query(async ({ ctx, input }) => {
      const link = await getLinkById(input.linkId);
      if (!link || (link.userId !== ctx.user.id && ctx.user.role !== "admin")) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      }
      return getLinkStatsSummary(input.linkId);
    }),

  globalStats: protectedProcedure
    .input(z.object({ days: z.number().default(7) }).optional())
    .query(async ({ ctx, input }) => {
      return await getGlobalStatsSummary(ctx.user.id, input?.days || 7);
    }),

  checkShortCodes: protectedProcedure
    .input(z.object({ shortCodes: z.array(z.string()) }))
    .query(async ({ input }) => {
      return await checkShortCodes(input.shortCodes);
    }),

  generateSeo: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      try {
        const seoData = await generateSeoFromUrl(input.url);
        return { success: true, ...seoData };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "SEO generation failed",
        });
      }
    }),

  batchDelete: protectedProcedure
    .input(z.object({ linkIds: z.array(z.number()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await batchDeleteLinks(ctx.user.id, input.linkIds);
      return { success: true };
    }),

  batchUpdate: protectedProcedure
    .input(
      z.object({
        linkIds: z.array(z.number()).min(1).max(100),
        data: z.object({
          isActive: z.number().int().min(0).max(1).optional(),
          expiresAt: z.string().optional().nullable(),
          customDomain: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: any = { ...input.data };
      if (updateData.expiresAt !== undefined) {
        updateData.expiresAt = ensureNullIfEmpty(updateData.expiresAt);
      }
      await batchUpdateLinks(ctx.user.id, input.linkIds, updateData);
      return { success: true };
    }),

  batchUpdateTags: protectedProcedure
    .input(
      z.object({
        linkIds: z.array(z.number()).min(1).max(100),
        tags: z.array(z.string()),
        mode: z.enum(["add", "remove", "set"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await batchUpdateLinksTags(
        ctx.user.id,
        input.linkIds,
        input.tags,
        input.mode
      );
      return { success: true };
    }),

  batchImport: protectedProcedure
    .input(
      z.object({
        links: z.array(
          z.object({
            originalUrl: z.string().url(),
            shortCode: z
              .string()
              .min(3)
              .max(20)
              .regex(/^[a-zA-Z0-9_-]+$/)
              .optional(),
            description: z.string().optional(),
            tags: z.array(z.string()).optional(),
            expiresAt: z.string().optional().nullable(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tier = ctx.user.subscriptionTier || "free";
      const limits = licenseService.getTierLimits(tier);
      const currentLinks = await getUserLinkCount(ctx.user.id);

      if (
        limits.maxLinks !== -1 &&
        currentLinks + input.links.length > limits.maxLinks
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Import would exceed quota.`,
        });
      }

      const results = {
        success: [] as { shortCode: string; originalUrl: string }[],
        failed: [] as { originalUrl: string; error: string }[],
      };

      for (const linkData of input.links) {
        try {
          let shortCode = linkData.shortCode;
          if (!shortCode)
            shortCode = Math.random().toString(36).substring(2, 8);

          const existing = await getLinkByShortCode(shortCode);
          if (existing) shortCode = Math.random().toString(36).substring(2, 8);

          await createLink({
            userId: ctx.user.id,
            originalUrl: linkData.originalUrl,
            shortCode,
            description: linkData.description,
            tags: linkData.tags,
            expiresAt: ensureNullIfEmpty(linkData.expiresAt) ?? undefined,
          });

          results.success.push({
            shortCode,
            originalUrl: linkData.originalUrl,
          });
        } catch (error) {
          results.failed.push({
            originalUrl: linkData.originalUrl,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      return results;
    }),

  export: protectedProcedure
    .input(
      z.object({
        format: z.enum(["json", "csv"]),
        includeStats: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const links = await getLinksByUserId(ctx.user.id);

      if (input.format === "json") {
        return {
          format: "json",
          data: links.map((link: any) => ({
            shortCode: link.shortCode,
            originalUrl: link.originalUrl,
            customDomain: link.customDomain,
            description: link.description,
            isActive: link.isActive,
            isValid: link.isValid,
            clickCount: input.includeStats ? link.clickCount : undefined,
            createdAt: link.createdAt,
            expiresAt: link.expiresAt,
          })),
        };
      } else {
        const headers = [
          "shortCode",
          "originalUrl",
          "customDomain",
          "description",
          "isActive",
          "isValid",
          "createdAt",
        ];
        if (input.includeStats) headers.push("clickCount");

        const csvRows = [headers.join(",")];
        for (const link of links) {
          const row = [
            link.shortCode,
            `"${link.originalUrl.replace(/"/g, '""')}"`,
            link.customDomain || "",
            `"${(link.description || "").replace(/"/g, '""')}"`,
            link.isActive,
            link.isValid,
            link.createdAt?.toISOString() || "",
          ];
          if (input.includeStats) row.push(link.clickCount?.toString() || "0");
          csvRows.push(row.join(","));
        }
        return { format: "csv", data: csvRows.join("\n") };
      }
    }),

  exportLinksCSV: protectedProcedure.query(async ({ ctx }) => {
    const links = await getLinksByUserId(ctx.user.id);
    const headers = [
      "短码",
      "目标网址",
      "点击量",
      "有效状态",
      "启用状态",
      "创建时间",
    ];
    const rows = links.map((link: any) => [
      link.shortCode,
      link.originalUrl,
      link.clickCount,
      link.isValid ? "是" : "否",
      link.isActive ? "启用" : "禁用",
      link.createdAt.toISOString(),
    ]);
    const csvContent = [headers.join(",")]
      .concat(rows.map((row: string[]) => row.join(",")))
      .join("\n");
    return csvContent;
  }),

  exportStatsCSV: protectedProcedure
    .input(z.object({ linkId: z.number() }))
    .query(async ({ ctx, input }) => {
      const link = await getLinkById(input.linkId);
      if (!link || (link.userId !== ctx.user.id && ctx.user.role !== "admin")) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      }
      const stats = await getLinkStatsSummary(input.linkId);
      // Construct a simple CSV from stats
      const headers = ["日期", "点击量"];
      // Use last7Days data
      const rows = Object.entries(stats.last7Days || {}).map(
        ([date, count]) => [date, String(count)]
      );
      const csvContent = [headers.join(",")]
        .concat(rows.map((row: string[]) => row.join(",")))
        .join("\n");
      return csvContent;
    }),

  getByShortCode: publicProcedure
    .input(z.object({ shortCode: z.string() }))
    .query(async ({ input }) => {
      const link = await getLinkByShortCode(input.shortCode);
      if (!link)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      return link;
    }),

  resolveVisitorToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const shortCode = await authService.verifyVisitorToken(input.token);
      if (!shortCode)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: ErrorCodes.SECURITY_TOKEN_INVALID,
        });

      const link = await getLinkByShortCode(shortCode);
      if (!link || !link.isActive || !link.isValid) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_INACTIVE,
        });
      }
      return {
        shortCode: link.shortCode,
        fullUrl: link.customDomain
          ? `https://${link.customDomain}/${link.shortCode}`
          : `${process.env.VITE_APP_ID || "localhost"}/s/${link.shortCode}`,
        expiresAt: link.expiresAt,
        isPasswordProtected: !!link.passwordHash,
      };
    }),

  verifyAccessPassword: publicProcedure
    .input(z.object({ token: z.string(), password: z.string() }))
    .mutation(async ({ input }) => {
      const shortCode = await authService.verifyVisitorToken(input.token);
      if (!shortCode)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: ErrorCodes.SECURITY_TOKEN_INVALID,
        });

      const link = await getLinkByShortCode(shortCode);
      if (!link || !link.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: ErrorCodes.LINK_NOT_PASSWORD_PROTECTED,
        });
      }
      const isValid = await verifyPassword(input.password, link.passwordHash);
      if (!isValid)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: ErrorCodes.AUTH_PASSWORD_INCORRECT,
        });

      return { success: true, originalUrl: link.originalUrl };
    }),

  getByDomainAndCode: publicProcedure
    .input(z.object({ domain: z.string(), shortCode: z.string() }))
    .query(async ({ input }) => {
      const link = await getLinkByDomainAndCode(input.domain, input.shortCode);
      if (!link)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      return link;
    }),

  recordClick: publicProcedure
    .input(
      z.object({
        shortCode: z.string(),
        userAgent: z.string().optional(),
        deviceType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const link = await getLinkByShortCode(input.shortCode);
      if (!link)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });

      const ipAddress = ctx.req?.ip || ctx.req?.connection?.remoteAddress;
      const geoInfo = await resolveGeoIp(ipAddress);

      await updateLinkClickCount(link.id);
      await recordLinkStat({
        linkId: link.id,
        userAgent: input.userAgent,
        deviceType: input.deviceType,
        ipAddress: ipAddress,
        country: geoInfo.country,
        city: geoInfo.city,
      });
      return { success: true };
    }),

  // === Recycle Bin ===

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
