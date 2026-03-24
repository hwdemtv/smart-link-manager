import { Request, Response, NextFunction } from "express";

// ============================================================================
// 零依赖内存速率限制器 (In-Memory Rate Limiter)
// ============================================================================

interface RateLimitStore {
  [ip: string]: {
    count: number;
    resetTime: number;
  };
}

// 存储所有定时器引用，用于清理
const cleanupTimers: NodeJS.Timeout[] = [];

// 配置常量
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟清理一次
const MAX_STORE_SIZE = 10000; // 最大存储条目数

const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: any;
}) => {
  const store: RateLimitStore = {};

  // 定期清理过期条目，防止内存泄漏
  const timer = setInterval(() => {
    const now = Date.now();
    const expiredIps: string[] = [];

    for (const ip in store) {
      if (now > store[ip].resetTime) {
        expiredIps.push(ip);
      }
    }

    if (expiredIps.length > 0) {
      expiredIps.forEach(ip => delete store[ip]);
      // 仅在清理数量较多时记录日志
      if (expiredIps.length > 100) {
        console.log(
          `[RateLimiter] Cleaned up ${expiredIps.length} expired entries`
        );
      }
    }
  }, CLEANUP_INTERVAL_MS);

  cleanupTimers.push(timer);

  return (req: Request, res: Response, next: NextFunction) => {
    // 获取客户端真实 IP
    // trust proxy 已配置，req.ip 会是代理链中正确的客户端 IP
    // 不直接读取 X-Forwarded-For，避免伪造攻击
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    // 检查并清理超大的 store
    if (Object.keys(store).length > MAX_STORE_SIZE) {
      const entries = Object.entries(store);
      entries.sort((a, b) => a[1].resetTime - b[1].resetTime);
      const toDelete = entries.slice(0, Math.floor(MAX_STORE_SIZE * 0.2));
      toDelete.forEach(([ip]) => delete store[ip]);
    }

    if (!store[ip]) {
      store[ip] = { count: 1, resetTime: now + options.windowMs };
      return next();
    }

    if (now > store[ip].resetTime) {
      store[ip].count = 1;
      store[ip].resetTime = now + options.windowMs;
      return next();
    }

    store[ip].count++;

    if (store[ip].count > options.max) {
      res.status(429).json(options.message);
      return;
    }

    next();
  };
};

/**
 * 停止所有速率限制器的定时器（用于优雅关闭）
 */
export function stopAllRateLimiters() {
  cleanupTimers.forEach(timer => clearInterval(timer));
  cleanupTimers.length = 0;
  console.log("[RateLimiter] All cleanup timers stopped");
}

/**
 * 针对短链接解析 (Visitor Redirects) 的标准速率限制
 * 策略: 100 requests per 1 minute per IP.
 */
export const redirectRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 分钟
  max: 100,
  message: {
    error: "Too Many Requests",
    message: "您请求解析的频率过高，请稍后重试。",
  },
});

/**
 * 针对敏感接口 (如密码验证、登录等) 的严格速率限制
 * 策略: 20 requests per 5 minutes per IP.
 */
export const strictAuthRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 分钟
  max: 20,
  message: {
    error: "Too Many Requests",
    message: "安全封禁：操作过于频繁，请等待 5 分钟后再试。",
  },
});
