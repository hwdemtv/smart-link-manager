import "dotenv/config";
import {
  db,
  getDb,
  getUserByUsername,
  createLink,
  getUserLinkCount,
} from "../server/db";
import { licenseService } from "../server/licenseService";

async function runSmokeTest() {
  console.log("🚀 Starting Smoke Test...");
  const database = await getDb();
  if (!database) {
    console.error("❌ Database connection failed");
    return;
  }

  // 1. Verify admin user created during init
  const admin = await getUserByUsername("admin");
  if (admin) {
    console.log(
      "✅ Admin user exists:",
      admin.username,
      "Tier:",
      admin.subscriptionTier
    );
  } else {
    console.error("❌ Admin user not found");
  }

  // 2. Test Quota Logic
  const freeTierLimits = licenseService.getTierLimits("free");
  console.log("ℹ️ Free Tier Limits:", freeTierLimits);

  // 3. Test Link Creation
  if (admin) {
    const linkCount = await getUserLinkCount(admin.id);
    console.log(`ℹ️ Current links for admin: ${linkCount}`);

    // Attempt to create a test link
    try {
      const newLink = await createLink({
        userId: admin.id,
        originalUrl: "https://example.com/test-" + Date.now(),
        shortCode: "test" + Math.random().toString(36).substring(7),
      });
      console.log("✅ Test link created:", newLink.shortCode);
    } catch (e) {
      console.error("❌ Failed to create link:", e);
    }
  }

  process.exit(0);
}

runSmokeTest().catch(console.error);
