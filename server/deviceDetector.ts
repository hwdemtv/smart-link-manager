/**
 * Device detection utility for smart redirect functionality
 * Optimized for speed and accuracy
 */

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface DeviceInfo {
  type: DeviceType;
  os?: string;
  browser?: string;
  userAgent: string;
}

// Pre-compiled regex patterns for performance
const MOBILE_PATTERN =
  /android|webos|iphone|ipod|blackberry|windows phone|opera mini|iemobile|mobile/i;

const TABLET_PATTERN =
  /ipad|tablet|kindle|playbook|nexus\s*[79]|xoom|silk|gt-p|sch-i|touchpad|postpc/i;

// Android tablet: contains "android" but NOT "mobile" (most Android tablets)
// Exception: WeChat/Weibo mobile apps that don't include "mobile" in UA
const ANDROID_TABLET_PATTERN = /android(?!.*mobile)(?!.*micromessenger)(?!.*weibo)/i;

// Known mobile apps that may not have "mobile" in UA
const MOBILE_APP_PATTERN = /micromessenger|weibo|qq\//i;

// OS patterns
const OS_PATTERNS: [RegExp, string][] = [
  [/windows nt|windows phone/i, "Windows"],
  [/macintosh|mac os x|iphone|ipad/i, "macOS"],
  [/android/i, "Android"],
  [/linux/i, "Linux"],
  [/cros/i, "ChromeOS"],
];

// Browser patterns (order matters - more specific first)
const BROWSER_PATTERNS: [RegExp, string][] = [
  [/edg\//i, "Edge"],
  [/edge/i, "Edge"],
  [/opr\//i, "Opera"],
  [/opera/i, "Opera"],
  [/chrome/i, "Chrome"],
  [/safari/i, "Safari"],
  [/firefox/i, "Firefox"],
  [/trident/i, "IE"],
  [/msie/i, "IE"],
];

/**
 * Parse User-Agent string to detect device type
 * Optimized for maximum speed with pre-compiled patterns
 */
export function detectDevice(userAgent: string): DeviceInfo {
  if (!userAgent) {
    return { type: "desktop", userAgent: "" };
  }

  const ua = userAgent.toLowerCase();

  // Fast path: check tablet first (more specific)
  let type: DeviceType = "desktop";

  // Check for known mobile apps first (WeChat, Weibo, QQ)
  if (MOBILE_APP_PATTERN.test(ua) && !/ipad/i.test(ua)) {
    type = "mobile";
  } else if (TABLET_PATTERN.test(ua) || ANDROID_TABLET_PATTERN.test(ua)) {
    type = "tablet";
  } else if (MOBILE_PATTERN.test(ua)) {
    type = "mobile";
  }
  // Default remains "desktop"

  // Detect OS (stop at first match)
  let os: string | undefined;
  for (const [pattern, name] of OS_PATTERNS) {
    if (pattern.test(ua)) {
      os = name;
      break;
    }
  }

  // Override OS for iOS devices
  if (/iphone|ipod/i.test(ua)) {
    os = "iOS";
  } else if (/ipad/i.test(ua)) {
    os = "iOS";
  }

  // Detect browser (stop at first match)
  let browser: string | undefined;
  for (const [pattern, name] of BROWSER_PATTERNS) {
    if (pattern.test(ua)) {
      browser = name;
      break;
    }
  }

  return {
    type,
    os,
    browser,
    userAgent,
  };
}

/**
 * Detect social media and search engine bots
 */
export function isBot(userAgent: string): boolean {
  const bots = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /rogerbot/i,
    /linkedinbot/i,
    /embedly/i,
    /quora link preview/i,
    /showyoubot/i,
    /outbrain/i,
    /pinterest/i,
    /slackbot/i,
    /vkShare/i,
    /W3C_Validator/i,
    /redditbot/i,
    /Applebot/i,
    /WhatsApp/i,
    /flipboard/i,
    /tumblr/i,
    /bitlybot/i,
    /SkypeShell/i,
    /TelegramBot/i,
    /Discordbot/i,
    /Bytespider/i,
    /Sogou/i,
    /360Spider/i,
  ];
  return bots.some(pattern => pattern.test(userAgent));
}

/**
 * Check if device is mobile
 */
export function isMobile(userAgent: string): boolean {
  return detectDevice(userAgent).type === "mobile";
}

/**
 * Check if device is tablet
 */
export function isTablet(userAgent: string): boolean {
  return detectDevice(userAgent).type === "tablet";
}

/**
 * Check if device is desktop
 */
export function isDesktop(userAgent: string): boolean {
  return detectDevice(userAgent).type === "desktop";
}
