import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { subscriptionPlans } from "../drizzle/schema";

/**
 * Seed subscription plans
 * Run with: npx tsx server/seedPlans.ts
 */
async function seedPlans() {
  console.log("Seeding subscription plans...");

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);

  const plans = [
    {
      name: "Free",
      slug: "free",
      description: "Perfect for trying out the platform",
      monthlyPrice: 0,
      yearlyPrice: 0,
      maxLinks: 50,
      maxApiCallsPerDay: 100,
      maxCustomDomains: 1,
      features: JSON.stringify([
        "Up to 50 short links",
        "100 API calls per day",
        "1 custom domain",
        "Basic analytics",
        "Email support",
      ]),
      isActive: 1,
    },
    {
      name: "Pro",
      slug: "pro",
      description: "For growing businesses and teams",
      monthlyPrice: 1999, // $19.99
      yearlyPrice: 19990, // $199.90 (~$16.66/month)
      maxLinks: 1000,
      maxApiCallsPerDay: 5000,
      maxCustomDomains: 5,
      features: JSON.stringify([
        "Up to 1,000 short links",
        "5,000 API calls per day",
        "5 custom domains",
        "Advanced analytics",
        "AI SEO generation",
        "Password protected links",
        "Priority support",
      ]),
      isActive: 1,
    },
    {
      name: "Business",
      slug: "business",
      description: "For larger teams and enterprises",
      monthlyPrice: 4999, // $49.99
      yearlyPrice: 49990, // $499.90 (~$41.66/month)
      maxLinks: 10000,
      maxApiCallsPerDay: 50000,
      maxCustomDomains: 20,
      features: JSON.stringify([
        "Up to 10,000 short links",
        "50,000 API calls per day",
        "20 custom domains",
        "Full analytics suite",
        "Unlimited AI SEO generation",
        "Bulk operations",
        "Team collaboration",
        "Dedicated support",
      ]),
      isActive: 1,
    },
    {
      name: "Enterprise",
      slug: "enterprise",
      description: "Custom solutions for large organizations",
      monthlyPrice: 0, // Custom pricing
      yearlyPrice: 0,
      maxLinks: -1, // Unlimited
      maxApiCallsPerDay: -1, // Unlimited
      maxCustomDomains: -1, // Unlimited
      features: JSON.stringify([
        "Unlimited short links",
        "Unlimited API calls",
        "Unlimited custom domains",
        "Custom branding",
        "SSO integration",
        "Dedicated infrastructure",
        "SLA guarantee",
        "24/7 phone support",
        "Custom feature development",
      ]),
      isActive: 1,
    },
  ];

  try {
    for (const plan of plans) {
      await db.insert(subscriptionPlans).values(plan).onDuplicateKeyUpdate({
        set: {
          name: plan.name,
          description: plan.description,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          maxLinks: plan.maxLinks,
          maxApiCallsPerDay: plan.maxApiCallsPerDay,
          maxCustomDomains: plan.maxCustomDomains,
          features: plan.features,
          isActive: plan.isActive,
        },
      });
      console.log(`✓ Upserted plan: ${plan.name}`);
    }
    console.log("✅ All subscription plans seeded successfully!");
  } catch (error) {
    console.error("Error seeding plans:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }

  process.exit(0);
}

seedPlans();
