import Queue from "bull";
import { getLinksByUserId, recordLinkCheck, updateLinkValidity, createNotification, getDb } from "./db";
import { checkLinkValidity } from "./linkChecker";
import { links } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Create job queues
export const linkCheckQueue = new Queue("link-check", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

export const notificationQueue = new Queue("notifications", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

/**
 * Process link validity check jobs
 */
linkCheckQueue.process(async (job) => {
  const { linkId, originalUrl, userId } = job.data;

  try {
    // Check link validity
    const result = await checkLinkValidity(originalUrl);

    // Record the check result
    await recordLinkCheck({
      linkId,
      isValid: result.isValid ? 1 : 0,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
    });

    // Update link validity status
    await updateLinkValidity(linkId, result.isValid ? 1 : 0);

    // If link became invalid, create notification
    if (!result.isValid) {
      await createNotification({
        userId,
        linkId,
        type: "link_invalid",
        title: "Link Validity Alert",
        message: `Your link has been detected as invalid. Status: ${result.statusCode || "Unknown"}`,
      });
    }

    return { success: true, isValid: result.isValid };
  } catch (error) {
    console.error(`[Link Check Job] Error checking link ${linkId}:`, error);
    throw error;
  }
});

/**
 * Schedule periodic link validity checks
 * Runs every hour
 */
export async function schedulePeriodicLinkChecks() {
  // Clear existing recurring job
  const existingJobs = await linkCheckQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await linkCheckQueue.removeRepeatableByKey(job.key);
  }

  // Add new recurring job - every hour
  await linkCheckQueue.add(
    { type: "batch-check" },
    {
      repeat: {
        cron: "0 * * * *", // Every hour at minute 0
      },
      jobId: "batch-link-check",
    }
  );

  console.log("[Jobs] Scheduled periodic link checks");
}

/**
 * Batch check all links
 */
linkCheckQueue.process("batch-check", async (job) => {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[Batch Check] Database not available");
      return;
    }

    // Get all active links
    const allLinks = await db.select().from(links).where(eq(links.isActive, 1));

    console.log(`[Batch Check] Checking ${allLinks.length} links...`);

    // Queue individual check jobs
    for (const link of allLinks) {
      await linkCheckQueue.add(
        {
          linkId: link.id,
          originalUrl: link.originalUrl,
          userId: link.userId,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: true,
        }
      );
    }

    return { checked: allLinks.length };
  } catch (error) {
    console.error("[Batch Check] Error:", error);
    throw error;
  }
});

/**
 * Add a single link to the check queue
 */
export async function queueLinkCheck(linkId: number, originalUrl: string, userId: number) {
  await linkCheckQueue.add(
    {
      linkId,
      originalUrl,
      userId,
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: true,
    }
  );
}

/**
 * Handle job failures
 */
linkCheckQueue.on("failed", (job, err) => {
  console.error(`[Link Check Job] Failed - Job ${job.id}:`, err.message);
});

linkCheckQueue.on("completed", (job) => {
  console.log(`[Link Check Job] Completed - Job ${job.id}`);
});

/**
 * Initialize job schedulers
 */
export async function initializeJobSchedulers() {
  try {
    await schedulePeriodicLinkChecks();
    console.log("[Jobs] Job schedulers initialized");
  } catch (error) {
    console.error("[Jobs] Failed to initialize schedulers:", error);
  }
}

/**
 * Graceful shutdown
 */
export async function shutdownJobQueues() {
  try {
    await linkCheckQueue.close();
    await notificationQueue.close();
    console.log("[Jobs] Job queues closed");
  } catch (error) {
    console.error("[Jobs] Error closing queues:", error);
  }
}
