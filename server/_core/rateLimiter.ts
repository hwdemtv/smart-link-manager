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

const createRateLimiter = (options: { windowMs: number; max: number; message: any }) => {
  const store: RateLimitStore = {};

  return (req: Request, res: Response, next: NextFunction) => {
    // 优先从反向代理头获取真实 IP
    const ip = (req.headers["x-forwarded-for"] as string)?.split(',')[0] || req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

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
