
import { drizzle } from "drizzle-orm/mysql2";
import { tenants, users } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import dotenv from "dotenv";

dotenv.config();

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${salt}:${buf.toString("hex")}`;
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL not found");
    return;
  }

  const db = drizzle(databaseUrl);

  console.log("Creating tenant: Antigravity AI...");
  const [tenantResult] = await db.insert(tenants).values({
    name: "Antigravity AI",
    slug: "antigravity",
    description: "演示用的演示租户",
    isActive: 1,
  });

  const tenantId = tenantResult.insertId;
  console.log(`Tenant created with ID: ${tenantId}`);

  const username = "demo_admin";
  const password = "password123";
  const passwordHash = await hashPassword(password);

  console.log(`Creating user: ${username}...`);
  await db.insert(users).values({
    username,
    passwordHash,
    role: "tenant_admin",
    tenantId: tenantId,
    openId: `demo_${Date.now()}`,
    name: "演示管理员",
  });

  console.log("Done! You can now login with:");
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
  console.log("Tenant Slug: antigravity");
}

run().catch(console.error).finally(() => process.exit());
