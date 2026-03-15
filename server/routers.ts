import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { tenantRouter } from "./tenantRouter";
import { authService } from "./_core/sdk";
import { generateSeoFromUrl } from "./aiSeoService";
import { z } from "zod";
import { resolveGeoIp } from "./geoIpResolver";
import { TRPCError } from "@trpc/server";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { ErrorCodes } from "@shared/errorCodes";
import { promisify } from "util";
import {
  createLink,
  getLinkByShortCode,
  getLinksByUserId,
  getLinksByTenant,
  getLinkById,
  updateLink,
  deleteLink,
  searchLinks,
  getLinkStatsSummary,
  updateLinkClickCount,
  recordLinkStat,
  getLinkStats,
  recordLinkCheck,
  updateLinkValidity,
  getInvalidLinks,
  createNotification,
  getUnreadNotifications,
  addDomain,
  getUserDomains,
  getDomainsByTenant,
  getDomainByName,
  verifyDomain,
  getLinkByDomainAndCode,
  deleteDomain,
  getUserByUsername,
  upsertUser,
  getTenantBySlug,
  createTenant,
  checkShortCodes,
  getGlobalStatsSummary,
  batchDeleteLinks,
  batchUpdateLinks,
  batchUpdateLinksTags,
  getTenantConfig,
  upsertTenantConfig,
} from "./db";
import { apiKeyService } from "./apiKeyService";

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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),

    // 用户名密码登录
    login: publicProcedure
      .input(z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        console.log(`[LOGIN] Attempt for username: ${input.username}`);
        const user = await getUserByUsername(input.username);
        console.log(`[LOGIN] User fetched:`, user);
        
        if (!user || !user.passwordHash) {
          console.error(`[LOGIN] User not found or no password hash for: ${input.username}`);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: ErrorCodes.AUTH_INVALID_CREDENTIALS,
          });
        }

        const valid = await verifyPassword(input.password, user.passwordHash);
        console.log(`[LOGIN] Password valid: ${valid}`);
        if (!valid) {
          console.error(`[LOGIN] Password verification failed for: ${input.username}`);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: ErrorCodes.AUTH_INVALID_CREDENTIALS,
          });
        }

        // 签发 JWT Session Token
        const sessionToken = await authService.createSessionToken(user.openId, {
          name: user.name || user.username || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        // 更新最后登录时间
        await upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });

        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
          },
        };
      }),

    // 用户注册
    register: publicProcedure
      .input(z.object({
        username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/, ErrorCodes.AUTH_USERNAME_FORMAT),
        password: z.string().min(6).max(128),
        name: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 检查用户名是否已存在
        const existing = await getUserByUsername(input.username);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: ErrorCodes.AUTH_USERNAME_EXISTS,
          });
        }

        const passwordHash = await hashPassword(input.password);
        const openId = `user-${randomBytes(12).toString("hex")}`;

        // 确保默认租户存在
        let tenant = await getTenantBySlug("default");
        if (!tenant) {
          await createTenant({
            name: "Default Tenant",
            slug: "default",
            isActive: 1,
          });
          tenant = await getTenantBySlug("default");
        }

        await upsertUser({
          openId,
          username: input.username,
          passwordHash,
          name: input.name || input.username,
          role: "user",
          tenantId: tenant?.id,
          lastSignedIn: new Date(),
        });

        // 签发 JWT Session Token 自动登录
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
          },
        };
      }),
  }),

  links: router({
    // Create a new short link
    create: protectedProcedure
      .input(
        z.object({
          originalUrl: z.string().url(),
          shortCode: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/),
          customDomain: z.string().optional(),
          description: z.string().optional(),
          expiresAt: z.date().optional(),
          password: z.string().optional(),
          tags: z.array(z.string()).optional(),
          seoTitle: z.string().optional(),
          seoDescription: z.string().optional(),
          seoImage: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify domain ownership if custom domain is provided
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

        // Check if short code already exists for this domain
        if (input.customDomain) {
          const existing = await getLinkByDomainAndCode(input.customDomain, input.shortCode);
          if (existing) {
            throw new TRPCError({
              code: "CONFLICT",
              message: ErrorCodes.LINK_SHORT_CODE_DOMAIN_EXISTS,
            });
          }
        } else {
          const existing = await getLinkByShortCode(input.shortCode);
          if (existing) {
            throw new TRPCError({
              code: "CONFLICT",
              message: ErrorCodes.LINK_SHORT_CODE_EXISTS,
            });
          }
        }

        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: ErrorCodes.FORBIDDEN_NO_TENANT,
          });
        }

        const passwordHash = input.password ? await hashPassword(input.password) : null;

        const link = await createLink({
          tenantId: ctx.user.tenantId,
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

    // Get all links for the user (or tenant if tenant admin)
    list: protectedProcedure.query(async ({ ctx }) => {
      // Tenant admin can see all links in their tenant
      // Regular user only sees their own links
      const links = (ctx.user.role === "tenant_admin" || ctx.user.role === "admin") && ctx.user.tenantId
        ? await getLinksByTenant(ctx.user.tenantId)
        : await getLinksByUserId(ctx.user.id);

      return links.map((link: any) => ({
        ...link,
        fullUrl: link.customDomain
          ? `https://${link.customDomain}/${link.shortCode}`
          : `${process.env.VITE_APP_ID || "localhost"}/s/${link.shortCode}`,
      }));
    }),

    // Search links
    search: protectedProcedure
      .input(z.object({
        query: z.string().optional(),
        tag: z.string().optional(),
        status: z.enum(['all', 'active', 'invalid']).optional(),
        orderBy: z.enum(['createdAt', 'clickCount', 'updatedAt']).optional(),
        order: z.enum(['asc', 'desc']).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const links = await searchLinks(ctx.user.id, {
          search: input.query,
          tag: input.tag,
          status: input.status,
          orderBy: input.orderBy,
          order: input.order,
        });
        return links.map((link: any) => ({
          ...link,
          fullUrl: link.customDomain
            ? `https://${link.customDomain}/${link.shortCode}`
            : `${process.env.VITE_APP_ID || "localhost"}/s/${link.shortCode}`,
        }));
      }),

    // Get link by ID
    getById: protectedProcedure
      .input(z.object({ linkId: z.number() }))
      .query(async ({ ctx, input }) => {
        const link = await getLinkById(input.linkId);
        if (!link) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: ErrorCodes.LINK_NOT_FOUND,
          });
        }
        // Tenant admin can access any link in their tenant
        // Regular user can only access their own links
        const canAccess = ctx.user.role === "admin" ||
          (ctx.user.role === "tenant_admin" && link.tenantId === ctx.user.tenantId) ||
          link.userId === ctx.user.id;

        if (!canAccess) {
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

    // Update a link
    update: protectedProcedure
      .input(z.object({
        linkId: z.number(),
        originalUrl: z.string().url().optional(),
        shortCode: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/).optional(),
        customDomain: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        isActive: z.number().min(0).max(1).optional(),
        expiresAt: z.date().nullable().optional(),
        password: z.string().nullable().optional(),
        tags: z.array(z.string()).nullable().optional(),
        seoTitle: z.string().nullable().optional(),
        seoDescription: z.string().nullable().optional(),
        seoImage: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const link = await getLinkById(input.linkId);
        if (!link) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: ErrorCodes.LINK_NOT_FOUND,
          });
        }

        // Tenant admin can update any link in their tenant
        // Regular user can only update their own links
        const canUpdate = ctx.user.role === "admin" ||
          (ctx.user.role === "tenant_admin" && link.tenantId === ctx.user.tenantId) ||
          link.userId === ctx.user.id;

        if (!canUpdate) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: ErrorCodes.LINK_NOT_FOUND,
          });
        }

        // 如果更新短码，检查冲突
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
          passwordHash = input.password ? await hashPassword(input.password) : null;
        }

        const updated = await updateLink(input.linkId, {
          originalUrl: input.originalUrl,
          shortCode: input.shortCode,
          customDomain: input.customDomain,
          description: input.description,
          isActive: input.isActive,
          expiresAt: input.expiresAt,
          passwordHash,
          tags: input.tags === undefined ? undefined : (input.tags || []),
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
          seoImage: input.seoImage,
        });

        return {
          success: true,
          link: updated,
        };
      }),

    // Delete a link
    delete: protectedProcedure
      .input(z.object({ linkId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const link = await getLinkById(input.linkId);
        if (!link) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: ErrorCodes.LINK_NOT_FOUND,
          });
        }

        // Tenant admin can delete any link in their tenant
        // Regular user can only delete their own links
        const canDelete = ctx.user.role === "admin" ||
          (ctx.user.role === "tenant_admin" && link.tenantId === ctx.user.tenantId) ||
          link.userId === ctx.user.id;

        if (!canDelete) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: ErrorCodes.LINK_NOT_FOUND,
          });
        }

        await deleteLink(input.linkId);
        return { success: true };
      }),

    // Get link statistics summary
    getStatsSummary: protectedProcedure
      .input(z.object({ linkId: z.number() }))
      .query(async ({ ctx, input }) => {
        const link = await getLinkById(input.linkId);
        if (!link || link.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: ErrorCodes.LINK_NOT_FOUND,
          });
        }
        return getLinkStatsSummary(input.linkId);
      }),

    // Get global statistics overview for dashboard
    globalStats: protectedProcedure
      .input(z.object({ days: z.number().default(7) }).optional())
      .query(async ({ ctx, input }) => {
        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: ErrorCodes.FORBIDDEN_NO_TENANT,
          });
        }
        return await getGlobalStatsSummary(ctx.user.tenantId, input?.days || 7);
      }),

    // Check if short codes are already taken
    checkShortCodes: protectedProcedure
      .input(z.object({
        shortCodes: z.array(z.string()),
      }))
      .query(async ({ input }) => {
        return await checkShortCodes(input.shortCodes);
      }),

    // Generate SEO via AI
    generateSeo: protectedProcedure
      .input(z.object({
        url: z.string().url(),
      }))
      .mutation(async ({ input }) => {
        try {
          const seoData = await generateSeoFromUrl(input.url);
          return { success: true, ...seoData };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "智能提炼 SEO 失败，请检查目标链接是否可访问",
          });
        }
      }),

    // Batch delete links
    batchDelete: protectedProcedure
      .input(z.object({ linkIds: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        await batchDeleteLinks(ctx.user.id, input.linkIds);
        return { success: true };
      }),

    // Batch update links (status, expiry, domain)
    batchUpdate: protectedProcedure
      .input(z.object({
        linkIds: z.array(z.number()),
        data: z.object({
          isActive: z.number().int().min(0).max(1).optional(),
          expiresAt: z.string().optional().nullable(),
          customDomain: z.string().optional(),
        })
      }))
      .mutation(async ({ ctx, input }) => {
        const updateData: any = { ...input.data };
        if (updateData.expiresAt) {
          updateData.expiresAt = new Date(updateData.expiresAt);
        }
        await batchUpdateLinks(ctx.user.id, input.linkIds, updateData);
        return { success: true };
      }),

    // Batch update links tags
    batchUpdateTags: protectedProcedure
      .input(z.object({
        linkIds: z.array(z.number()),
        tags: z.array(z.string()),
        mode: z.enum(['add', 'remove', 'set'])
      }))
      .mutation(async ({ ctx, input }) => {
        await batchUpdateLinksTags(ctx.user.id, input.linkIds, input.tags, input.mode);
        return { success: true };
      }),

    // Batch import links
    batchImport: protectedProcedure
      .input(z.object({
        links: z.array(z.object({
          originalUrl: z.string().url(),
          shortCode: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/).optional(),
          description: z.string().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: ErrorCodes.FORBIDDEN_NO_TENANT,
          });
        }

        const results = {
          success: [] as { shortCode: string; originalUrl: string }[],
          failed: [] as { originalUrl: string; error: string }[],
        };

        for (const linkData of input.links) {
          try {
            // 生成短码或使用自定义短码
            let shortCode = linkData.shortCode;
            if (!shortCode) {
              // 自动生成 6 位短码
              shortCode = Math.random().toString(36).substring(2, 8);
            }

            // 检查短码是否已存在
            const existing = await getLinkByShortCode(shortCode);
            if (existing) {
              // 如果短码已存在，自动生成新的
              shortCode = Math.random().toString(36).substring(2, 8);
            }

            await createLink({
              tenantId: ctx.user.tenantId,
              userId: ctx.user.id,
              originalUrl: linkData.originalUrl,
              shortCode,
              description: linkData.description,
            });

            results.success.push({ shortCode, originalUrl: linkData.originalUrl });
          } catch (error) {
            results.failed.push({
              originalUrl: linkData.originalUrl,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        return results;
      }),

    // Export links
    export: protectedProcedure
      .input(z.object({
        format: z.enum(["json", "csv"]),
        includeStats: z.boolean().optional(),
      }))
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
          // CSV format
          const headers = ["shortCode", "originalUrl", "customDomain", "description", "isActive", "isValid", "createdAt"];
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

          return {
            format: "csv",
            data: csvRows.join("\n"),
          };
        }
      }),

    // Get link by short code
    getByShortCode: publicProcedure
      .input(z.object({ shortCode: z.string() }))
      .query(async ({ input }) => {
        const link = await getLinkByShortCode(input.shortCode);
        if (!link) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: ErrorCodes.LINK_NOT_FOUND,
          });
        }
        return link;
      }),

    // Resolve a visitor token to get scan info (PC Verification Gateway)
    resolveVisitorToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const shortCode = await authService.verifyVisitorToken(input.token);
        if (!shortCode) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: ErrorCodes.SECURITY_TOKEN_INVALID,
          });
        }

        const link = await getLinkByShortCode(shortCode);
        if (!link || !link.isActive || !link.isValid) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: ErrorCodes.LINK_INACTIVE,
          });
        }

        const fullUrl = link.customDomain
          ? `https://${link.customDomain}/${link.shortCode}`
          : `${process.env.VITE_APP_ID || "localhost"}/s/${link.shortCode}`;

        return {
          shortCode: link.shortCode,
          fullUrl,
          expiresAt: link.expiresAt,
          isPasswordProtected: !!link.passwordHash,
        };
      }),

    // Verify access password for a link
    verifyAccessPassword: publicProcedure
      .input(z.object({
        token: z.string(), // Visitor token
        password: z.string(),
      }))
      .mutation(async ({ input }) => {
        const shortCode = await authService.verifyVisitorToken(input.token);
        if (!shortCode) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: ErrorCodes.SECURITY_TOKEN_INVALID,
          });
        }

        const link = await getLinkByShortCode(shortCode);
        if (!link || !link.passwordHash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: ErrorCodes.LINK_NOT_PASSWORD_PROTECTED,
          });
        }

        const isValid = await verifyPassword(input.password, link.passwordHash);
        if (!isValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: ErrorCodes.AUTH_PASSWORD_INCORRECT,
          });
        }

        // Return a short-lived access token specifically for this link
        // Reuse VisitorToken logic but we could make a specific one if needed.
        // For now, if password is correct, frontend can just use the result.
        return {
          success: true,
          originalUrl: link.originalUrl, // Only return originalUrl after password verification
        };
      }),

    // Get link by domain and short code
    getByDomainAndCode: publicProcedure
      .input(z.object({ domain: z.string(), shortCode: z.string() }))
      .query(async ({ input }) => {
        const link = await getLinkByDomainAndCode(input.domain, input.shortCode);
        if (!link) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: ErrorCodes.LINK_NOT_FOUND,
          });
        }
        return link;
      }),

    // Record a click
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
        if (!link) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: ErrorCodes.LINK_NOT_FOUND,
          });
        }

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

    // Get statistics for a link
    getStats: protectedProcedure
      .input(z.object({ linkId: z.number() }))
      .query(async ({ ctx, input }) => {
        const stats = await getLinkStats(input.linkId);
        return stats;
      }),

    // Get invalid links
    getInvalid: protectedProcedure.query(async ({ ctx }) => {
      const invalid = await getInvalidLinks(ctx.user.id);
      return invalid;
    }),

    // Get notifications
    getNotifications: protectedProcedure.query(async ({ ctx }) => {
      const notifications = await getUnreadNotifications(ctx.user.id);
      return notifications;
    }),

    // Create a notification
    createNotification: protectedProcedure
      .input(
        z.object({
          linkId: z.number(),
          type: z.string(),
          title: z.string(),
          message: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: ErrorCodes.FORBIDDEN_NO_TENANT,
          });
        }

        await createNotification({
          tenantId: ctx.user.tenantId,
          userId: ctx.user.id,
          linkId: input.linkId,
          type: input.type,
          title: input.title,
          message: input.message,
        });

        return { success: true };
      }),
  }),

  domains: router({
    // Add a new custom domain
    add: protectedProcedure
      .input(
        z.object({
          domain: z.string().min(3).regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
          verificationMethod: z.enum(["cname", "txt", "file"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Check if domain already exists
        const existing = await getDomainByName(input.domain);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: ErrorCodes.DOMAIN_ALREADY_REGISTERED,
          });
        }

        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: ErrorCodes.FORBIDDEN_NO_TENANT,
          });
        }

        const verificationToken = Math.random().toString(36).substring(2, 15);
        await addDomain({
          tenantId: ctx.user.tenantId,
          userId: ctx.user.id,
          domain: input.domain,
          isVerified: 0,
          verificationToken,
          verificationMethod: input.verificationMethod || "cname",
        });

        return {
          success: true,
          domain: input.domain,
          verificationToken,
          verificationMethod: input.verificationMethod || "cname",
        };
      }),

    // Get user's domains (or tenant's domains if tenant admin)
    list: protectedProcedure.query(async ({ ctx }) => {
      // Tenant admin can see all domains in their tenant
      // Regular user only sees their own domains
      const domains = (ctx.user.role === "tenant_admin" || ctx.user.role === "admin") && ctx.user.tenantId
        ? await getDomainsByTenant(ctx.user.tenantId)
        : await getUserDomains(ctx.user.id);
      return domains;
    }),

    // Verify a domain
    verify: protectedProcedure
      .input(
        z.object({
          domainId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // TODO: Implement actual DNS verification logic
        // For now, just mark as verified
        await verifyDomain(input.domainId);
        return { success: true };
      }),

    // Delete a domain
    delete: protectedProcedure
      .input(
        z.object({
          domainId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await deleteDomain(input.domainId);
        return { success: true };
      }),
  }),

  apiKeys: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return apiKeyService.listKeys(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "User must belong to a tenant to generate API keys",
          });
        }
        return apiKeyService.generateKey(ctx.user.tenantId, ctx.user.id, input.name);
      }),
    generateSeo: protectedProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        return generateSeoFromUrl(input.url, ctx.user.tenantId || undefined);
      }),
    revoke: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return apiKeyService.revokeKey(input.id, ctx.user.id);
      }),
  }),

  configs: router({
    getAiConfig: protectedProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant required" });
        }
        const config = await getTenantConfig(ctx.user.tenantId, "ai_model_config");
        return (config?.configValue as any) || null;
      }),
    
    updateAiConfig: protectedProcedure
      .input(z.object({
        provider: z.string().default("openai"),
        baseUrl: z.string().optional(),
        apiKey: z.string().optional(),
        model: z.string().default("gpt-4o"),
        temperature: z.number().min(0).max(2).default(0.3),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant required" });
        }
        await upsertTenantConfig(ctx.user.tenantId, "ai_model_config", input);
        return { success: true };
      }),
  }),

  tenant: tenantRouter,
});

export type AppRouter = typeof appRouter;
