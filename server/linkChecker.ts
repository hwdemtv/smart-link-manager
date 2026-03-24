import axios from "axios";

export interface LinkCheckResult {
  isValid: boolean;
  statusCode?: number;
  errorMessage?: string;
  provider?: string;
}

/**
 * Detect cloud storage provider from URL
 */
function detectProvider(url: string): string {
  if (url.includes("pan.baidu.com")) return "baidu";
  if (url.includes("aliyundrive.com") || url.includes("www.aliyundrive.com"))
    return "aliyun";
  if (url.includes("quark.cn")) return "quark";
  return "unknown";
}

/**
 * Check if a Baidu cloud link is valid
 */
async function checkBaiduLink(url: string): Promise<LinkCheckResult> {
  try {
    const response = await axios.head(url, {
      timeout: 5000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    // Baidu returns 200 for valid links, 404 for invalid
    const isValid = response.status === 200;
    return {
      isValid,
      statusCode: response.status,
      provider: "baidu",
    };
  } catch (error: any) {
    const statusCode = error.response?.status;
    const isValid = statusCode !== 404;

    return {
      isValid,
      statusCode,
      errorMessage: error.message,
      provider: "baidu",
    };
  }
}

/**
 * Check if an Aliyun cloud link is valid
 */
async function checkAliyunLink(url: string): Promise<LinkCheckResult> {
  try {
    const response = await axios.head(url, {
      timeout: 5000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const isValid = response.status === 200;
    return {
      isValid,
      statusCode: response.status,
      provider: "aliyun",
    };
  } catch (error: any) {
    const statusCode = error.response?.status;
    const isValid = statusCode !== 404 && statusCode !== 403;

    return {
      isValid,
      statusCode,
      errorMessage: error.message,
      provider: "aliyun",
    };
  }
}

/**
 * Check if a Quark cloud link is valid
 */
async function checkQuarkLink(url: string): Promise<LinkCheckResult> {
  try {
    const response = await axios.head(url, {
      timeout: 5000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const isValid = response.status === 200;
    return {
      isValid,
      statusCode: response.status,
      provider: "quark",
    };
  } catch (error: any) {
    const statusCode = error.response?.status;
    const isValid = statusCode !== 404 && statusCode !== 403;

    return {
      isValid,
      statusCode,
      errorMessage: error.message,
      provider: "quark",
    };
  }
}

/**
 * Generic link validity check
 */
async function checkGenericLink(url: string): Promise<LinkCheckResult> {
  try {
    const response = await axios.head(url, {
      timeout: 5000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const isValid = response.status >= 200 && response.status < 400;
    return {
      isValid,
      statusCode: response.status,
    };
  } catch (error: any) {
    const statusCode = error.response?.status;
    const isValid = statusCode !== 404 && statusCode !== 403;

    return {
      isValid,
      statusCode,
      errorMessage: error.message,
    };
  }
}

/**
 * Main function to check link validity
 * Automatically detects provider and uses appropriate checker
 */
export async function checkLinkValidity(url: string): Promise<LinkCheckResult> {
  try {
    const provider = detectProvider(url);

    switch (provider) {
      case "baidu":
        return await checkBaiduLink(url);
      case "aliyun":
        return await checkAliyunLink(url);
      case "quark":
        return await checkQuarkLink(url);
      default:
        return await checkGenericLink(url);
    }
  } catch (error: any) {
    return {
      isValid: false,
      errorMessage: error.message || "Unknown error",
    };
  }
}

/**
 * Batch check multiple links
 */
export async function batchCheckLinks(
  urls: string[]
): Promise<Map<string, LinkCheckResult>> {
  const results = new Map<string, LinkCheckResult>();

  for (const url of urls) {
    const result = await checkLinkValidity(url);
    results.set(url, result);
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}
