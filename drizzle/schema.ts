import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Tenants table: represents each SaaS customer
 */
export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(), // For URL: tenant-slug.yourdomain.com
  description: text("description"),
  logo: text("logo"), // URL to tenant logo
  primaryColor: varchar("primaryColor", { length: 7 }), // Hex color for branding
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  tenantId: int("tenantId").references(() => tenants.id), // NULL for platform admins
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "tenant_admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Links table: stores all short links and their metadata
 */
export const links = mysqlTable("links", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Link = typeof links.$inferSelect;
export type InsertLink = typeof links.$inferInsert;

/**
 * Domains table: manages tenant's custom domains
 */
export const domains = mysqlTable("domains", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id),
  domain: varchar("domain", { length: 255 }).notNull(),
  isVerified: int("isVerified").default(0).notNull(), // 1 = verified, 0 = pending
  verificationToken: varchar("verificationToken", { length: 255 }),
  verificationMethod: varchar("verificationMethod", { length: 50 }), // 'cname', 'txt', 'file'
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
  clickedAt: timestamp("clickedAt").defaultNow().notNull(),
});

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
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
});

export type LinkCheck = typeof linkChecks.$inferSelect;
export type InsertLinkCheck = typeof linkChecks.$inferInsert;

/**
 * Notifications table: tracks validity alerts
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id),
  linkId: int("linkId").notNull().references(() => links.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // 'link_invalid', 'link_expired'
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  isRead: int("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Subscription Plans table: defines available subscription tiers
 */
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // 'Free', 'Pro', 'Enterprise'
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  description: text("description"),
  monthlyPrice: int("monthlyPrice").notNull(), // In cents, e.g., 999 = $9.99
  yearlyPrice: int("yearlyPrice"),
  maxLinks: int("maxLinks").notNull(), // Max short links per tenant
  maxApiCallsPerDay: int("maxApiCallsPerDay").notNull(), // API rate limit
  maxCustomDomains: int("maxCustomDomains").notNull(),
  features: text("features"), // JSON array of features
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

/**
 * Subscriptions table: tracks tenant subscriptions
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  planId: int("planId").notNull().references(() => subscriptionPlans.id),
  status: mysqlEnum("status", ["active", "cancelled", "expired", "suspended"]).notNull(),
  billingCycle: mysqlEnum("billingCycle", ["monthly", "yearly"]).notNull(),
  currentPeriodStart: timestamp("currentPeriodStart").notNull(),
  currentPeriodEnd: timestamp("currentPeriodEnd").notNull(),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Usage logs table: tracks API usage and link creation
 */
export const usageLogs = mysqlTable("usage_logs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  linksCreated: int("linksCreated").default(0).notNull(),
  apiCalls: int("apiCalls").default(0).notNull(),
  totalClicks: int("totalClicks").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UsageLog = typeof usageLogs.$inferSelect;
export type InsertUsageLog = typeof usageLogs.$inferInsert;
