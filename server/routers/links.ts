import crypto from "node:crypto";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ErrorCodes } from "@shared/errorCodes";
import {
  createLinkSchema,
  updateLinkSchema,
  searchLinksSchema,
} from "@shared/validators/links";
import { hashPassword, verifyPassword } from "../_core/auth";
import { ensureNullIfEmpty } from "../_core/utils";
import { licenseService } from "../licenseService";
import { generateSeoFromUrl } from "../aiSeoService";
import { clearSitemapCache } from "../seoHandler";
import { authService } from "../_core/sdk";
import { resolveGeoIp } from "../geoIpResolver";
import type { Link } from "../../drizzle/schema";
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
  getUserMonthlyLinkCount,
  recordUsage,
  getDomainByName,
  getLinkByDomainAndCode,
  getDeletedLinks,
  softDeleteLink,
  restoreLink,
  permanentDeleteLink,
  emptyRecycleBin,
  recordLinkCheck,
  updateLinkValidity,
} from "../db";
import { checkLinkValidity } from "../linkChecker";

/**
 * 生成安全的随机短码（使用 crypto.randomBytes）
 * 避免 Math.random() 的可预测性和冲突风险
 */
function generateSecureShortCode(length: number = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomBytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

export const linksRouter = router({
  create: protectedProcedure
    .input(createLinkSchema)
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
      let tier = ctx.user.subscriptionTier || "free";
      
      // 关键修复 (Issue 授权失效)：检查授权是否过期
      if (tier !== "free" && !licenseService.isSubscriptionValid(ctx.user.licenseExpiresAt)) {
        tier = "free";
      }

      const limits = licenseService.getTierLimits(tier);
      const currentLinks = await getUserLinkCount(ctx.user.id);

      // 总量限制检查
      if (limits.maxLinks !== -1 && currentLinks >= limits.maxLinks) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Quota exceeded: Maximum ${limits.maxLinks} links for your current plan. Please upgrade your subscription.`,
        });
      }

      // 每月创建限制检查（仅 Business 用户）
      if (limits.monthlyLinksCreated !== -1) {
        const monthlyLinks = await getUserMonthlyLinkCount(ctx.user.id);
        if (monthlyLinks >= limits.monthlyLinksCreated) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Monthly limit exceeded: You have created ${monthlyLinks} links this month. Maximum is ${limits.monthlyLinksCreated}. Please wait for next month or contact support.`,
          });
        }
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
          // SEO 基础字段
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
          seoImage: input.seoImage,
          // SEO 高级字段
          seoPriority: input.seoPriority,
          noIndex: input.noIndex,
          redirectType: input.redirectType,
          seoKeywords: input.seoKeywords,
          canonicalUrl: input.canonicalUrl,
          ogVideoUrl: input.ogVideoUrl,
          ogVideoWidth: input.ogVideoWidth,
          ogVideoHeight: input.ogVideoHeight,
          // A/B 测试
          abTestEnabled: input.abTestEnabled,
          abTestUrl: input.abTestUrl,
          abTestRatio: input.abTestRatio,
          groupId: input.groupId,
          // 社交分享
          shareSuffix: input.shareSuffix,
        });
      } catch (error) {
        // 捕获唯一键冲突 (MySQL Error 1062)
        const dbError = error as { code?: string; message?: string };
        if (dbError.code === "ER_DUP_ENTRY" || dbError.message?.includes("Duplicate entry")) {
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

      // 清除 sitemap 缓存
      clearSitemapCache();

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
    return links.map((link: Link) => ({
      ...link,
      fullUrl: link.customDomain
        ? `https://${link.customDomain}/${link.shortCode}`
        : `${process.env.VITE_APP_ID || "localhost"}/s/${link.shortCode}`,
    }));
  }),

  search: protectedProcedure
    .input(searchLinksSchema)
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
        links: result.links.map((link: Link) => ({
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
    .input(updateLinkSchema)
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
        // SEO 基础字段
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        seoImage: input.seoImage,
        // SEO 高级字段
        seoPriority: input.seoPriority,
        noIndex: input.noIndex,
        redirectType: input.redirectType,
        seoKeywords: input.seoKeywords,
        canonicalUrl: input.canonicalUrl,
        ogVideoUrl: input.ogVideoUrl,
        ogVideoWidth: input.ogVideoWidth,
        ogVideoHeight: input.ogVideoHeight,
        // A/B 测试
        abTestEnabled: input.abTestEnabled,
        abTestUrl: input.abTestUrl,
        abTestRatio: input.abTestRatio,
        groupId: input.groupId,
        // 社交分享
        shareSuffix: input.shareSuffix,
      });

      // 清除 sitemap 缓存
      clearSitemapCache();

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
    .input(
      z.object({
        url: z.string().url(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const seoData = await generateSeoFromUrl(input.url, input.description);
        return { ...seoData };
      } catch (error) {
        const err = error as { message?: string };
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message || "SEO generation failed",
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
          groupId: z.number().nullable().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 构建更新数据，处理 expiresAt 从 string 到 Date 的转换
      const updateData: { isActive?: number; expiresAt?: Date | null; customDomain?: string | null; groupId?: number | null } = {};

      if (input.data.isActive !== undefined) {
        updateData.isActive = input.data.isActive;
      }

      if (input.data.expiresAt !== undefined) {
        const expiresAt = ensureNullIfEmpty(input.data.expiresAt);
        updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
      }

      if (input.data.customDomain !== undefined) {
        updateData.customDomain = input.data.customDomain || null;
      }

      if (input.data.groupId !== undefined) {
        updateData.groupId = input.data.groupId;
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

  checkValidity: protectedProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const link = await getLinkById(input.linkId);
      if (!link || (link.userId !== ctx.user.id && ctx.user.role !== "admin")) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: ErrorCodes.LINK_NOT_FOUND,
        });
      }

      const result = await checkLinkValidity(link.originalUrl);
      
      // 记录检查历史
      await recordLinkCheck({
        linkId: link.id,
        isValid: result.isValid ? 1 : 0,
        statusCode: result.statusCode,
        errorMessage: result.errorMessage,
      });

      // 同步有效性状态
      await updateLinkValidity(link.id, result.isValid ? 1 : 0);

      return { success: true, isValid: result.isValid };
    }),

  batchCheckValidity: protectedProcedure
    .input(z.object({ linkIds: z.array(z.number()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const results = [];
      for (const linkId of input.linkIds) {
        const link = await getLinkById(linkId);
        if (link && (link.userId === ctx.user.id || ctx.user.role === "admin")) {
          const res = await checkLinkValidity(link.originalUrl);
          
          await recordLinkCheck({
            linkId: link.id,
            isValid: res.isValid ? 1 : 0,
            statusCode: res.statusCode,
            errorMessage: res.errorMessage,
          });

          await updateLinkValidity(link.id, res.isValid ? 1 : 0);
          results.push({ linkId, isValid: res.isValid });
          
          // 短暂间隔防止并发限制
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      return { success: true, results };
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

      // 预生成所有需要的短码，避免重复生成相同的随机码
      const usedCodes = new Set<string>();
      const linksToCreate = input.links.map(linkData => {
        let shortCode = linkData.shortCode;
        if (!shortCode) {
          // 使用 crypto 生成安全的随机短码
          shortCode = generateSecureShortCode(6);
          // 确保在此批次内不重复
          while (usedCodes.has(shortCode)) {
            shortCode = generateSecureShortCode(6);
          }
        }
        usedCodes.add(shortCode);
        return {
          ...linkData,
          shortCode,
        };
      });

      // 批量检查哪些短码已存在
      const allShortCodes = linksToCreate.map(l => l.shortCode);
      const existingCodes = await checkShortCodes(allShortCodes);
      const existingSet = new Set(existingCodes);

      for (const linkData of linksToCreate) {
        try {
          let shortCode = linkData.shortCode;
          let attempts = 0;
          const maxAttempts = 5;

          // 如果短码已存在，尝试生成新的（最多重试5次）
          while (existingSet.has(shortCode) && attempts < maxAttempts) {
            shortCode = generateSecureShortCode(6);
            // 检查新生成的短码是否在此批次或数据库中已存在
            if (!usedCodes.has(shortCode)) {
              const exists = await getLinkByShortCode(shortCode);
              if (!exists) break;
            }
            attempts++;
          }

          // 尝试创建，依赖数据库唯一索引保证原子性
          try {
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
            // 捕获数据库唯一索引冲突 (ER_DUP_ENTRY)
            const dbError = error as { code?: string; message?: string };
            if (dbError.code === "ER_DUP_ENTRY" || dbError.message === "SHORT_CODE_EXISTS") {
              results.failed.push({
                originalUrl: linkData.originalUrl,
                error: `短码 "${shortCode}" 已被占用`,
              });
            } else {
              throw error;
            }
          }
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
          data: links.map((link: Link) => ({
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
    const rows = links.map((link: Link) => [
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

  // === Count ===
  /**
   * 获取用户链接计数（包含分组计数）
   * 用于侧边栏显示各分组的链接数量
   */
  count: protectedProcedure.query(async ({ ctx }) => {
    const total = await getUserLinkCount(ctx.user.id);
    return { total };
  }),
});
