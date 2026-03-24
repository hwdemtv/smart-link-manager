import "dotenv/config";
import * as db from "./server/db";
import { hashPassword } from "./server/_core/auth";

async function resetAdmin() {
  const username = "admin";
  const newPassword = "admin123456";
  const passwordHash = await hashPassword(newPassword);
  
  const user = await db.getUserByUsername(username);
  if (user) {
    await db.upsertUser({
      ...user,
      passwordHash,
    });
    // 安全：不在日志中打印明文密码
    console.log(`✅ Password successfully reset for user: ${username}`);
  } else {
    console.log(`User ${username} not found`);
  }
  process.exit(0);
}

resetAdmin().catch(console.error);
