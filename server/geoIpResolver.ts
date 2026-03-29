import { logger } from "./_core/logger";
import fs from "fs";
import path from "path";

interface GeoLocation {
  country?: string;
  city?: string;
}

// IP 缓存结构：包含数据过期时间
interface CachedGeoData {
  location: GeoLocation;
  expiresAt: number;
}

// In-memory LRU cache to avoid rate-limiting and accelerate lookups
// Key: IP Address, Value: CachedGeoData
const geoCache = new Map<string, CachedGeoData>();
const MAX_CACHE_SIZE = 50000; // 增加缓存大小
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 缓存 24 小时

// 请求频率限制器 (ip-api.com 免费版限制: 45 次/分钟)
const requestTimestamps: number[] = [];
const RATE_LIMIT_PER_MINUTE = 40; // 留 5 次余量
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 分钟窗口

function isRateLimited(): boolean {
  const now = Date.now();
  // 清理过期的请求记录
  while (
    requestTimestamps.length > 0 &&
    requestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS
  ) {
    requestTimestamps.shift();
  }
  return requestTimestamps.length >= RATE_LIMIT_PER_MINUTE;
}

function recordRequest(): void {
  requestTimestamps.push(Date.now());
}

// 清理过期缓存
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [ip, data] of geoCache.entries()) {
    if (data.expiresAt < now) {
      geoCache.delete(ip);
    }
  }
}

// MaxMind GeoLite2 离线库支持
// 需要安装: npm install @maxmind/geoip2-node
// 并下载 GeoLite2-City.mmdb 到项目目录
let maxmindReader: any = null;
let maxmindInitAttempted = false;

async function initMaxMind() {
  if (maxmindInitAttempted) return;
  maxmindInitAttempted = true;

  try {
    // 尝试加载 MaxMind 数据库
    const mmdbPath =
      process.env.MAXMIND_DB_PATH ||
      path.join(process.cwd(), "data", "GeoLite2-City.mmdb");

    if (!fs.existsSync(mmdbPath)) {
      logger.info(`[GeoIP] MaxMind 数据库未找到: ${mmdbPath}，跳过初始化`);
      return;
    }

    // 动态导入 maxmind 库
    const maxmind = await import("maxmind").catch(() => null);
    if (!maxmind) {
      logger.warn(
        "[GeoIP] maxmind 包未安装，无法使用离线库。运行: npm install maxmind"
      );
      return;
    }

    maxmindReader = await maxmind.default.open(mmdbPath);
    logger.info("[GeoIP] MaxMind 离线库初始化成功");
  } catch (error) {
    logger.warn(
      `[GeoIP] MaxMind 初始化失败: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

async function resolveViaMaxMind(ip: string): Promise<GeoLocation> {
  if (!maxmindReader) return {};

  try {
    const result = maxmindReader.get(ip);
    if (!result) return {};

    return {
      country: result.country?.names?.en || result.country?.isoCode,
      city: result.city?.names?.en,
    };
  } catch (error) {
    logger.warn(
      `[GeoIP] MaxMind 查询失败: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return {};
  }
}

async function resolveViaIpApi(ip: string): Promise<GeoLocation> {
  // 检查频率限制
  if (isRateLimited()) {
    logger.warn(`[GeoIP] 在线 API 请求频率已达上限，跳过 IP: ${ip}`);
    throw new Error("Rate limited");
  }

  recordRequest();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    // 使用 ip-api.com (免费版: 45次/分钟，支持 HTTP)
    // 注意：免费版不支持 HTTPS，但响应更快
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,city`,
      {
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`IP API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "fail") {
      throw new Error(`API returned fail for IP: ${ip}`);
    }

    return {
      country: data.country,
      city: data.city,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveGeoIp(
  ip: string | undefined
): Promise<GeoLocation> {
  if (
    !ip ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.")
  ) {
    return { country: "Local", city: "Local" };
  }

  const now = Date.now();

  // Check cache first (with expiry check)
  const cached = geoCache.get(ip);
  if (cached && cached.expiresAt > now) {
    return cached.location;
  }

  // 定期清理过期缓存
  if (geoCache.size > MAX_CACHE_SIZE / 2) {
    cleanExpiredCache();
  }

  // 初始化 MaxMind (仅首次)
  await initMaxMind();

  let result: GeoLocation = {};

  // 优先使用 MaxMind 离线库 (安全、无频率限制)
  if (maxmindReader) {
    result = await resolveViaMaxMind(ip);
    if (result.country) {
      logger.info(
        `[GeoIP] MaxMind 解析 ${ip} -> ${result.country}, ${result.city}`
      );
    }
  }

  // MaxMind 不可用或解析失败，回退到在线 API
  if (!result.country) {
    try {
      result = await resolveViaIpApi(ip);
      logger.info(
        `[GeoIP] 在线 API 解析 ${ip} -> ${result.country}, ${result.city}`
      );
    } catch (error) {
      logger.warn(
        `[GeoIP] 解析失败: ${ip} - ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // Maintain LRU cache size
  if (geoCache.size >= MAX_CACHE_SIZE) {
    const firstKey = geoCache.keys().next().value;
    if (firstKey) {
      geoCache.delete(firstKey);
    }
  }

  // Save to cache with TTL
  geoCache.set(ip, {
    location: result,
    expiresAt: now + CACHE_TTL_MS,
  });
  return result;
}
