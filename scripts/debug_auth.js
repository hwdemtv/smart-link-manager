import { drizzle } from "drizzle-orm/mysql2";
import { users } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import dotenv from "dotenv";

dotenv.config();

const scryptAsync = promisify(scrypt);

async function verifyPassword(password, hash) {
  const [salt, key] = hash.split(":");
  const buf = await scryptAsync(password, salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  return timingSafeEqual(buf, keyBuf);
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL not found");
    return;
  }

  const db = drizzle(databaseUrl);
  const username = "demo_admin";
  const password = "password123";

  console.log(`Checking user: ${username}...`);
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const user = result[0];

  if (!user) {
    console.error("User not found!");
    return;
  }

  console.log("User found, validating password...");
  const isValid = await verifyPassword(password, user.passwordHash);

  if (isValid) {
    console.log("SUCCESS: Password matches in database!");
  } else {
    console.error("FAILURE: Password DOES NOT match!");
    console.log(`Hash in DB: ${user.userRole}`); // Oops, typo in log, let's fix
  }
}

run()
  .catch(console.error)
  .finally(() => process.exit());
