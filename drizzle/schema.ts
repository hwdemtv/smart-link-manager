import { sql } from "drizzle-orm";
import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Users are now independent entities with license-based subscriptions.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** 用户唯一标识符，用于内部关联 */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  /** 登录用户名 */
  username: varchar("username", { length: 64 }).unique(),
  /** 密码哈希（scrypt） */
  passwordHash: varchar("passwordHash", { length: 256 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isActive: int("isActive").default(1).notNull(), // 1 = active, 0 = banned
  lastIpAddress: varchar("lastIpAddress", { length: 45 }),
  // License-based subscription fields
  subscriptionTier: varchar("subscriptionTier", { length: 50 }).default("free").notNull(), // free, pro, business
  licenseKey: varchar("licenseKey", { length: 255 }),
  licenseExpiresAt: timestamp("licenseExpiresAt"),
  licenseToken: text("licenseToken"), // JWT token from license server (optional)
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`).onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Links table: stores all short links and their metadata
 */
export const links = mysqlTable("links", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  originalUrl: text("originalUrl").notNull(),
  shortCode: varchar("shortCode", { length: 20 }).notNull(),
  customDomain: varchar("customDomain", { length: 255 }), // e.g., s.yourdomain.com
  description: text("description"),
  isActive: int("isActive").default(1).notNull(), // 1 = active, 0 = inactive
  isValid: int("isValid").default(1).notNull(), // 1 = valid, 0 = invalid/expired
  lastCheckedAt: timestamp("lastCheckedAt"),
  clickCount: int("clickCount").default(0).notNull(),
  expiresAt: timestamp("expiresAt"),
  passwordHash: varchar("passwordHash", { length: 256 }), // 访问密码（scrypt 存储）
  tags: json("tags").$type<string[]>(), // JSON格式标签数组 [ "营销", "内部" ]
  seoTitle: varchar("seoTitle", { length: 255 }),
  seoDescription: text("seoDescription"),
  seoImage: text("seoImage"),
  // A/B Testing Fields
  abTestEnabled: int("abTestEnabled").default(0).notNull(), // 1 = enabled, 0 = disabled
  abTestUrl: text("abTestUrl"), // Target URL for variant B
  abTestRatio: int("abTestRatio").default(50).notNull(), // Percentage of traffic to variant A (e.g., 50 means 50/50 split)
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`).onUpdateNow().notNull(),
}, (table) => ({
  shortCodeIdx: index("shortCodeIdx").on(table.shortCode),
  userIdIdx: index("userIdIdx").on(table.userId),
  domainIdx: index("domainIdx").on(table.customDomain),
  shortCodeDomainIdx: index("shortCodeDomainIdx").on(table.shortCode, table.customDomain),
}));

export type Link = typeof links.$inferSelect;
export type InsertLink = typeof links.$inferInsert;

/**
 * Domains table: manages user's custom domains
 */
export const domains = mysqlTable("domains", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  domain: varchar("domain", { length: 255 }).notNull(),
  isVerified: int("isVerified").default(0).notNull(), // 1 = verified, 0 = pending
  verificationToken: varchar("verificationToken", { length: 255 }),
  verificationMethod: varchar("verificationMethod", { length: 50 }), // 'cname', 'txt', 'file'
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`).onUpdateNow().notNull(),
}, (table) => ({
  domainIdx: index("domainIdx").on(table.domain),
  userIdIdx: index("userIdIdx").on(table.userId),
}));

export type Domain = typeof domains.$inferSelect;
export type InsertDomain = typeof domains.$inferInsert;

/**
 * Link stats table: tracks clicks and device information
 */
export const linkStats = mysqlTable("link_stats", {
  id: int("id").autoincrement().primaryKey(),
  linkId: int("linkId").notNull().references(() => links.id, { onDelete: "cascade" }),
  userAgent: text("userAgent"),
  deviceType: varchar("deviceType", { length: 20 }), // 'mobile', 'desktop', 'tablet'
  osName: varchar("osName", { length: 50 }),
  browserName: varchar("browserName", { length: 50 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  referer: text("referer"),
  variant: varchar("variant", { length: 10 }), // Indicates which A/B testing variant was served exactly ('A' or 'B')
  clickedAt: timestamp("clickedAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  linkIdIdx: index("linkIdIdx").on(table.linkId),
  clickedAtIdx: index("clickedAtIdx").on(table.clickedAt),
}));

export type LinkStat = typeof linkStats.$inferSelect;
export type InsertLinkStat = typeof linkStats.$inferInsert;

/**
 * Link checks table: tracks validity check history
 */
export const linkChecks = mysqlTable("link_checks", {
  id: int("id").autoincrement().primaryKey(),
  linkId: int("linkId").notNull().references(() => links.id, { onDelete: "cascade" }),
  isValid: int("isValid").notNull(), // 1 = valid, 0 = invalid
  statusCode: int("statusCode"),
  errorMessage: text("errorMessage"),
  checkedAt: timestamp("checkedAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  linkIdIdx: index("linkIdIdx").on(table.linkId),
}));

export type LinkCheck = typeof linkChecks.$inferSelect;
export type InsertLinkCheck = typeof linkChecks.$inferInsert;

/**
 * Notifications table: tracks validity alerts and admin announcements
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id), // null = broadcast to all users
  senderId: int("senderId").references(() => users.id), // who sent the notification (admin)
  linkId: int("linkId").references(() => links.id, { onDelete: "cascade" }), // optional link reference
  type: varchar("type", { length: 50 }).notNull(), // 'link_invalid', 'link_expired', 'announcement', 'warning', 'info'
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  priority: mysqlEnum("priority", ["low", "normal", "high"]).default("normal").notNull(),
  isRead: int("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userIdIdx: index("userIdIdx").on(table.userId),
  isReadIdx: index("isReadIdx").on(table.isRead),
}));

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Usage logs table: tracks API usage and link creation per user
 */
export const usageLogs = mysqlTable("usage_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  linksCreated: int("linksCreated").default(0).notNull(),
  apiCalls: int("apiCalls").default(0).notNull(),
  totalClicks: int("totalClicks").default(0).notNull(),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userIdIdx: index("userIdIdx").on(table.userId),
  dateIdx: index("dateIdx").on(table.date),
}));

export type UsageLog = typeof usageLogs.$inferSelect;
export type InsertUsageLog = typeof usageLogs.$inferInsert;

/**
 * API Keys table: stores hashed API keys for developer access
 */
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(), // Label for the key
  prefix: varchar("prefix", { length: 16 }).notNull(), // slm_...
  keyHash: varchar("keyHash", { length: 256 }).notNull(), // Hashed full key
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`).onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("userIdIdx").on(table.userId),
  keyHashIdx: index("keyHashIdx").on(table.keyHash),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

/**
 * Audit Logs table: records important system operations
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("targetType", { length: 50 }),
  targetId: int("targetId"),
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userIdIdx: index("userIdIdx").on(table.userId),
  actionIdx: index("actionIdx").on(table.action),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * System Configs table: stores key-value pairs for global settings
 */
export const configs = mysqlTable("configs", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: json("value").notNull(),
  updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`).onUpdateNow().notNull(),
});

export type Config = typeof configs.$inferSelect;
export type InsertConfig = typeof configs.$inferInsert;
