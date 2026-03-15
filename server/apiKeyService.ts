import { crypto } from "./_core/sdk";
import { getDb } from "./db";
import { apiKeys } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const apiKeyService = {
  /**
   * Generate a new API key for a user
   */
  async generateKey(tenantId: number, userId: number, name: string) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rawKey = `slm_${Buffer.from(crypto.randomBytes(24)).toString("hex")}`;
    const prefix = rawKey.substring(0, 8); // slm_xxxx
    const keyHash = await crypto.hashPassword(rawKey);

    const [inserted] = await (db as any).insert(apiKeys).values({
      tenantId,
      userId,
      name,
      prefix,
      keyHash,
      isActive: 1,
    });

    return {
      id: inserted.insertId,
      name,
      rawKey, // Only returned once on creation
    };
  },

  /**
   * Verify an API key
   */
  async verifyKey(rawKey: string) {
    const db = await getDb();
    if (!db || !rawKey.startsWith("slm_")) return null;

    const prefix = rawKey.substring(0, 8);
    const keys = await db.select().from(apiKeys).where(
      and(
        eq(apiKeys.prefix, prefix),
        eq(apiKeys.isActive, 1)
      )
    );

    for (const key of keys) {
      const isValid = await crypto.verifyPassword(key.keyHash, rawKey);
      if (isValid) {
        // Update last used
        await db.update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, key.id));
          
        return {
          userId: key.userId,
          tenantId: key.tenantId,
        };
      }
    }

    return null;
  },

  /**
   * List keys for a user
   */
  async listKeys(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
  },

  /**
   * Revoke a key
   */
  async revokeKey(keyId: number, userId: number) {
    const db = await getDb();
    if (!db) return;
    return db.update(apiKeys)
      .set({ isActive: 0 })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)));
  }
};
