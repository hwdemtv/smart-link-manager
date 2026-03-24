import Queue from "bull";
import { z } from "zod";
import {
  getLinksByUserId,
  recordLinkCheck,
  updateLinkValidity,
  createNotification,
  getDb,
} from "./db";
import { checkLinkValidity } from "./linkChecker";
import { links } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ============================================================================
// Redis 连接状态与优雅降级
// ============================================================================
let redisAvailable = false;
let linkCheckQueue: Queue.Queue | null = null;
let notificationQueue: Queue.Queue | null = null;

// 尝试创建队列，如果 Redis 不可用则优雅降级
async function initializeQueues(): Promise<void> {
  const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  };

  try {
    linkCheckQueue = new Queue("link-check", { redis: redisConfig });
    notificationQueue = new Queue("notifications", { redis: redisConfig });

    // 测试 Redis 连接
    await linkCheckQueue.isReady();
    redisAvailable = true;
    console.log("[Jobs] Redis connected, job queues enabled");

    // 设置队列处理器（仅在 Redis 可用时）
    setupQueueProcessors();
  } catch (error) {
    console.warn("[Jobs] Redis not available, job queues disabled:", (error as Error).message);
    redisAvailable = false;
    linkCheckQueue = null;
    notificationQueue = null;
  }
}

/**
 * 设置队列处理器
 */
function setupQueueProcessors(): void {
  if (!linkCheckQueue) return;

  // 处理单个链接检查任务
  linkCheckQueue.process(async job => {
    const { linkId, originalUrl, userId } = job.data;

    try {
      const result = await checkLinkValidity(originalUrl);

      await recordLinkCheck({
        linkId,
        isValid: result.isValid ? 1 : 0,
        statusCode: result.statusCode,
        errorMessage: result.errorMessage,
      });

      await updateLinkValidity(linkId, result.isValid ? 1 : 0);

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

  // 批量检查任务
  linkCheckQueue.process("batch-check", async () => {
    try {
      const db = await getDb();
      if (!db) {
        console.warn("[Batch Check] Database not available");
        return;
      }

      const allLinks = await db.select().from(links).where(eq(links.isActive, 1));
      console.log(`[Batch Check] Checking ${allLinks.length} links...`);

      for (const link of allLinks) {
        await linkCheckQueue!.add(
          { linkId: link.id, originalUrl: link.originalUrl, userId: link.userId },
          { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: true }
        );
      }

      return { checked: allLinks.length };
    } catch (error) {
      console.error("[Batch Check] Error:", error);
      throw error;
    }
  });

  // 错误处理
  linkCheckQueue.on("failed", (job, err) => {
    console.error(`[Link Check Job] Failed - Job ${job.id}:`, err.message);
  });

  linkCheckQueue.on("error", err => {
    console.error("[Link Check Queue] Global Error:", err);
  });

  linkCheckQueue.on("completed", job => {
    console.log(`[Link Check Job] Completed - Job ${job.id}`);
  });
}

// 立即初始化
initializeQueues();

// 导出队列（可能为 null）
export { linkCheckQueue, notificationQueue };

/**
 * Schedule periodic link validity checks
 * Runs every hour
 */
export async function schedulePeriodicLinkChecks() {
  if (!linkCheckQueue || !redisAvailable) {
    console.log("[Jobs] Skipping periodic link checks - Redis not available");
    return;
  }

  const existingJobs = await linkCheckQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await linkCheckQueue.removeRepeatableByKey(job.key);
  }

  await linkCheckQueue.add(
    { type: "batch-check" },
    { repeat: { cron: "0 * * * *" }, jobId: "batch-link-check" }
  );

  console.log("[Jobs] Scheduled periodic link checks");
}

/**
 * Add a single link to the check queue
 */
export async function queueLinkCheck(
  linkId: number,
  originalUrl: string,
  userId: number
) {
  if (!linkCheckQueue || !redisAvailable) {
    console.log("[Jobs] Skipping link check - Redis not available");
    return;
  }

  await linkCheckQueue.add(
    { linkId, originalUrl, userId },
    { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: true }
  );
}

/**
 * Initialize job schedulers
 */
export async function initializeJobSchedulers() {
  if (!redisAvailable) {
    console.log("[Jobs] Skipping scheduler initialization - Redis not available");
    return;
  }

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
    if (linkCheckQueue) await linkCheckQueue.close();
    if (notificationQueue) await notificationQueue.close();
    console.log("[Jobs] Job queues closed");
  } catch (error) {
    console.error("[Jobs] Error closing queues:", error);
  }
}
