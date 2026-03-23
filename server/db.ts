import { eq, and, or, sql, desc, asc, inArray, like, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  InsertLink, links,
  InsertLinkStat, linkStats,
  InsertLinkCheck, linkChecks,
  InsertNotification, notifications,
  InsertDomain, domains,
  InsertUsageLog, usageLogs,
  InsertAuditLog, auditLogs,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
export let db: ReturnType<typeof drizzle>;

/**
 * Escape special characters for LIKE queries to prevent SQL injection
 * Characters: % (match any), _ (match single), \ (escape char)
 */
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

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

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) return;

  // Get all links for this user
  const userLinks = await db.select({ id: links.id }).from(links).where(eq(links.userId, id));
  const linkIds = userLinks.map((l: any) => l.id);

  // Delete link stats
  if (linkIds.length > 0) {
    await db.delete(linkStats).where(inArray(linkStats.linkId, linkIds));
    await db.delete(linkChecks).where(inArray(linkChecks.linkId, linkIds));
    await db.delete(notifications).where(inArray(notifications.linkId, linkIds));
  }

  // Delete links
  await db.delete(links).where(eq(links.userId, id));

  // Delete domains
  await db.delete(domains).where(eq(domains.userId, id));

  // Delete usage logs
  await db.delete(usageLogs).where(eq(usageLogs.userId, id));

  // Delete user
  await db.delete(users).where(eq(users.id, id));
}

export async function getAllUsers(limit: number = 20, offset: number = 0, search?: string) {
  const db = await getDb();
  if (!db) return { users: [], total: 0 };

  const conditions: any[] = [];
  if (search) {
    const escapedSearch = escapeLikePattern(search);
    conditions.push(
      or(
        like(users.username, `%${escapedSearch}%`),
        like(users.name, `%${escapedSearch}%`),
        like(users.email, `%${escapedSearch}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(users).where(whereClause);
  const total = countResult[0]?.count || 0;

  // Get users
  const userList = await db
    .select({
      id: users.id,
      openId: users.openId,
      username: users.username,
      name: users.name,
      email: users.email,
      role: users.role,
      subscriptionTier: users.subscriptionTier,
      licenseExpiresAt: users.licenseExpiresAt,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
      linkCount: sql<number>`(SELECT COUNT(*) FROM links WHERE links.userId = ${users.id})`,
      domainCount: sql<number>`(SELECT COUNT(*) FROM domains WHERE domains.userId = ${users.id})`,
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return { users: userList, total };
}

export async function updateUserRole(userId: number, role: 'user' | 'admin') {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function resetUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
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

export async function getAllLinks(limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return { links: [], total: 0 };

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(links);
  const total = countResult[0]?.count || 0;

  const result = await db
    .select({
      id: links.id,
      shortCode: links.shortCode,
      originalUrl: links.originalUrl,
      customDomain: links.customDomain,
      description: links.description,
      isActive: links.isActive,
      isValid: links.isValid,
      clickCount: links.clickCount,
      createdAt: links.createdAt,
      userId: links.userId,
      userName: users.name,
      userUsername: users.username,
    })
    .from(links)
    .leftJoin(users, eq(links.userId, users.id))
    .orderBy(desc(links.createdAt))
    .limit(limit)
    .offset(offset);

  return { links: result, total };
}

export async function searchAllLinks(query: {
  search?: string;
  isActive?: number;
  isValid?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { links: [], total: 0 };

  const conditions: any[] = [];

  if (query.search) {
    const escapedSearch = escapeLikePattern(query.search);
    conditions.push(
      or(
        like(links.shortCode, `%${escapedSearch}%`),
        like(links.originalUrl, `%${escapedSearch}%`)
      )
    );
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(links.isActive, query.isActive));
  }

  if (query.isValid !== undefined) {
    conditions.push(eq(links.isValid, query.isValid));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(links).where(whereClause);
  const total = countResult[0]?.count || 0;

  const result = await db
    .select({
      id: links.id,
      shortCode: links.shortCode,
      originalUrl: links.originalUrl,
      customDomain: links.customDomain,
      description: links.description,
      isActive: links.isActive,
      isValid: links.isValid,
      clickCount: links.clickCount,
      createdAt: links.createdAt,
      userId: links.userId,
      userName: users.name,
      userUsername: users.username,
    })
    .from(links)
    .leftJoin(users, eq(links.userId, users.id))
    .where(whereClause)
    .orderBy(desc(links.createdAt))
    .limit(query.limit || 50)
    .offset(query.offset || 0);

  return { links: result, total };
}

export async function adminDeleteLink(linkId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(linkStats).where(eq(linkStats.linkId, linkId));
  await db.delete(linkChecks).where(eq(linkChecks.linkId, linkId));
  await db.delete(notifications).where(eq(notifications.linkId, linkId));
  await db.delete(links).where(eq(links.id, linkId));
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
  await db.transaction(async (tx: any) => {
    await tx.delete(links).where(and(eq(links.userId, userId), inArray(links.id, ids)));
  });
}

export async function batchUpdateLinks(userId: number, ids: number[], data: Partial<InsertLink>) {
  const db = await getDb();
  if (!db || ids.length === 0) return;
  await db.transaction(async (tx: any) => {
    await tx.update(links).set(data).where(and(eq(links.userId, userId), inArray(links.id, ids)));
  });
}

export async function batchUpdateLinksTags(userId: number, ids: number[], tags: string[], mode: 'add' | 'remove' | 'set') {
  const db = await getDb();
  if (!db || ids.length === 0) return;

  await db.transaction(async (tx: any) => {
    if (mode === 'set') {
      await tx.update(links).set({ tags }).where(and(eq(links.userId, userId), inArray(links.id, ids)));
      return;
    }

    const targetLinks = await tx.select({ id: links.id, tags: links.tags }).from(links).where(and(eq(links.userId, userId), inArray(links.id, ids)));

    for (const link of targetLinks) {
      let newTags = [...(link.tags || [])];
      if (mode === 'add') {
        newTags = Array.from(new Set([...newTags, ...tags]));
      } else if (mode === 'remove') {
        newTags = newTags.filter(t => !tags.includes(t));
      }
      await tx.update(links).set({ tags: newTags }).where(eq(links.id, link.id));
    }
  });
}

export async function searchLinks(userId: number, query: {
  search?: string;
  tag?: string;
  status?: 'all' | 'active' | 'invalid';
  orderBy?: 'createdAt' | 'clickCount' | 'updatedAt';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { links: [], total: 0 };

  const conditions: any[] = [eq(links.userId, userId)];

  if (query.search) {
    const escapedSearch = escapeLikePattern(query.search);
    conditions.push(
      or(
        like(links.shortCode, `%${escapedSearch}%`),
        like(links.originalUrl, `%${escapedSearch}%`),
        like(links.description, `%${escapedSearch}%`)
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

  const whereClause = and(...conditions);

  // Get total count
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(links).where(whereClause);
  const total = countResult[0]?.count || 0;

  // Determine order
  const orderColumn = query.orderBy ? links[query.orderBy] : links.createdAt;
  const orderFn = query.order === 'asc' ? asc : desc;

  // Build query with pagination
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const result = await db
    .select()
    .from(links)
    .where(whereClause)
    .orderBy(orderFn(orderColumn))
    .limit(limit)
    .offset(offset);

  return { links: result, total };
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
  const emptyResult = {
    totalClicks: 0,
    deviceStats: {},
    browserStats: {},
    osStats: {},
    countryStats: {},
    cityStats: {},
    last7Days: {},
    recentClicks: [],
  };

  if (!db) return emptyResult;

  // 1. Get total clicks count (single scalar query)
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(linkStats)
    .where(eq(linkStats.linkId, linkId));
  const totalClicks = countResult[0]?.count || 0;

  // Early return if no clicks
  if (totalClicks === 0) return emptyResult;

  // 2. Get device distribution (SQL GROUP BY)
  const deviceResult = await db
    .select({
      deviceType: sql<string>`COALESCE(${linkStats.deviceType}, 'unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(eq(linkStats.linkId, linkId))
    .groupBy(sql`COALESCE(${linkStats.deviceType}, 'unknown')`);
  const deviceStats = Object.fromEntries(deviceResult.map((r: { deviceType: string; count: number }) => [r.deviceType, r.count]));

  // 3. Get browser distribution (SQL GROUP BY)
  const browserResult = await db
    .select({
      browserName: sql<string>`COALESCE(${linkStats.browserName}, 'Unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(eq(linkStats.linkId, linkId))
    .groupBy(sql`COALESCE(${linkStats.browserName}, 'Unknown')`);
  const browserStats = Object.fromEntries(browserResult.map((r: { browserName: string; count: number }) => [r.browserName, r.count]));

  // 4. Get OS distribution (SQL GROUP BY)
  const osResult = await db
    .select({
      osName: sql<string>`COALESCE(${linkStats.osName}, 'Unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(eq(linkStats.linkId, linkId))
    .groupBy(sql`COALESCE(${linkStats.osName}, 'Unknown')`);
  const osStats = Object.fromEntries(osResult.map((r: { osName: string; count: number }) => [r.osName, r.count]));

  // 5. Get country distribution (SQL GROUP BY)
  const countryResult = await db
    .select({
      country: sql<string>`COALESCE(${linkStats.country}, 'Unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(eq(linkStats.linkId, linkId))
    .groupBy(sql`COALESCE(${linkStats.country}, 'Unknown')`);
  const countryStats = Object.fromEntries(countryResult.map((r: { country: string; count: number }) => [r.country, r.count]));

  // 6. Get city distribution (SQL GROUP BY)
  const cityResult = await db
    .select({
      city: sql<string>`COALESCE(${linkStats.city}, 'Unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(eq(linkStats.linkId, linkId))
    .groupBy(sql`COALESCE(${linkStats.city}, 'Unknown')`);
  const cityStats = Object.fromEntries(cityResult.map((r: { city: string; count: number }) => [r.city, r.count]));

  // 7. Get last 7 days click distribution (SQL GROUP BY DATE)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const last7DaysResult = await db
    .select({
      date: sql<string>`DATE(${linkStats.clickedAt})`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(
      and(
        eq(linkStats.linkId, linkId),
        sql`${linkStats.clickedAt} >= ${sevenDaysAgo}`
      )
    )
    .groupBy(sql`DATE(${linkStats.clickedAt})`);

  // Initialize last 7 days with zeros
  const last7Days: Record<string, number> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    last7Days[dateStr] = 0;
  }
  // Fill in actual counts
  last7DaysResult.forEach((r: { date: string; count: number }) => {
    if (last7Days.hasOwnProperty(r.date)) {
      last7Days[r.date] = r.count;
    }
  });

  // 8. Get recent 10 clicks only (limited query)
  const recentClicks = await db
    .select()
    .from(linkStats)
    .where(eq(linkStats.linkId, linkId))
    .orderBy(desc(linkStats.clickedAt))
    .limit(10);

  return {
    totalClicks,
    deviceStats,
    browserStats,
    osStats,
    countryStats,
    cityStats,
    last7Days,
    recentClicks,
  };
}

export async function getGlobalStatsSummary(userId: number, days: number = 7) {
  const db = await getDb();
  const emptyResult = { totalLinks: 0, totalClicks: 0, timeSeries: {}, deviceStats: {}, countryStats: {}, cityStats: {}, browserStats: {} };

  if (!db) return emptyResult;

  // 1. Get user's links with click counts (SQL aggregation)
  const linksQuery = await db
    .select({
      id: links.id,
      clickCount: links.clickCount,
    })
    .from(links)
    .where(eq(links.userId, userId));

  const totalLinks = linksQuery.length;
  const totalClicks = linksQuery.reduce((sum: number, link: any) => sum + (link.clickCount || 0), 0);

  // Initialize time series with zeros
  const timeSeries: Record<string, number> = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    timeSeries[dateStr] = 0;
  }

  if (linksQuery.length === 0) {
    return { totalLinks, totalClicks, timeSeries, deviceStats: {}, countryStats: {}, cityStats: {}, browserStats: {} };
  }

  const linkIds = linksQuery.map((l: any) => l.id);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // 2. Get time series (SQL GROUP BY DATE)
  const timeSeriesResult = await db
    .select({
      date: sql<string>`DATE(${linkStats.clickedAt})`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(
      and(
        inArray(linkStats.linkId, linkIds),
        sql`${linkStats.clickedAt} >= ${startDate}`
      )
    )
    .groupBy(sql`DATE(${linkStats.clickedAt})`);

  timeSeriesResult.forEach((r: { date: string; count: number }) => {
    if (timeSeries.hasOwnProperty(r.date)) {
      timeSeries[r.date] = r.count;
    }
  });

  // 3. Get device distribution (SQL GROUP BY)
  const deviceResult = await db
    .select({
      deviceType: sql<string>`COALESCE(${linkStats.deviceType}, 'unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(
      and(
        inArray(linkStats.linkId, linkIds),
        sql`${linkStats.clickedAt} >= ${startDate}`
      )
    )
    .groupBy(sql`COALESCE(${linkStats.deviceType}, 'unknown')`);
  const deviceStats = Object.fromEntries(deviceResult.map((r: { deviceType: string; count: number }) => [r.deviceType, r.count]));

  // 4. Get country distribution (SQL GROUP BY)
  const countryResult = await db
    .select({
      country: sql<string>`COALESCE(${linkStats.country}, 'Unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(
      and(
        inArray(linkStats.linkId, linkIds),
        sql`${linkStats.clickedAt} >= ${startDate}`
      )
    )
    .groupBy(sql`COALESCE(${linkStats.country}, 'Unknown')`);
  const countryStats = Object.fromEntries(countryResult.map((r: { country: string; count: number }) => [r.country, r.count]));

  // 5. Get city distribution (SQL GROUP BY)
  const cityResult = await db
    .select({
      city: sql<string>`COALESCE(${linkStats.city}, 'Unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(
      and(
        inArray(linkStats.linkId, linkIds),
        sql`${linkStats.clickedAt} >= ${startDate}`
      )
    )
    .groupBy(sql`COALESCE(${linkStats.city}, 'Unknown')`);
  const cityStats = Object.fromEntries(cityResult.map((r: { city: string; count: number }) => [r.city, r.count]));

  // 6. Get browser distribution (SQL GROUP BY)
  const browserResult = await db
    .select({
      browserName: sql<string>`COALESCE(${linkStats.browserName}, 'Unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(
      and(
        inArray(linkStats.linkId, linkIds),
        sql`${linkStats.clickedAt} >= ${startDate}`
      )
    )
    .groupBy(sql`COALESCE(${linkStats.browserName}, 'Unknown')`);
  const browserStats = Object.fromEntries(browserResult.map((r: { browserName: string; count: number }) => [r.browserName, r.count]));

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

export async function getInvalidLinks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(links).where(and(eq(links.userId, userId), eq(links.isValid, 0)));
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

export async function getNotificationsForUser(userId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  // Get user-specific notifications + broadcast notifications (userId = null)
  return db.select().from(notifications)
    .where(or(eq(notifications.userId, userId), isNull(notifications.userId)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, unread: 0 };

  const [totalResult] = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(or(eq(notifications.userId, userId), isNull(notifications.userId)));

  const [unreadResult] = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(
      or(eq(notifications.userId, userId), isNull(notifications.userId)),
      eq(notifications.isRead, 0)
    ));

  return {
    total: totalResult?.count || 0,
    unread: unreadResult?.count || 0,
  };
}

export async function getAllNotifications(limit = 50, offset = 0, type?: string, userId?: number) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (type) conditions.push(eq(notifications.type, type));
  if (userId !== undefined) conditions.push(eq(notifications.userId, userId));

  return db.select().from(notifications)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getNotificationStats() {
  const db = await getDb();
  if (!db) return { total: 0, unread: 0, byType: {} };

  const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(notifications);
  const [unreadResult] = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(eq(notifications.isRead, 0));

  const typeStats = await db.select({
    type: notifications.type,
    count: sql<number>`count(*)`,
  }).from(notifications).groupBy(notifications.type);

  return {
    total: totalResult?.count || 0,
    unread: unreadResult?.count || 0,
    byType: Object.fromEntries(typeStats.map((s: { type: string; count: number }) => [s.type, s.count])),
  };
}

export async function markNotificationRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;

  const result = await db.update(notifications)
    .set({ isRead: 1 })
    .where(and(eq(notifications.id, notificationId), or(eq(notifications.userId, userId), isNull(notifications.userId))));

  return true;
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return false;

  await db.update(notifications)
    .set({ isRead: 1 })
    .where(and(
      or(eq(notifications.userId, userId), isNull(notifications.userId)),
      eq(notifications.isRead, 0)
    ));

  return true;
}

export async function sendBroadcastNotification(data: {
  title: string;
  message: string;
  type: string;
  priority?: 'low' | 'normal' | 'high';
  senderId: number;
  targetUserIds?: number[];
}) {
  const db = await getDb();
  if (!db) return { count: 0 };

  const notificationData = {
    title: data.title,
    message: data.message,
    type: data.type,
    priority: data.priority || 'normal',
    senderId: data.senderId,
    isRead: 0,
  };

  if (data.targetUserIds && data.targetUserIds.length > 0) {
    // Send to specific users
    const values = data.targetUserIds.map(userId => ({
      ...notificationData,
      userId,
    }));
    await db.insert(notifications).values(values);
    return { count: data.targetUserIds.length };
  } else {
    // Broadcast to all (userId = null)
    await db.insert(notifications).values({
      ...notificationData,
      userId: null,
    });
    return { count: -1 }; // -1 indicates broadcast
  }
}

export async function deleteNotification(notificationId: number) {
  const db = await getDb();
  if (!db) return false;

  await db.delete(notifications).where(eq(notifications.id, notificationId));
  return true;
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

// === Usage tracking ===
export async function recordUsage(data: InsertUsageLog) {
  const db = await getDb();
  if (!db) return;
  
  const today = new Date().toISOString().split('T')[0];
  const usageData = {
    ...data,
    date: today,
  };

  await db.insert(usageLogs)
    .values(usageData)
    .onDuplicateKeyUpdate({
      set: {
        linksCreated: sql`${usageLogs.linksCreated} + ${data.linksCreated || 0}`,
        apiCalls: sql`${usageLogs.apiCalls} + ${data.apiCalls || 0}`,
        totalClicks: sql`${usageLogs.totalClicks} + ${data.totalClicks || 0}`,
      }
    });
}

export async function getUserUsage(userId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];
  return db.select().from(usageLogs)
    .where(and(eq(usageLogs.userId, userId), sql`${usageLogs.date} >= ${startDateStr}`))
    .orderBy(usageLogs.date);
}

export async function getUserLinkCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(links).where(eq(links.userId, userId));
  return result[0]?.count || 0;
}

export async function getUserDomainCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(domains).where(eq(domains.userId, userId));
  return result[0]?.count || 0;
}

// === Admin Dashboard Stats ===
export async function getAdminDashboardStats() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, activeUsers: 0, totalLinks: 0, totalClicks: 0, tierDistribution: {} };

  // User stats
  const userStats = await db.select({
    total: sql<number>`count(*)`,
    active: sql<number>`sum(case when lastSignedIn > DATE_SUB(NOW(), INTERVAL 30 DAY) then 1 else 0 end)`
  }).from(users);

  // Link stats
  const linkStats = await db.select({
    total: sql<number>`count(*)`,
    totalClicks: sql<number>`coalesce(sum(clickCount), 0)`
  }).from(links);

  // Tier distribution
  const tierStats = await db.select({
    tier: users.subscriptionTier,
    count: sql<number>`count(*)`
  }).from(users).groupBy(users.subscriptionTier);

  const tierDistribution: Record<string, number> = {};
  tierStats.forEach((t: any) => {
    tierDistribution[t.tier || 'free'] = t.count;
  });

  return {
    totalUsers: userStats[0]?.total || 0,
    activeUsers: Number(userStats[0]?.active) || 0,
    totalLinks: linkStats[0]?.total || 0,
    totalClicks: Number(linkStats[0]?.totalClicks) || 0,
    tierDistribution,
  };
}

// === Audit Log Management ===
export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function getAuditLogs(options: {
  userId?: number;
  action?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };

  const conditions: any[] = [];
  if (options.userId) conditions.push(eq(auditLogs.userId, options.userId));
  if (options.action) conditions.push(eq(auditLogs.action, options.action));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(whereClause);
  const total = countResult[0]?.count || 0;

  const logs = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      details: auditLogs.details,
      ipAddress: auditLogs.ipAddress,
      userAgent: auditLogs.userAgent,
      createdAt: auditLogs.createdAt,
      userName: users.name,
      userUsername: users.username,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(options.limit || 50)
    .offset(options.offset || 0);

  return { logs, total };
}

// === Platform-wide Usage Stats ===
export async function getPlatformUsageStats(days: number = 30) {
  const db = await getDb();
  if (!db) return { daily: [], totals: { linksCreated: 0, apiCalls: 0, totalClicks: 0 }, userStats: [] };

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get daily aggregated usage
  const dailyUsage = await db
    .select({
      date: usageLogs.date,
      linksCreated: sql<number>`SUM(${usageLogs.linksCreated})`,
      apiCalls: sql<number>`SUM(${usageLogs.apiCalls})`,
      totalClicks: sql<number>`SUM(${usageLogs.totalClicks})`,
    })
    .from(usageLogs)
    .where(sql`${usageLogs.date} >= ${startDateStr}`)
    .groupBy(usageLogs.date)
    .orderBy(usageLogs.date);

  // Calculate totals
  const totals = dailyUsage.reduce(
    (acc: { linksCreated: number; apiCalls: number; totalClicks: number }, log: { linksCreated: number | null; apiCalls: number | null; totalClicks: number | null }) => ({
      linksCreated: acc.linksCreated + (log.linksCreated || 0),
      apiCalls: acc.apiCalls + (log.apiCalls || 0),
      totalClicks: acc.totalClicks + (log.totalClicks || 0),
    }),
    { linksCreated: 0, apiCalls: 0, totalClicks: 0 }
  );

  // Get per-user stats
  const userStats = await db
    .select({
      userId: usageLogs.userId,
      userName: users.name,
      userUsername: users.username,
      linksCreated: sql<number>`SUM(${usageLogs.linksCreated})`,
      apiCalls: sql<number>`SUM(${usageLogs.apiCalls})`,
      totalClicks: sql<number>`SUM(${usageLogs.totalClicks})`,
    })
    .from(usageLogs)
    .leftJoin(users, eq(usageLogs.userId, users.id))
    .where(sql`${usageLogs.date} >= ${startDateStr}`)
    .groupBy(usageLogs.userId)
    .orderBy(desc(sql`SUM(${usageLogs.totalClicks})`));

  return {
    daily: dailyUsage,
    totals,
    userStats,
  };
}
