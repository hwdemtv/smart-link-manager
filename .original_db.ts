import { eq, and, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, InsertLink, InsertLinkStat, InsertLinkCheck, InsertNotification, InsertDomain, InsertTenant, InsertSubscription, InsertUsageLog, links, linkStats, linkChecks, notifications, domains, tenants, subscriptionPlans, subscriptions, usageLogs } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "tenantId"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Link management queries
export async function createLink(data: InsertLink) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(links).values(data);
  return result;
}

export async function getLinkByShortCode(shortCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(links).where(eq(links.shortCode, shortCode)).limit(1);
  return result[0];
}

export async function getLinksByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(links).where(eq(links.userId, userId)).orderBy(links.createdAt);
  return result;
}

export async function getLinkById(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(links).where(eq(links.id, linkId)).limit(1);
  return result[0];
}

export async function updateLink(linkId: number, data: Partial<{
  originalUrl: string;
  shortCode: string;
  customDomain: string | null;
  description: string | null;
  isActive: number;
  isValid: number;
  expiresAt: Date | null;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(links).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(links.id, linkId));
  
  return getLinkById(linkId);
}

export async function deleteLink(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 先删除关联的统计数据
  await db.delete(linkStats).where(eq(linkStats.linkId, linkId));
  await db.delete(linkChecks).where(eq(linkChecks.linkId, linkId));
  await db.delete(notifications).where(eq(notifications.linkId, linkId));
  
  // 删除链接
  await db.delete(links).where(eq(links.id, linkId));
}

export async function searchLinks(userId: number, query: {
  search?: string;
  status?: 'all' | 'active' | 'invalid';
  orderBy?: 'createdAt' | 'clickCount' | 'updatedAt';
  order?: 'asc' | 'desc';
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let queryBuilder = db.select().from(links).where(eq(links.userId, userId));
  
  // 搜索条件
  const conditions = [eq(links.userId, userId)];
  
  if (query.search) {
    // 搜索短码或原始URL
    conditions.push(
      or(
        sql`${links.shortCode} LIKE ${`%${query.search}%`}`,
        sql`${links.originalUrl} LIKE ${`%${query.search}%`}`
      )
    );
  }
  
  if (query.status === 'active') {
    conditions.push(eq(links.isValid, 1));
    conditions.push(eq(links.isActive, 1));
  } else if (query.status === 'invalid') {
    conditions.push(eq(links.isValid, 0));
  }
  
  const result = await db.select().from(links).where(and(...conditions));
  
  // 排序
  if (query.orderBy) {
    result.sort((a, b) => {
      const aVal = a[query.orderBy!] ?? 0;
      const bVal = b[query.orderBy!] ?? 0;
      const order = query.order === 'desc' ? -1 : 1;
      if (aVal instanceof Date && bVal instanceof Date) {
        return (aVal.getTime() - bVal.getTime()) * order;
      }
      return ((aVal as number) - (bVal as number)) * order;
    });
  }
  
  return result;
}

export async function getLinkStatsSummary(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const stats = await db.select().from(linkStats).where(eq(linkStats.linkId, linkId));
  
  // 按设备类型统计
  const deviceStats = stats.reduce((acc, stat) => {
    const device = stat.deviceType || 'unknown';
    acc[device] = (acc[device] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // 按日期统计（最近7天）
  const last7Days: Record<string, number> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    last7Days[dateStr] = 0;
  }
  
  stats.forEach(stat => {
    const dateStr = new Date(stat.clickedAt).toISOString().split('T')[0];
    if (last7Days.hasOwnProperty(dateStr)) {
      last7Days[dateStr]++;
    }
  });
  
  return {
    totalClicks: stats.length,
    deviceStats,
    last7Days,
    recentClicks: stats.slice(-10).reverse(),
  };
}

export async function updateLinkClickCount(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const link = await db.select().from(links).where(eq(links.id, linkId)).limit(1);
  if (link.length > 0) {
    await db.update(links).set({ clickCount: (link[0].clickCount || 0) + 1 }).where(eq(links.id, linkId));
  }
}

export async function recordLinkStat(data: InsertLinkStat) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(linkStats).values(data);
}

export async function getLinkStats(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(linkStats).where(eq(linkStats.linkId, linkId));
  return result;
}

export async function recordLinkCheck(data: InsertLinkCheck) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(linkChecks).values(data);
}

export async function updateLinkValidity(linkId: number, isValid: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(links).set({ isValid, lastCheckedAt: new Date() }).where(eq(links.id, linkId));
}

export async function getInvalidLinks() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(links).where(eq(links.isValid, 0));
  return result;
}

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(notifications).values(data);
}

export async function getUnreadNotifications(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(notifications).where(
    and(eq(notifications.userId, userId), eq(notifications.isRead, 0))
  );
  return result;
}

// Domain management queries
export async function addDomain(data: InsertDomain) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(domains).values(data);
}

export async function getUserDomains(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(domains).where(eq(domains.userId, userId));
  return result;
}

export async function getDomainByName(domain: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(domains).where(eq(domains.domain, domain)).limit(1);
  return result[0];
}

export async function verifyDomain(domainId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(domains).set({ isVerified: 1, verifiedAt: new Date() }).where(eq(domains.id, domainId));
}

export async function getLinkByDomainAndCode(domain: string, shortCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(links).where(
    and(eq(links.customDomain, domain), eq(links.shortCode, shortCode))
  ).limit(1);
  return result[0];
}

export async function deleteDomain(domainId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(domains).where(eq(domains.id, domainId));
}



// Tenant management queries
export async function createTenant(data: InsertTenant) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(tenants).values(data);
  return result;
}

export async function getTenantBySlug(slug: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return result[0];
}

export async function getTenantById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result[0];
}

export async function getAllTenants() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(tenants).where(eq(tenants.isActive, 1));
  return result;
}

export async function updateTenant(id: number, data: Partial<InsertTenant>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(tenants).set(data).where(eq(tenants.id, id));
}

export async function deleteTenant(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(tenants).where(eq(tenants.id, id));
}

// Subscription management queries
export async function getSubscriptionPlans() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, 1));
  return result;
}

export async function getSubscriptionPlanById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
  return result[0];
}

export async function createSubscription(data: InsertSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(subscriptions).values(data);
}

export async function getTenantSubscription(tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(subscriptions)
    .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, "active")))
    .limit(1);
  return result[0];
}

export async function updateSubscription(id: number, data: Partial<InsertSubscription>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subscriptions).set(data).where(eq(subscriptions.id, id));
}

// Usage tracking queries
export async function recordUsage(data: InsertUsageLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if usage log for today exists
  const today = new Date().toISOString().split('T')[0];
  const existing = await db.select().from(usageLogs)
    .where(and(eq(usageLogs.tenantId, data.tenantId), eq(usageLogs.date, today)))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing log
    await db.update(usageLogs).set({
      linksCreated: (existing[0].linksCreated || 0) + (data.linksCreated || 0),
      apiCalls: (existing[0].apiCalls || 0) + (data.apiCalls || 0),
      totalClicks: (existing[0].totalClicks || 0) + (data.totalClicks || 0),
    }).where(eq(usageLogs.id, existing[0].id));
  } else {
    // Create new log
    await db.insert(usageLogs).values(data);
  }
}

export async function getTenantUsage(tenantId: number, days: number = 30) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];
  
  const result = await db.select().from(usageLogs)
    .where(and(eq(usageLogs.tenantId, tenantId)))
    .orderBy(usageLogs.date);
  
  return result.filter(log => log.date >= startDateStr);
}


