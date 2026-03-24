import { getSystemConfig, updateSystemConfig } from "../server/db";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function test() {
  console.log("1. Reading current aiConfig...");
  const current = await getSystemConfig("aiConfig");
  console.log("Current aiConfig:", current, "Type:", typeof current);

  console.log("\n2. Updating aiConfig...");
  const newConfig = {
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    apiKey: "sk-test12345",
    temperature: 0.5,
  };

  try {
    // 尝试传入纯对象以测试 Drizzle JSON 列的处理方式
    await updateSystemConfig("aiConfig", newConfig);
    console.log("Update success (object)");
  } catch (e: any) {
    console.error("Update failed (object):", e.message);
  }

  console.log("\n3. Reading aiConfig again...");
  const updated = await getSystemConfig("aiConfig");
  console.log("Updated aiConfig:", updated, "Type:", typeof updated);

  process.exit(0);
}

test();
