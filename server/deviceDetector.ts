/**
 * Device detection utility for smart redirect functionality
 */

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface DeviceInfo {
  type: DeviceType;
  os?: string;
  browser?: string;
  userAgent: string;
}

/**
 * Parse User-Agent string to detect device type
 */
export function detectDevice(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();

  // Mobile detection patterns
  const mobilePattern =
    /android|webos|iphone|ipod|blackberry|windows phone|opera mini|iemobile/i;

  // Tablet detection patterns
  const tabletPatterns = [
    /ipad/,
    /android(?!.*mobile)/,
    /tablet/,
    /kindle/,
    /playbook/,
    /nexus 7/,
    /nexus 10/,
    /xoom/,
  ];

  let type: DeviceType = "desktop";
  let os: string | undefined;
  let browser: string | undefined;

  // Detect OS
  if (/windows/.test(ua)) {
    os = "Windows";
  } else if (/macintosh|mac os x/.test(ua)) {
    os = "macOS";
  } else if (/android/.test(ua)) {
    os = "Android";
  } else if (/iphone|ipod|ipad/.test(ua)) {
    os = "iOS";
  } else if (/linux/.test(ua)) {
    os = "Linux";
  }

  // Detect browser
  if (/chrome/.test(ua) && !/edge|edg/.test(ua)) {
    browser = "Chrome";
  } else if (/safari/.test(ua) && !/chrome/.test(ua)) {
    browser = "Safari";
  } else if (/firefox/.test(ua)) {
    browser = "Firefox";
  } else if (/edge|edg/.test(ua)) {
    browser = "Edge";
  } else if (/trident/.test(ua)) {
    browser = "Internet Explorer";
  }

  // Detect device type
  if (tabletPatterns.some(pattern => pattern.test(ua))) {
    type = "tablet";
  } else if (mobilePattern.test(ua)) {
    type = "mobile";
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
