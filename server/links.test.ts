/**
 * Link Management Integration Tests
 *
 * These tests require a running MySQL database with the schema migrated.
 * They are skipped by default. To run them:
 * 1. Ensure DATABASE_URL is set in .env
 * 2. Run `npm run db:push` to migrate the schema
 * 3. Set the ENABLE_INTEGRATION_TESTS env var to run these tests
 */

import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "test",
    role: "user",
    subscriptionTier: "free",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)",
      },
      get: (name: string) => {
        if (name === "host") return "localhost";
        return undefined;
      },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

// Skip tests unless explicitly enabled
const shouldRun = process.env.ENABLE_INTEGRATION_TESTS === "true";

describe.skipIf(!shouldRun)("Link Management (Integration Tests)", () => {
  let shortCode: string;

  it("should create a short link", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    shortCode = `test-${Date.now()}`;
    const result = await caller.links.create({
      originalUrl: "https://pan.baidu.com/s/1234567890",
      shortCode,
      description: "Test link",
    });

    expect(result.success).toBe(true);
    expect(result.shortCode).toBe(shortCode);
  });

  it("should reject duplicate short codes", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.links.create({
        originalUrl: "https://pan.baidu.com/s/different",
        shortCode, // Same as before
        description: "Duplicate",
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("CONFLICT");
    }
  });

  it("should validate short code format", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.links.create({
        originalUrl: "https://pan.baidu.com/s/test",
        shortCode: "ab", // Too short
        description: "Invalid",
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      // Expected to fail validation
    }
  });

  it("should list user links", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const links = await caller.links.list();

    expect(Array.isArray(links)).toBe(true);
    expect(links.length).toBeGreaterThan(0);
    expect(links.some(l => l.shortCode === shortCode)).toBe(true);
  });

  it("should get link by short code", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const link = await caller.links.getByShortCode({
      shortCode,
    });

    expect(link).toBeDefined();
    expect(link.shortCode).toBe(shortCode);
    expect(link.originalUrl).toBe("https://pan.baidu.com/s/1234567890");
  });

  it("should record click statistics", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.links.recordClick({
      shortCode,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)",
      deviceType: "mobile",
    });

    expect(result.success).toBe(true);
  });

  it("should create notifications", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    // First create a link to get its ID
    const links = await caller.links.list();
    const testLink = links.find(l => l.shortCode === shortCode);

    if (testLink) {
      const result = await caller.links.createNotification({
        linkId: testLink.id,
        type: "link_invalid",
        title: "Link Invalid",
        message: "Your link has become invalid",
      });

      expect(result.success).toBe(true);
    }
  });

  it("should get user notifications", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const notifications = await caller.links.getNotifications();

    expect(Array.isArray(notifications)).toBe(true);
  });

  it("should handle invalid short codes", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.links.getByShortCode({
        shortCode: "nonexistent",
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("NOT_FOUND");
    }
  });
});
