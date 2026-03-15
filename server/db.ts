import { eq, and, or, sql, desc, asc, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  InsertLink, links,
  InsertLinkStat, linkStats, 
  InsertLinkCheck, linkChecks, 
  InsertNotification, notifications, 
  InsertDomain, domains, 
  InsertTenant, tenants, 
  InsertSubscription, subscriptionPlans, subscriptions, 
  InsertUsageLog, usageLogs,
  InsertTenantConfig, tenantConfigs
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
export let db: ReturnType<typeof drizzle>;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
      db = _db;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// === User Management ===
export async function upsertUser(user: InsertUser) {
  const db = await getDb();
  if (!db) return;
  const updateSet: any = { ...user };
  delete updateSet.openId;
  await db.insert(users).values(user).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUsersByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.tenantId, tenantId)).orderBy(desc(users.createdAt));
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, id));
}

export async function getTenantAdminCount(tenantId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.role, "tenant_admin")));
  return result[0]?.count || 0;
}

// === Link Management ===
export async function createLink(data: InsertLink) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await (db as any).insert(links).values(data);
  return { ...data, id: result.insertId };
}

export async function getLinkByShortCode(shortCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(links).where(eq(links.shortCode, shortCode)).limit(1);
  return result[0];
}

export async function getLinkById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(links).where(eq(links.id, id)).limit(1);
  return result[0];
}

export async function getLinksByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(links).where(eq(links.userId, userId)).orderBy(desc(links.createdAt));
}

export async function getLinksByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(links).where(eq(links.tenantId, tenantId)).orderBy(desc(links.createdAt));
}

export async function updateLink(id: number, data: Partial<InsertLink>) {
  const db = await getDb();
  if (!db) return;
  await db.update(links).set(data).where(eq(links.id, id));
}

export async function deleteLink(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(links).where(eq(links.id, id));
}

export async function batchDeleteLinks(userId: number, ids: number[]) {
  const db = await getDb();
  if (!db || ids.length === 0) return;
  await db.delete(links).where(and(eq(links.userId, userId), inArray(links.id, ids)));
}

export async function batchUpdateLinks(userId: number, ids: number[], data: Partial<InsertLink>) {
  const db = await getDb();
  if (!db || ids.length === 0) return;
  await db.update(links).set(data).where(and(eq(links.userId, userId), inArray(links.id, ids)));
}

export async function batchUpdateLinksTags(userId: number, ids: number[], tags: string[], mode: 'add' | 'remove' | 'set') {
  const db = await getDb();
  if (!db || ids.length === 0) return;
  
  if (mode === 'set') {
    await db.update(links).set({ tags }).where(and(eq(links.userId, userId), inArray(links.id, ids)));
    return;
  }

  // 对于 add 和 remove，需要先拉取现有的标签
  const targetLinks = await db.select({ id: links.id, tags: links.tags }).from(links).where(and(eq(links.userId, userId), inArray(links.id, ids)));
  
  for (const link of targetLinks) {
    let newTags = [...(link.tags || [])];
    if (mode === 'add') {
      newTags = Array.from(new Set([...newTags, ...tags]));
    } else if (mode === 'remove') {
      newTags = newTags.filter(t => !tags.includes(t));
    }
    await db.update(links).set({ tags: newTags }).where(eq(links.id, link.id));
  }
}

export async function searchLinks(userId: number, query: {
  search?: string;
  tag?: string;
  status?: 'all' | 'active' | 'invalid';
  orderBy?: 'createdAt' | 'clickCount' | 'updatedAt';
  order?: 'asc' | 'desc';
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: any[] = [eq(links.userId, userId)];
  
  if (query.search) {
    conditions.push(
      or(
        like(links.shortCode, `%${query.search}%`),
        like(links.originalUrl, `%${query.search}%`),
        like(links.description, `%${query.search}%`)
      )
    );
  }

  if (query.tag) {
    conditions.push(sql`JSON_CONTAINS(${links.tags}, ${`"${query.tag}"`})`);
  }
  
  if (query.status === 'active') {
    conditions.push(eq(links.isValid, 1));
    conditions.push(eq(links.isActive, 1));
  } else if (query.status === 'invalid') {
    conditions.push(eq(links.isValid, 0));
  }
  
  const result = await db.select().from(links).where(and(...conditions));
  
  if (query.orderBy) {
    result.sort((a: any, b: any) => {
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

export async function checkShortCodes(shortCodes: string[]) {
  const db = await getDb();
  if (!db || shortCodes.length === 0) return [];
  const result = await db.select({ shortCode: links.shortCode }).from(links).where(inArray(links.shortCode, shortCodes));
  return result.map((r: any) => r.shortCode);
}

// === Stats and Monitoring ===
export async function updateLinkClickCount(linkId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(links).set({ clickCount: sql`clickCount + 1` }).where(eq(links.id, linkId));
}

export async function recordLinkStat(data: InsertLinkStat) {
  const db = await getDb();
  if (!db) return;
  await db.insert(linkStats).values(data);
}

export async function getLinkStats(linkId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(linkStats).where(eq(linkStats.linkId, linkId)).orderBy(desc(linkStats.clickedAt)).limit(100);
}

export async function getLinkStatsSummary(linkId: number) {
  const db = await getDb();
  if (!db) return { totalClicks: 0, deviceStats: {}, last7Days: {}, recentClicks: [] };
  
  const stats = await db.select().from(linkStats).where(eq(linkStats.linkId, linkId));
  
  const deviceStats = stats.reduce((acc: Record<string, number>, stat: any) => {
    const device = stat.deviceType || 'unknown';
    acc[device] = (acc[device] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const last7Days: Record<string, number> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    last7Days[dateStr] = 0;
  }
  
  stats.forEach((stat: any) => {
    const dateStr = new Date(stat.clickedAt).toISOString().split('T')[0];
    if (last7Days.hasOwnProperty(dateStr)) {
      last7Days[dateStr]++;
    }
  });

  const recentClicks = stats.slice(-10).reverse();
  
  return {
    totalClicks: stats.length,
    deviceStats,
    last7Days,
    recentClicks,
  };
}

export async function getGlobalStatsSummary(tenantId: number, days: number = 7) {
  const db = await getDb();
  if (!db) return { totalLinks: 0, totalClicks: 0, timeSeries: {}, deviceStats: {}, countryStats: {}, cityStats: {}, browserStats: {} };
  
  const linksQuery = await db.select({ 
    id: links.id, 
    clickCount: links.clickCount 
  }).from(links).where(eq(links.tenantId, tenantId));

  const totalLinks = linksQuery.length;
  const totalClicks = linksQuery.reduce((sum: number, link: any) => sum + (link.clickCount || 0), 0);

  const timeSeries: Record<string, number> = {};
  const deviceStats: Record<string, number> = {};
  const countryStats: Record<string, number> = {};
  const cityStats: Record<string, number> = {};
  const browserStats: Record<string, number> = {};

  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    timeSeries[dateStr] = 0;
  }

  if (linksQuery.length === 0) {
    return { totalLinks, totalClicks, timeSeries, deviceStats, countryStats, cityStats, browserStats };
  }

  const linkIds = linksQuery.map((l: any) => l.id);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await db.select().from(linkStats)
    .where(
      and(
        inArray(linkStats.linkId, linkIds),
        sql`${linkStats.clickedAt} >= ${startDate}`
      )
    );

  for (const stat of stats) {
    const dateStr = new Date(stat.clickedAt).toISOString().split('T')[0];
    if (timeSeries[dateStr] !== undefined) {
      timeSeries[dateStr]++;
    }

    const device = stat.deviceType || 'unknown';
    deviceStats[device] = (deviceStats[device] || 0) + 1;

    const country = stat.country || 'Unknown';
    countryStats[country] = (countryStats[country] || 0) + 1;

    const city = stat.city || 'Unknown';
    cityStats[city] = (cityStats[city] || 0) + 1;

    const browser = stat.browserName || 'Unknown';
    browserStats[browser] = (browserStats[browser] || 0) + 1;
  }

  return { totalLinks, totalClicks, timeSeries, deviceStats, countryStats, cityStats, browserStats };
}

export async function recordLinkCheck(data: InsertLinkCheck) {
  const db = await getDb();
  if (!db) return;
  await db.insert(linkChecks).values(data);
}

export async function updateLinkValidity(linkId: number, isValid: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(links).set({ isValid, lastCheckedAt: new Date() }).where(eq(links.id, linkId));
}

export async function getInvalidLinks(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(links).where(and(eq(links.tenantId, tenantId), eq(links.isValid, 0)));
}

// === Notifications ===
export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data);
}

export async function getUnreadNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));
}

// === Domain Management ===
export async function addDomain(data: InsertDomain) {
  const db = await getDb();
  if (!db) return;
  await db.insert(domains).values(data);
}

export async function getUserDomains(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(domains).where(eq(domains.userId, userId));
}

export async function getDomainsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(domains).where(eq(domains.tenantId, tenantId));
}

export async function getDomainByName(domain: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(domains).where(eq(domains.domain, domain)).limit(1);
  return result[0];
}

export async function verifyDomain(domainId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(domains).set({ isVerified: 1, verifiedAt: new Date() }).where(eq(domains.id, domainId));
}

export async function getLinkByDomainAndCode(domain: string, shortCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(links).where(and(eq(links.customDomain, domain), eq(links.shortCode, shortCode))).limit(1);
  return result[0];
}

export async function deleteDomain(domainId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(domains).where(eq(domains.id, domainId));
}

// === Tenant Management ===
export async function createTenant(data: InsertTenant) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await (db as any).insert(tenants).values(data);
  return { ...data, id: result.insertId };
}

export async function getTenantBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return result[0];
}

export async function getTenantById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result[0];
}

export async function getAllTenants() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tenants);
}

export async function updateTenant(id: number, data: Partial<InsertTenant>) {
  const db = await getDb();
  if (!db) return;
  await db.update(tenants).set(data).where(eq(tenants.id, id));
}

export async function deleteTenant(id: number) {
  const db = await getDb();
  if (!db) return;

  // Delete in order to respect foreign key constraints
  // 1. Get all users for this tenant
  const tenantUsers = await db.select({ id: users.id }).from(users).where(eq(users.tenantId, id));
  const userIds = tenantUsers.map((u: any) => u.id);

  // 2. Get all links for this tenant
  const tenantLinks = await db.select({ id: links.id }).from(links).where(eq(links.tenantId, id));
  const linkIds = tenantLinks.map((l: any) => l.id);

  // 3. Delete link stats
  if (linkIds.length > 0) {
    await db.delete(linkStats).where(inArray(linkStats.linkId, linkIds));
  }

  // 4. Delete link checks
  if (linkIds.length > 0) {
    await db.delete(linkChecks).where(inArray(linkChecks.linkId, linkIds));
  }

  // 5. Delete notifications (by tenant)
  await db.delete(notifications).where(eq(notifications.tenantId, id));

  // 6. Delete links
  await db.delete(links).where(eq(links.tenantId, id));

  // 7. Delete domains
  await db.delete(domains).where(eq(domains.tenantId, id));

  // 8. Delete subscriptions
  await db.delete(subscriptions).where(eq(subscriptions.tenantId, id));

  // 9. Delete usage logs
  await db.delete(usageLogs).where(eq(usageLogs.tenantId, id));

  // 10. Delete tenant users
  if (userIds.length > 0) {
    await db.delete(users).where(eq(users.tenantId, id));
  }

  // 11. Finally delete the tenant
  await db.delete(tenants).where(eq(tenants.id, id));
}

// === Subscription Management ===
export async function getSubscriptionPlans() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, 1));
}

export async function getSubscriptionPlanById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
  return result[0];
}

export async function getFreePlan() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.slug, "free")).limit(1);
  return result[0];
}

export async function getTenantSubscription(tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(subscriptions).where(
    and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, "active"))
  ).orderBy(desc(subscriptions.createdAt)).limit(1);
  return result[0];
}

export async function getAllSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
}

export async function getSubscriptionsWithDetails() {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      subscription: subscriptions,
      tenant: tenants,
      plan: subscriptionPlans,
    })
    .from(subscriptions)
    .leftJoin(tenants, eq(subscriptions.tenantId, tenants.id))
    .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .orderBy(desc(subscriptions.createdAt));

  return result;
}

export async function createSubscription(data: InsertSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(subscriptions).values(data);
}

export async function updateSubscription(id: number, data: Partial<InsertSubscription>) {
  const db = await getDb();
  if (!db) return;
  await db.update(subscriptions).set(data).where(eq(subscriptions.id, id));
}

// === Usage tracking ===
export async function recordUsage(data: InsertUsageLog) {
  const db = await getDb();
  if (!db) return;
  const today = new Date().toISOString().split('T')[0];
  const existing = await db.select().from(usageLogs)
    .where(and(eq(usageLogs.tenantId, data.tenantId), eq(usageLogs.date, today)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(usageLogs).set({
      linksCreated: (existing[0].linksCreated || 0) + (data.linksCreated || 0),
      apiCalls: (existing[0].apiCalls || 0) + (data.apiCalls || 0),
      totalClicks: (existing[0].totalClicks || 0) + (data.totalClicks || 0),
    }).where(eq(usageLogs.id, existing[0].id));
  } else {
    await db.insert(usageLogs).values(data);
  }
}

export async function getTenantUsage(tenantId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];
  return db.select().from(usageLogs)
    .where(and(eq(usageLogs.tenantId, tenantId), sql`${usageLogs.date} >= ${startDateStr}`))
    .orderBy(usageLogs.date);
}

export async function getTenantLinkCount(tenantId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(links).where(eq(links.tenantId, tenantId));
  return result[0]?.count || 0;
}
// === Tenant Config Management ===
export async function getTenantConfig(tenantId: number, configKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tenantConfigs)
    .where(and(eq(tenantConfigs.tenantId, tenantId), eq(tenantConfigs.configKey, configKey)))
    .limit(1);
  return result[0];
}

export async function upsertTenantConfig(tenantId: number, configKey: string, value: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getTenantConfig(tenantId, configKey);
  if (existing) {
    await db.update(tenantConfigs)
      .set({ configValue: value, updatedAt: new Date() })
      .where(eq(tenantConfigs.id, existing.id));
  } else {
    await db.insert(tenantConfigs).values({
      tenantId,
      configKey,
      configValue: value
    });
  }
}
