import {
  eq,
  and,
  or,
  sql,
  desc,
  asc,
  inArray,
  like,
  isNull,
  gte,
  lte,
  isNotNull,
  SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql, { type ResultSetHeader } from "mysql2/promise";
import {
  InsertUser,
  users,
  InsertLink,
  links,
  InsertLinkStat,
  linkStats,
  InsertLinkCheck,
  linkChecks,
  InsertNotification,
  notifications,
  InsertDomain,
  domains,
  InsertUsageLog,
  usageLogs,
  InsertAuditLog,
  auditLogs,
  InsertLinkGroup,
  linkGroups,
  InsertIpBlacklist,
  ipBlacklist,
  configs,
  InsertConfig,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;
// 注意: 已移除导出的 db 变量，统一使用 getDb() 获取数据库连接
// 这避免了 db 未初始化就被使用的问题

/**
 * Escape special characters for LIKE queries to prevent SQL injection
 * Characters: % (match any), _ (match single), \ (escape char)
 */
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&");
}

/**
 * 辅助工具：异步操作重试机制 (用于 P3 级高可靠要求路径)
 */
async function asyncRetry<T>(
  task: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // 指数退避
      }
    }
  }
  throw lastError;
}

/**
 * 解析 DATABASE_URL 为连接配置
 */
function parseDatabaseUrl(url: string): mysql.PoolOptions {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 3306,
      user: parsed.username,
      password: decodeURIComponent(parsed.password || ""),
      database: parsed.pathname.slice(1),
      // 连接池配置
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0,
      // 连接保活配置（解决 idle 超时断连问题）
      idleTimeout: 60000, // 空闲连接 60s 后释放
      enableKeepAlive: true, // 启用 TCP KeepAlive
      keepAliveInitialDelay: 30000, // 30s 发送首次 keepalive 探测
      // 重连配置
      multipleStatements: false,
    };
  } catch (error) {
    throw new Error(
      `Invalid DATABASE_URL format: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (!_pool) {
        _pool = mysql.createPool(parseDatabaseUrl(process.env.DATABASE_URL));

        // 关键修复 (Issue 4)：添加连接池错误处理逻辑
        // 使用 any 转换以绕过某些版本下 pool 类型的事件限制 (如：'error' vs 'enqueue')
        (_pool as any).on("error", (err: Error & { code?: string; fatal?: boolean }) => {
          console.error("[Database] Global pool error:", err);
          // 如果连接池发生致命错误（如连接丢失），将其置空以便下次请求时重新创建
          if (err.code === "PROTOCOL_CONNECTION_LOST" || err.fatal) {
            _pool = null;
            _db = null;
          }
        });

        console.log("[Database] Connection pool created");
      }
      _db = drizzle({ client: _pool });
    } catch (error) {
      console.warn("[Database] Initialization failed:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

/**
 * 关闭数据库连接池（用于优雅关闭）
 */
export async function closeDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
    console.log("[Database] Connection pool closed");
  }
}

// === User Management ===
export async function upsertUser(user: InsertUser) {
  const db = await getDb();
  if (!db) return;
  const updateSet: any = { ...user };
  delete updateSet.openId;

  // 如果 updateSet 为空（只有 openId），跳过更新操作
  if (Object.keys(updateSet).length === 0) {
    return;
  }

  await db.insert(users).values(user).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
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
  const userLinks = await db
    .select({ id: links.id })
    .from(links)
    .where(eq(links.userId, id));
  const linkIds = userLinks.map((l: { id: number }) => l.id);

  // Delete link stats
  if (linkIds.length > 0) {
    await db.delete(linkStats).where(inArray(linkStats.linkId, linkIds));
    await db.delete(linkChecks).where(inArray(linkChecks.linkId, linkIds));
    await db
      .delete(notifications)
      .where(inArray(notifications.linkId, linkIds));
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

export async function getAllUsers(
  limit: number = 20,
  offset: number = 0,
  search?: string
) {
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
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(whereClause);
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
      isActive: users.isActive,
      lastIpAddress: users.lastIpAddress,
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

export async function batchDeleteUsers(userIds: number[]) {
  const db = await getDb();
  if (!db || userIds.length === 0) return;

  const userLinks = await db
    .select({ id: links.id })
    .from(links)
    .where(inArray(links.userId, userIds));
  const linkIds = userLinks.map((l: { id: number }) => l.id);

  if (linkIds.length > 0) {
    await db.delete(linkStats).where(inArray(linkStats.linkId, linkIds));
    await db.delete(linkChecks).where(inArray(linkChecks.linkId, linkIds));
    await db
      .delete(notifications)
      .where(inArray(notifications.linkId, linkIds));
  }

  await db.delete(links).where(inArray(links.userId, userIds));
  await db.delete(domains).where(inArray(domains.userId, userIds));
  await db.delete(usageLogs).where(inArray(usageLogs.userId, userIds));
  await db.delete(users).where(inArray(users.id, userIds));
}

export async function batchUpdateUsers(
  userIds: number[],
  data: Partial<InsertUser>
) {
  const db = await getDb();
  if (!db || userIds.length === 0) return;
  await db.update(users).set(data).where(inArray(users.id, userIds));
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
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
  if (!db) throw new Error("Database not connected");

  try {
    const [result] = await db.insert(links).values(data);
    return { ...data, id: (result as ResultSetHeader).insertId };
  } catch (error) {
    // 关键修复 (Issue 16)：处理短码冲突
    const dbError = error as { code?: string; message?: string };
    if (dbError.code === "ER_DUP_ENTRY") {
      throw new Error("SHORT_CODE_EXISTS");
    }
    throw error;
  }
}

// 通用的链接选择字段（显式排除 passwordHash 以防泄漏）
const linkCoreFields = {
  id: links.id,
  userId: links.userId,
  shortCode: links.shortCode,
  originalUrl: links.originalUrl,
  customDomain: links.customDomain,
  description: links.description,
  groupId: links.groupId,
  isActive: links.isActive,
  isValid: links.isValid,
  clickCount: links.clickCount,
  expiresAt: links.expiresAt,
  tags: links.tags,
  isDeleted: links.isDeleted,
  deletedAt: links.deletedAt,
  originalShortCode: links.originalShortCode,
  createdAt: links.createdAt,
  updatedAt: links.updatedAt,
  abTestEnabled: links.abTestEnabled,
  abTestUrl: links.abTestUrl,
  abTestRatio: links.abTestRatio,
  // SEO 基础字段
  seoTitle: links.seoTitle,
  seoDescription: links.seoDescription,
  seoImage: links.seoImage,
  // SEO 高级字段
  seoPriority: links.seoPriority,
  noIndex: links.noIndex,
  redirectType: links.redirectType,
  seoKeywords: links.seoKeywords,
  canonicalUrl: links.canonicalUrl,
  ogVideoUrl: links.ogVideoUrl,
  ogVideoWidth: links.ogVideoWidth,
  ogVideoHeight: links.ogVideoHeight,
  shareSuffix: links.shareSuffix,
  // passwordHash 故意在此排除
};

export async function getLinkByShortCode(shortCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  // 只返回未删除的链接，且不含哈希
  const result = await db
    .select(linkCoreFields)
    .from(links)
    .where(and(eq(links.shortCode, shortCode), eq(links.isDeleted, 0)))
    .limit(1);
  return result[0];
}

export async function getLinkById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select(linkCoreFields)
    .from(links)
    .where(eq(links.id, id))
    .limit(1);
  return result[0];
}

export async function getLinksByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select(linkCoreFields)
    .from(links)
    .where(and(eq(links.userId, userId), eq(links.isDeleted, 0)))
    .orderBy(desc(links.createdAt));
}

export async function getAllLinks(limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return { links: [], total: 0 };

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(links);
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
  userId?: number;
  domain?: string;
  expiresSoon?: boolean;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { links: [], total: 0 };

  const conditions: any[] = [];

  if (query.userId !== undefined) {
    conditions.push(eq(links.userId, query.userId));
  }

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

  if (query.isActive !== undefined) {
    conditions.push(eq(links.isActive, query.isActive));
  }

  if (query.isValid !== undefined) {
    conditions.push(eq(links.isValid, query.isValid));
  }

  if (query.domain) {
    conditions.push(eq(links.customDomain, query.domain));
  }

  if (query.expiresSoon) {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    conditions.push(
      and(
        isNotNull(links.expiresAt),
        gte(links.expiresAt, now),
        lte(links.expiresAt, sevenDaysLater)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(links)
    .where(whereClause);
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

export async function adminBatchDeleteLinks(ids: number[]) {
  const db = await getDb();
  if (!db || ids.length === 0) return;

  // 分块处理，防止 inArray 列表过大
  const chunkSize = 500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunkIds = ids.slice(i, i + chunkSize);
    await db.transaction(async (tx: any) => {
      await tx.delete(linkStats).where(inArray(linkStats.linkId, chunkIds));
      await tx.delete(linkChecks).where(inArray(linkChecks.linkId, chunkIds));
      await tx.delete(notifications).where(inArray(notifications.linkId, chunkIds));
      await tx.delete(links).where(inArray(links.id, chunkIds));
    });
  }
}

export async function adminBatchUpdateLinks(
  ids: number[],
  data: Partial<InsertLink>
) {
  const db = await getDb();
  if (!db || ids.length === 0) return;

  const chunkSize = 500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunkIds = ids.slice(i, i + chunkSize);
    await db.transaction(async (tx: any) => {
      await tx.update(links).set(data).where(inArray(links.id, chunkIds));
    });
  }
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

  // 分块处理，防止单次操作过大
  const chunkSize = 500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunkIds = ids.slice(i, i + chunkSize);
    await db.transaction(async (tx: any) => {
      await tx
        .delete(links)
        .where(and(eq(links.userId, userId), inArray(links.id, chunkIds)));
    });
  }
}

export async function batchUpdateLinks(
  userId: number,
  ids: number[],
  data: Partial<InsertLink>
) {
  const db = await getDb();
  if (!db || ids.length === 0) return;

  // 如果没有任何数据需要更新，直接返回
  if (Object.keys(data).length === 0) return;

  // 分块处理，防止单次操作过大
  const chunkSize = 500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunkIds = ids.slice(i, i + chunkSize);
    await db.transaction(async (tx: any) => {
      await tx
        .update(links)
        .set(data)
        .where(and(eq(links.userId, userId), inArray(links.id, chunkIds)));
    });
  }
}

/**
 * 批量更新链接标签（优化版 - 避免 N+1 查询）
 *
 * @param userId - 用户 ID
 * @param ids - 链接 ID 列表
 * @param tags - 要操作的标签列表
 * @param mode - 操作模式: 'add' 添加, 'remove' 移除, 'set' 替换
 *
 * 性能优化说明：
 * - set 模式：单次 UPDATE 语句
 * - add/remove 模式：1 次查询 + 批量 UPDATE（使用 CASE WHEN），避免循环内逐条更新
 */
export async function batchUpdateLinksTags(
  userId: number,
  ids: number[],
  tags: string[],
  mode: "add" | "remove" | "set"
) {
  const db = await getDb();
  if (!db || ids.length === 0) return;

  await db.transaction(async (tx: any) => {
    // set 模式：直接批量替换，无需查询
    if (mode === "set") {
      await tx
        .update(links)
        .set({ tags })
        .where(and(eq(links.userId, userId), inArray(links.id, ids)));
      return;
    }

    // add/remove 模式：先查询，再批量更新
    // 优化点：使用单次查询获取所有目标链接
    const targetLinks = await tx
      .select({ id: links.id, tags: links.tags })
      .from(links)
      .where(and(eq(links.userId, userId), inArray(links.id, ids)));

    if (targetLinks.length === 0) return;

    // 在内存中计算每个链接的新 tags
    const updates: { id: number; newTags: string[] }[] = [];
    for (const link of targetLinks) {
      let newTags = [...(link.tags || [])];
      if (mode === "add") {
        newTags = Array.from(new Set([...newTags, ...tags]));
      } else if (mode === "remove") {
        newTags = newTags.filter(t => !tags.includes(t));
      }
      updates.push({ id: link.id, newTags });
    }

    // 优化点：使用 CASE WHEN 进行批量更新，避免 N 次数据库往返
    // 构建 SQL: UPDATE links SET tags = CASE id WHEN 1 THEN '[...]' WHEN 2 THEN '[...]' END WHERE id IN (...)
    const caseStatements = updates.map(
      u => sql`WHEN ${u.id} THEN ${JSON.stringify(u.newTags)}`
    );

    const idList = updates.map(u => sql`${u.id}`);

    await tx.execute(sql`
      UPDATE ${links}
      SET tags = CASE id
        ${sql.join(caseStatements, sql` `)}
      END
      WHERE id IN (${sql.join(idList, sql`,`)})
    `);
  });
}

export async function searchLinks(
  userId: number,
  query: {
    search?: string;
    tag?: string;
    status?: "all" | "active" | "invalid";
    orderBy?: "createdAt" | "clickCount" | "updatedAt";
    order?: "asc" | "desc";
    limit?: number;
    offset?: number;
    groupId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return { links: [], total: 0 };

  // 默认过滤已删除的链接
  const conditions: any[] = [eq(links.userId, userId), eq(links.isDeleted, 0)];

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
    // 修复 SQL 注入风险：使用 JSON.stringify 确保 tag 被正确转义为 JSON 字符串，并作为参数传入
    const tagJson = JSON.stringify(query.tag);
    conditions.push(sql`JSON_CONTAINS(${links.tags}, ${tagJson})`);
  }

  if (query.status === "active") {
    conditions.push(eq(links.isValid, 1));
    conditions.push(eq(links.isActive, 1));
  } else if (query.status === "invalid") {
    conditions.push(eq(links.isValid, 0));
  }

  // 分组过滤
  if (query.groupId !== undefined) {
    if (query.groupId === null) {
      conditions.push(isNull(links.groupId));
    } else {
      conditions.push(eq(links.groupId, query.groupId));
    }
  }

  const whereClause = and(...conditions);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(links)
    .where(whereClause);
  const total = countResult[0]?.count || 0;

  // Determine order
  // 修复动态列访问风险：增加白名单校验，防止参数注入导致 undefined 崩溃
  const validOrderCols = ["createdAt", "clickCount", "updatedAt"];
  const orderColKey =
    query.orderBy && validOrderCols.includes(query.orderBy)
      ? query.orderBy
      : "createdAt";
  const orderColumn = links[orderColKey as keyof typeof links];
  const orderFn = query.order === "asc" ? asc : desc;

  // Build query with pagination
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const result = await db
    .select(linkCoreFields)
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
  const result = await db
    .select({ shortCode: links.shortCode })
    .from(links)
    .where(inArray(links.shortCode, shortCodes));
  return result.map((r: { shortCode: string }) => r.shortCode);
}

// === Stats and Monitoring ===
/**
 * 增加点击计数 (带 P3 级重试)
 */
export async function updateLinkClickCount(linkId: number) {
  const db = await getDb();
  if (!db) return;
  await asyncRetry(async () => {
    await db
      .update(links)
      .set({ clickCount: sql`clickCount + 1` })
      .where(eq(links.id, linkId));
  });
}

/**
 * 记录点击详情 (带 P3 级重试)
 */
export async function recordLinkStat(data: InsertLinkStat) {
  const db = await getDb();
  if (!db) return;
  await asyncRetry(async () => {
    await db.insert(linkStats).values(data);
  });
}

export async function getLinkStats(linkId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(linkStats)
    .where(eq(linkStats.linkId, linkId))
    .orderBy(desc(linkStats.clickedAt))
    .limit(100);
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
  const deviceStats = Object.fromEntries(
    deviceResult.map((r: { deviceType: string; count: number }) => [
      r.deviceType,
      r.count,
    ])
  );

  // 3. Get browser distribution (SQL GROUP BY)
  const browserResult = await db
    .select({
      browserName: sql<string>`COALESCE(${linkStats.browserName}, 'Unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(eq(linkStats.linkId, linkId))
    .groupBy(sql`COALESCE(${linkStats.browserName}, 'Unknown')`);
  const browserStats = Object.fromEntries(
    browserResult.map((r: { browserName: string; count: number }) => [
      r.browserName,
      r.count,
    ])
  );

  // 4. Get OS distribution (SQL GROUP BY)
  const osResult = await db
    .select({
      osName: sql<string>`COALESCE(${linkStats.osName}, 'Unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(eq(linkStats.linkId, linkId))
    .groupBy(sql`COALESCE(${linkStats.osName}, 'Unknown')`);
  const osStats = Object.fromEntries(
    osResult.map((r: { osName: string; count: number }) => [r.osName, r.count])
  );

  // 5. Get country distribution (SQL GROUP BY)
  const countryResult = await db
    .select({
      country: sql<string>`COALESCE(${linkStats.country}, 'Unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(eq(linkStats.linkId, linkId))
    .groupBy(sql`COALESCE(${linkStats.country}, 'Unknown')`);
  const countryStats = Object.fromEntries(
    countryResult.map((r: { country: string; count: number }) => [
      r.country,
      r.count,
    ])
  );

  // 6. Get city distribution (SQL GROUP BY)
  const cityResult = await db
    .select({
      city: sql<string>`COALESCE(${linkStats.city}, 'Unknown')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(eq(linkStats.linkId, linkId))
    .groupBy(sql`COALESCE(${linkStats.city}, 'Unknown')`);
  const cityStats = Object.fromEntries(
    cityResult.map((r: { city: string; count: number }) => [r.city, r.count])
  );

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
    const dateStr = date.toISOString().split("T")[0];
    last7Days[dateStr] = 0;
  }
  // Fill in actual counts
  last7DaysResult.forEach((r: { date: string; count: number }) => {
    if (last7Days.hasOwnProperty(r.date)) {
      last7Days[r.date] = r.count;
    }
  });

  // 8. Get variant distribution (A/B testing)
  const variantResult = await db
    .select({
      variant: sql<string>`COALESCE(${linkStats.variant}, 'A')`,
      count: sql<number>`count(*)`,
    })
    .from(linkStats)
    .where(eq(linkStats.linkId, linkId))
    .groupBy(sql`COALESCE(${linkStats.variant}, 'A')`);
  const variantStats = Object.fromEntries(
    variantResult.map((r: { variant: string; count: number }) => [
      r.variant,
      r.count,
    ])
  );

  // 9. Get recent 10 clicks only (limited query)
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
    variantStats,
    last7Days,
    recentClicks,
  };
}

export async function getGlobalStatsSummary(userId: number, days: number = 7) {
  const db = await getDb();
  const emptyResult = {
    totalLinks: 0,
    totalClicks: 0,
    timeSeries: {},
    deviceStats: {},
    countryStats: {},
    cityStats: {},
    browserStats: {},
  };

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
  const totalClicks = linksQuery.reduce(
    (sum: number, link: any) => sum + (link.clickCount || 0),
    0
  );

  // Initialize time series with zeros
  const timeSeries: Record<string, number> = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    timeSeries[dateStr] = 0;
  }

  if (linksQuery.length === 0) {
    return {
      totalLinks,
      totalClicks,
      timeSeries,
      deviceStats: {},
      countryStats: {},
      cityStats: {},
      browserStats: {},
    };
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
  const deviceStats = Object.fromEntries(
    deviceResult.map((r: { deviceType: string; count: number }) => [
      r.deviceType,
      r.count,
    ])
  );

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
  const countryStats = Object.fromEntries(
    countryResult.map((r: { country: string; count: number }) => [
      r.country,
      r.count,
    ])
  );

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
  const cityStats = Object.fromEntries(
    cityResult.map((r: { city: string; count: number }) => [r.city, r.count])
  );

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
  const browserStats = Object.fromEntries(
    browserResult.map((r: { browserName: string; count: number }) => [
      r.browserName,
      r.count,
    ])
  );

  return {
    totalLinks,
    totalClicks,
    timeSeries,
    deviceStats,
    countryStats,
    cityStats,
    browserStats,
  };
}

export async function recordLinkCheck(data: InsertLinkCheck) {
  const db = await getDb();
  if (!db) return;
  await db.insert(linkChecks).values(data);
}

export async function updateLinkValidity(linkId: number, isValid: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(links)
    .set({ isValid, lastCheckedAt: new Date() })
    .where(eq(links.id, linkId));
}

export async function getInvalidLinks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(links)
    .where(and(eq(links.userId, userId), eq(links.isValid, 0)));
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
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));
}

export async function getNotificationsForUser(
  userId: number,
  limit = 50,
  offset = 0
) {
  const db = await getDb();
  if (!db) return [];
  // Get user-specific notifications + broadcast notifications (userId = null)
  return db
    .select()
    .from(notifications)
    .where(or(eq(notifications.userId, userId), isNull(notifications.userId)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, unread: 0 };

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(or(eq(notifications.userId, userId), isNull(notifications.userId)));

  const [unreadResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        or(eq(notifications.userId, userId), isNull(notifications.userId)),
        eq(notifications.isRead, 0)
      )
    );

  return {
    total: totalResult?.count || 0,
    unread: unreadResult?.count || 0,
  };
}

export async function getAllNotifications(
  limit = 50,
  offset = 0,
  type?: string,
  userId?: number
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (type) conditions.push(eq(notifications.type, type));
  if (userId !== undefined) conditions.push(eq(notifications.userId, userId));

  return db
    .select()
    .from(notifications)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getNotificationStats() {
  const db = await getDb();
  if (!db) return { total: 0, unread: 0, byType: {} };

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications);
  const [unreadResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(eq(notifications.isRead, 0));

  const typeStats = await db
    .select({
      type: notifications.type,
      count: sql<number>`count(*)`,
    })
    .from(notifications)
    .groupBy(notifications.type);

  return {
    total: totalResult?.count || 0,
    unread: unreadResult?.count || 0,
    byType: Object.fromEntries(
      typeStats.map((s: { type: string; count: number }) => [s.type, s.count])
    ),
  };
}

export async function markNotificationRead(
  notificationId: number,
  userId: number
) {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .update(notifications)
    .set({ isRead: 1 })
    .where(
      and(
        eq(notifications.id, notificationId),
        or(eq(notifications.userId, userId), isNull(notifications.userId))
      )
    );

  return true;
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(notifications)
    .set({ isRead: 1 })
    .where(
      and(
        or(eq(notifications.userId, userId), isNull(notifications.userId)),
        eq(notifications.isRead, 0)
      )
    );

  return true;
}

export async function sendBroadcastNotification(data: {
  title: string;
  message: string;
  type: string;
  priority?: "low" | "normal" | "high";
  senderId: number;
  targetUserIds?: number[];
}) {
  const db = await getDb();
  if (!db) return { count: 0 };

  const notificationData = {
    title: data.title,
    message: data.message,
    type: data.type,
    priority: data.priority || "normal",
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
  const result = await db
    .select()
    .from(domains)
    .where(eq(domains.domain, domain))
    .limit(1);
  return result[0];
}

export async function verifyDomain(domainId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(domains)
    .set({ isVerified: 1, verifiedAt: new Date() })
    .where(eq(domains.id, domainId));
}

export async function getLinkByDomainAndCode(
  domain: string,
  shortCode: string
) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(links)
    .where(and(eq(links.customDomain, domain), eq(links.shortCode, shortCode)))
    .limit(1);
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

  const today = new Date().toISOString().split("T")[0];
  const usageData = {
    ...data,
    date: today,
  };

  await db
    .insert(usageLogs)
    .values(usageData)
    .onDuplicateKeyUpdate({
      set: {
        linksCreated: sql`${usageLogs.linksCreated} + ${data.linksCreated || 0}`,
        apiCalls: sql`${usageLogs.apiCalls} + ${data.apiCalls || 0}`,
        totalClicks: sql`${usageLogs.totalClicks} + ${data.totalClicks || 0}`,
      },
    });
}

export async function getUserUsage(userId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split("T")[0];
  return db
    .select()
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.userId, userId),
        sql`${usageLogs.date} >= ${startDateStr}`
      )
    )
    .orderBy(usageLogs.date);
}

export async function getUserLinkCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(links)
    .where(eq(links.userId, userId));
  return result[0]?.count || 0;
}

export async function getUserDomainCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(domains)
    .where(eq(domains.userId, userId));
  return result[0]?.count || 0;
}

/**
 * 获取用户当月创建的链接数量
 * 用于 Business 用户每月创建限制检查
 */
export async function getUserMonthlyLinkCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // 获取当月第一天
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(links)
    .where(
      and(
        eq(links.userId, userId),
        sql`${links.createdAt} >= ${firstDayOfMonth.toISOString().slice(0, 19).replace('T', ' ')}`
      )
    );

  return result[0]?.count || 0;
}

// === Admin Quick Stats ===
export async function getAdminQuickStats() {
  const db = await getDb();
  if (!db)
    return { todayRegistrations: 0, activeProUsers: 0, expiringSoonUsers: 0 };

  const todayReg = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(sql`DATE(${users.createdAt}) = CURDATE()`);

  const activePro = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(
      and(
        inArray(users.subscriptionTier, ["pro", "business"]),
        eq(users.isActive, 1)
      )
    );

  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiring = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(
      and(
        isNotNull(users.licenseExpiresAt),
        gte(users.licenseExpiresAt, now),
        lte(users.licenseExpiresAt, thirtyDaysLater)
      )
    );

  return {
    todayRegistrations: Number(todayReg[0]?.count) || 0,
    activeProUsers: Number(activePro[0]?.count) || 0,
    expiringSoonUsers: Number(expiring[0]?.count) || 0,
  };
}

// === Admin Dashboard Stats ===
export async function getAdminDashboardStats() {
  const db = await getDb();
  if (!db)
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalLinks: 0,
      totalClicks: 0,
      tierDistribution: {},
    };

  // User stats
  const userStats = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when lastSignedIn > DATE_SUB(NOW(), INTERVAL 30 DAY) then 1 else 0 end)`,
    })
    .from(users);

  // Link stats
  const linkStats = await db
    .select({
      total: sql<number>`count(*)`,
      totalClicks: sql<number>`coalesce(sum(clickCount), 0)`,
    })
    .from(links);

  // Tier distribution
  const tierStats = await db
    .select({
      tier: users.subscriptionTier,
      count: sql<number>`count(*)`,
    })
    .from(users)
    .groupBy(users.subscriptionTier);

  const tierDistribution: Record<string, number> = {};
  tierStats.forEach((t: any) => {
    tierDistribution[t.tier || "free"] = t.count;
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

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(whereClause);
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
  if (!db)
    return {
      daily: [],
      totals: { linksCreated: 0, apiCalls: 0, totalClicks: 0 },
      userStats: [],
    };

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split("T")[0];

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
    (
      acc: { linksCreated: number; apiCalls: number; totalClicks: number },
      log: {
        linksCreated: number | null;
        apiCalls: number | null;
        totalClicks: number | null;
      }
    ) => ({
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

// === System Config Management ===
export async function getSystemConfig(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(configs)
    .where(eq(configs.key, key))
    .limit(1);
  return result[0]?.value;
}

export async function updateSystemConfig(key: string, value: any) {
  const db = await getDb();
  if (!db) return;
  const existing = await getSystemConfig(key);
  if (existing !== undefined) {
    await db.update(configs).set({ value }).where(eq(configs.key, key));
  } else {
    await db.insert(configs).values({ key, value });
  }
}

// ==================== 回收站功能 ====================

/**
 * 软删除链接 - 标记为已删除并释放短码
 */
export async function softDeleteLink(linkId: number, userId?: number) {
  const db = await getDb();
  if (!db) return;

  // 获取当前链接的 shortCode
  const [link] = await db
    .select({ shortCode: links.shortCode })
    .from(links)
    .where(eq(links.id, linkId));
  if (!link) return;

  // 使用 crypto 生成安全的随机短码（替代 Math.random()）
  const crypto = await import("node:crypto");
  const randomSuffix = crypto
    .randomBytes(4)
    .toString("base64url")
    .substring(0, 6);
  const newShortCode = `del_${randomSuffix}`;

  await db
    .update(links)
    .set({
      isDeleted: 1,
      deletedAt: new Date(),
      originalShortCode: link.shortCode,
      shortCode: newShortCode,
    })
    .where(eq(links.id, linkId));

  // 记录审计日志
  await createAuditLog({
    userId,
    action: "link.soft_delete",
    targetType: "link",
    targetId: linkId,
    details: { originalShortCode: link.shortCode, newShortCode },
  });
}

/**
 * 从回收站恢复链接
 * 使用 try-catch 捕获数据库唯一索引冲突，防止并发场景下的竞态条件
 * @returns { success: boolean, error?: string }
 */
export async function restoreLink(linkId: number, userId?: number) {
  const db = await getDb();
  if (!db) return { success: false, error: "Database error" };

  try {
    // 使用事务确保原子性
    return await db.transaction(async (tx: typeof db) => {
      // 1. 获取原始短码（加锁查询，防止并发修改）
      const [link] = await tx
        .select({
          originalShortCode: links.originalShortCode,
          userId: links.userId,
        })
        .from(links)
        .where(eq(links.id, linkId));

      if (!link || !link.originalShortCode) {
        return { success: false, error: "Link not found or no original code" };
      }

      // 2. 检查原始短码是否被其他活跃链接占用
      const [existing] = await tx
        .select({ id: links.id })
        .from(links)
        .where(
          and(
            eq(links.shortCode, link.originalShortCode),
            eq(links.isDeleted, 0),
            sql`${links.id} != ${linkId}` // 排除自身
          )
        )
        .limit(1);

      if (existing) {
        return { success: false, error: "SHORT_CODE_TAKEN" };
      }

      // 3. 恢复原始短码（事务内原子操作）
      await tx
        .update(links)
        .set({
          isDeleted: 0,
          deletedAt: null,
          originalShortCode: null,
          shortCode: link.originalShortCode,
          updatedAt: new Date(),
        })
        .where(eq(links.id, linkId));

      // 4. 记录审计日志
      await createAuditLog({
        userId,
        action: "link.restore",
        targetType: "link",
        targetId: linkId,
        details: { shortCode: link.originalShortCode },
      });

      return { success: true };
    });
  } catch (error) {
    // 捕获数据库唯一索引冲突（并发场景）
    const dbError = error as { code?: string; message?: string };
    if (dbError.code === "ER_DUP_ENTRY") {
      return { success: false, error: "SHORT_CODE_TAKEN" };
    }
    console.error("[restoreLink] Error:", error);
    return { success: false, error: "Database error" };
  }
}

/**
 * 获取用户回收站中的链接
 */
export async function getDeletedLinks(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select(linkCoreFields)
    .from(links)
    .where(and(eq(links.userId, userId), eq(links.isDeleted, 1)))
    .orderBy(desc(links.deletedAt));
}

/**
 * 永久删除链接（从回收站彻底删除）
 */
export async function permanentDeleteLink(linkId: number, userId?: number) {
  const db = await getDb();
  if (!db) return;

  // 先删除关联的统计数据
  await db.delete(linkStats).where(eq(linkStats.linkId, linkId));
  await db.delete(linkChecks).where(eq(linkChecks.linkId, linkId));
  await db.delete(notifications).where(eq(notifications.linkId, linkId));

  // 再删除链接本身
  await db.delete(links).where(eq(links.id, linkId));

  // 记录审计日志
  await createAuditLog({
    userId,
    action: "link.permanent_delete",
    targetType: "link",
    targetId: linkId,
  });
}

/**
 * 清空用户回收站
 */
export async function emptyRecycleBin(userId: number) {
  const db = await getDb();
  if (!db) return;

  // 获取回收站内所有链接 ID
  const deletedLinks = await db
    .select({ id: links.id })
    .from(links)
    .where(and(eq(links.userId, userId), eq(links.isDeleted, 1)));

  const linkIds = deletedLinks.map((l: { id: number }) => l.id);

  if (linkIds.length > 0) {
    // 删除关联数据
    await db.delete(linkStats).where(inArray(linkStats.linkId, linkIds));
    await db.delete(linkChecks).where(inArray(linkChecks.linkId, linkIds));
    await db
      .delete(notifications)
      .where(inArray(notifications.linkId, linkIds));

    // 删除链接
    await db.delete(links).where(inArray(links.id, linkIds));
  }
}

// ==================== 分组管理功能 ====================

/**
 * 创建链接分组
 */
export async function createLinkGroup(
  userId: number,
  data: { name: string; color: string }
) {
  const db = await getDb();
  if (!db) return;

  const [result] = await db.insert(linkGroups).values({
    userId,
    name: data.name,
    color: data.color,
  });

  const newGroupId = result.insertId;

  // 记录审计日志
  await createAuditLog({
    userId,
    action: "group.create",
    targetType: "group",
    targetId: newGroupId,
    details: { name: data.name },
  });

  return { id: newGroupId, ...data };
}

/**
 * 获取用户的所有分组（优化版 - 聚合 linkCount）
 */
export async function getLinkGroups(userId: number) {
  const db = await getDb();
  if (!db) return [];

  // 使用 LEFT JOIN 一次性查出分组及其下的有效链接数，解决 N+1 问题
  return db
    .select({
      id: linkGroups.id,
      userId: linkGroups.userId,
      name: linkGroups.name,
      color: linkGroups.color,
      createdAt: linkGroups.createdAt,
      updatedAt: linkGroups.updatedAt,
      linkCount: sql<number>`count(${links.id})`.as("linkCount"),
    })
    .from(linkGroups)
    .leftJoin(
      links,
      and(eq(links.groupId, linkGroups.id), eq(links.isDeleted, 0))
    )
    .where(eq(linkGroups.userId, userId))
    .groupBy(linkGroups.id)
    .orderBy(linkGroups.name);
}

/**
 * 更新分组
 */
export async function updateLinkGroup(
  groupId: number,
  userId: number,
  data: { name?: string; color?: string }
) {
  const db = await getDb();
  if (!db) return;

  const updateData: any = { ...data };
  await db
    .update(linkGroups)
    .set(updateData)
    .where(and(eq(linkGroups.id, groupId), eq(linkGroups.userId, userId)));

  // 记录审计日志
  await createAuditLog({
    userId,
    action: "group.update",
    targetType: "group",
    targetId: groupId,
    details: data,
  });
}

/**
 * 删除分组
 */
export async function deleteLinkGroup(groupId: number, userId: number) {
  const db = await getDb();
  if (!db) return;

  // 删除分组，links 表的 groupId 会自动设为 null（因为外键设置了 onDelete: "set null"）
  await db
    .delete(linkGroups)
    .where(and(eq(linkGroups.id, groupId), eq(linkGroups.userId, userId)));

  // 记录审计日志
  await createAuditLog({
    userId,
    action: "group.delete",
    targetType: "group",
    targetId: groupId,
  });
}

/**
 * 获取分组链接数量
 */
export async function getGroupLinkCount(groupId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(links)
    .where(eq(links.groupId, groupId));
  return result[0]?.count || 0;
}

// ==================== IP 黑名单功能 ====================

/**
 * 添加 IP 到黑名单
 */
export async function addToBlacklist(data: {
  ipPattern: string;
  reason?: string;
  createdBy?: number;
  expiresAt?: Date;
}) {
  const db = await getDb();
  if (!db) return;

  const [result] = await db.insert(ipBlacklist).values({
    ipPattern: data.ipPattern,
    reason: data.reason || null,
    createdBy: data.createdBy || null,
    expiresAt: data.expiresAt || null,
  });

  return { id: result.insertId, ...data };
}

/**
 * 获取黑名单列表
 */
export async function getBlacklist() {
  const db = await getDb();
  if (!db) return [];

  // 清理过期条目（可选，这里返回所有，让中间件判断）
  return db.select().from(ipBlacklist).orderBy(desc(ipBlacklist.createdAt));
}

/**
 * 从黑名单移除
 */
export async function removeFromBlacklist(id: number, userId?: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(ipBlacklist).where(eq(ipBlacklist.id, id));

  // 记录审计日志
  await createAuditLog({
    userId,
    action: "blacklist.remove",
    targetType: "blacklist",
    targetId: id,
  });
}

/**
 * 检查单个 IP 是否在黑名单中（支持 IPv4/IPv6 及 CIDR）
 */
function isIpInPattern(ip: string, pattern: string): boolean {
  // 精确匹配
  if (ip === pattern) return true;

  // CIDR 匹配（主要针对 IPv4）
  if (pattern.includes("/")) {
    const [cidrIp, cidrMask] = pattern.split("/");
    if (!cidrIp.includes(".")) {
      // 简单兜底：如果是 IPv6 CIDR 且非精确匹配，目前仅支持完整字符串匹配
      return ip === pattern;
    }

    const mask = parseInt(cidrMask, 10);
    const ipParts = ip.split(".").map(p => parseInt(p, 10));
    const cidrParts = cidrIp.split(".").map(p => parseInt(p, 10));

    if (ipParts.length !== 4 || cidrParts.length !== 4) return false;

    const ipNum =
      ((ipParts[0] << 24) |
        (ipParts[1] << 16) |
        (ipParts[2] << 8) |
        ipParts[3]) >>>
      0;
    const cidrNum =
      ((cidrParts[0] << 24) |
        (cidrParts[1] << 16) |
        (cidrParts[2] << 8) |
        cidrParts[3]) >>>
      0;
    const maskNum = (mask === 0 ? 0 : ~0 << (32 - mask)) >>> 0;

    return (ipNum & maskNum) === (cidrNum & maskNum);
  }

  return false;
}

/**
 * 检查 IP 是否被封禁
 */
export function checkIpBlocked(ip: string): {
  blocked: boolean;
  reason?: string;
} {
  const blacklistData = global.ipBlacklistCache || [];

  for (const entry of blacklistData) {
    // 检查是否过期
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      continue;
    }

    if (isIpInPattern(ip, entry.ipPattern)) {
      return { blocked: true, reason: entry.reason || undefined };
    }
  }

  return { blocked: false };
}

/**
 * 加载黑名单到内存缓存
 */
export async function loadBlacklistToCache() {
  const blacklist = await getBlacklist();
  global.ipBlacklistCache = blacklist;
  console.log(`[Blacklist] Loaded ${blacklist.length} entries to cache`);
}
