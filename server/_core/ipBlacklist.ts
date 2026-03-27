import { Request, Response, NextFunction } from "express";
import { getBlacklist, checkIpBlocked, loadBlacklistToCache } from "../db";

// 扩展 global 类型
declare global {
  // eslint-disable-next-line no-var
  var ipBlacklistCache: any[];
}

// 定时器引用，用于清理
let cleanupTimer: NodeJS.Timeout | null = null;
let isInitialized = false;

/**
 * 初始化 IP 黑名单缓存
 */
export async function initBlacklistCache() {
  // 防止重复初始化
  if (isInitialized) {
    return;
  }
  isInitialized = true;

  await loadBlacklistToCache();
  console.log("[Blacklist] Cache initialized");

  // 定时刷新缓存（每 5 分钟）
  cleanupTimer = setInterval(
    async () => {
      await loadBlacklistToCache();
    },
    5 * 60 * 1000
  );
}

/**
 * 停止黑名单缓存刷新（用于优雅关闭）
 */
export function stopBlacklistCache() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    isInitialized = false;
    console.log("[Blacklist] Cache refresh stopped");
  }
}

/**
 * 获取客户端真实 IP
 */
function getClientIp(req: Request): string {
  // 优先从反向代理头获取
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = (
      typeof forwarded === "string" ? forwarded : forwarded[0]
    ).split(",");
    return ips[0].trim();
  }

  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * IP 黑名单中间件
 * 应用于需要 IP 过滤的路由
 */
export function ipBlacklistMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const clientIp = getClientIp(req);
  const blockInfo = checkIpBlocked(clientIp);

  if (blockInfo.blocked) {
    console.log(
      `[Blacklist] Blocked IP: ${clientIp}, reason: ${blockInfo.reason || "N/A"}`
    );
    return res.status(403).json({
      error: "Access Denied",
      message: "您的访问已被限制",
      reason: blockInfo.reason,
    });
  }

  next();
}

/**
 * 短链接专用黑名单中间件（更轻量）
 * 仅应用于 /s/:shortCode 和自定义域名路由
 */
export function redirectBlacklistMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const clientIp = getClientIp(req);
  const blockInfo = checkIpBlocked(clientIp);

  if (blockInfo.blocked) {
    // 关键修复：防止重定向循环。如果已经是 /error 路径，则不再次重定向
    if (req.path === "/error") {
      return next();
    }
    // 短链接访问被拦截，返回简单的错误页面
    return res.redirect(
      302,
      `/error?type=BLOCKED&reason=${encodeURIComponent(blockInfo.reason || "")}`
    );
  }

  next();
}
