import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { tenantRouter } from "./tenantRouter";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
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
  getLinkStats,
  recordLinkCheck,
  updateLinkValidity,
  getInvalidLinks,
  createNotification,
  getUnreadNotifications,
  addDomain,
  getUserDomains,
  getDomainByName,
  verifyDomain,
  getLinkByDomainAndCode,
  deleteDomain,
} from "./db";

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
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify domain ownership if custom domain is provided
        if (input.customDomain) {
          const domain = await getDomainByName(input.customDomain);
          if (!domain || domain.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Domain not found or not owned by you",
            });
          }
          if (!domain.isVerified) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Domain not verified",
            });
          }
        }

        // Check if short code already exists for this domain
        if (input.customDomain) {
          const existing = await getLinkByDomainAndCode(input.customDomain, input.shortCode);
          if (existing) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Short code already exists for this domain",
            });
          }
        } else {
          const existing = await getLinkByShortCode(input.shortCode);
          if (existing) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Short code already exists",
            });
          }
        }

        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "User must belong to a tenant",
          });
        }

        const link = await createLink({
          tenantId: ctx.user.tenantId,
          userId: ctx.user.id,
          originalUrl: input.originalUrl,
          shortCode: input.shortCode,
          customDomain: input.customDomain,
          description: input.description,
          expiresAt: input.expiresAt,
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

    // Get all links for the user
    list: protectedProcedure.query(async ({ ctx }) => {
      const links = await getLinksByUserId(ctx.user.id);
      return links.map(link => ({
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
        status: z.enum(['all', 'active', 'invalid']).optional(),
        orderBy: z.enum(['createdAt', 'clickCount', 'updatedAt']).optional(),
        order: z.enum(['asc', 'desc']).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const links = await searchLinks(ctx.user.id, {
          search: input.query,
          status: input.status,
          orderBy: input.orderBy,
          order: input.order,
        });
        return links.map(link => ({
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
        if (!link || link.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Link not found",
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
      }))
      .mutation(async ({ ctx, input }) => {
        const link = await getLinkById(input.linkId);
        if (!link || link.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Link not found",
          });
        }

        // 如果更新短码，检查冲突
        if (input.shortCode && input.shortCode !== link.shortCode) {
          const existing = await getLinkByShortCode(input.shortCode);
          if (existing) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Short code already exists",
            });
          }
        }

        const updated = await updateLink(input.linkId, {
          originalUrl: input.originalUrl,
          shortCode: input.shortCode,
          customDomain: input.customDomain,
          description: input.description,
          isActive: input.isActive,
          expiresAt: input.expiresAt,
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
        if (!link || link.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Link not found",
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
            message: "Link not found",
          });
        }
        return getLinkStatsSummary(input.linkId);
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
            message: "User must belong to a tenant",
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
          } catch (error: any) {
            results.failed.push({
              originalUrl: linkData.originalUrl,
              error: error.message || "Unknown error",
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
            data: links.map(link => ({
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
            message: "Link not found",
          });
        }
        return link;
      }),

    // Get link by domain and short code
    getByDomainAndCode: publicProcedure
      .input(z.object({ domain: z.string(), shortCode: z.string() }))
      .query(async ({ input }) => {
        const link = await getLinkByDomainAndCode(input.domain, input.shortCode);
        if (!link) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Link not found",
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
      .mutation(async ({ input }) => {
        const link = await getLinkByShortCode(input.shortCode);
        if (!link) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Link not found",
          });
        }

        await updateLinkClickCount(link.id);
        await recordLinkStat({
          linkId: link.id,
          userAgent: input.userAgent,
          deviceType: input.deviceType,
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
      const invalid = await getInvalidLinks();
      return invalid.filter(link => link.userId === ctx.user.id);
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
            message: "User must belong to a tenant",
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
            message: "Domain already registered",
          });
        }

        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "User must belong to a tenant",
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

    // Get user's domains
    list: protectedProcedure.query(async ({ ctx }) => {
      const domains = await getUserDomains(ctx.user.id);
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

  tenant: tenantRouter,
});

export type AppRouter = typeof appRouter;
