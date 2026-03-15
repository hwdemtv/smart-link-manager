import { logger } from "./_core/logger";

interface GeoLocation {
  country?: string;
  city?: string;
}

// In-memory LRU cache to avoid rate-limiting and accelerate lookups
// Key: IP Address, Value: GeoLocation
const geoCache = new Map<string, GeoLocation>();
const MAX_CACHE_SIZE = 10000;

export async function resolveGeoIp(ip: string | undefined): Promise<GeoLocation> {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return { country: "Local", city: "Local" };
  }

  // Check cache first
  if (geoCache.has(ip)) {
    logger.info(`[GeoIP] Cache hit for IP: ${ip}`);
    return geoCache.get(ip)!;
  }

  try {
    logger.info(`[GeoIP] Resolving IP: ${ip} via ip-api.com`);
    // using ip-api.com (Free tier allows 45 requests per minute)
    // We use timeout to ensure it doesn't block the redirect flow significantly
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout for GeoIP

    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,status`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`IP API returned ${response.status}`);
    }

    const data = await response.json();
    
    let result: GeoLocation = {};
    if (data.status === "success") {
      result = {
        country: data.country,
        city: data.city,
      };
      logger.info(`[GeoIP] Resolved ${ip} to ${result.country}, ${result.city}`);
    } else {
      logger.warn(`[GeoIP] API returned failure status for ${ip}: ${JSON.stringify(data)}`);
    }

    // Maintain LRU cache size
    if (geoCache.size >= MAX_CACHE_SIZE) {
      // Delete the oldest entry (Map iterates in insertion order)
      const firstKey = geoCache.keys().next().value;
      if (firstKey) {
        geoCache.delete(firstKey);
      }
    }

    // Save to cache
    geoCache.set(ip, result);
    return result;

  } catch (error) {
    logger.warn(`[GeoIP] 难以解析 IP ${ip}: ${error instanceof Error ? error.message : "Unknown error"}`);
    // Cache the failure as empty to avoid repeating bad queries
    const emptyResult = {};
    geoCache.set(ip, emptyResult);
    return emptyResult;
  }
}
