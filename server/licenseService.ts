import { ENV } from "./_core/env";

// License server URL - required in production
const getLicenseServerUrls = (): string[] => {
  const urls = [...ENV.licenseServerUrls];
  if (ENV.licenseServerUrl) {
    if (!urls.includes(ENV.licenseServerUrl)) {
      urls.unshift(ENV.licenseServerUrl); // LICENSE_SERVER_URL 优先级更高
    }
  }

  if (urls.length === 0) {
    if (ENV.isProduction) {
      throw new Error(
        "LICENSE_SERVER_URL or LICENSE_SERVER_URLS environment variable is required in production"
      );
    }
    return [];
  }
  return urls;
};

// Product IDs for different subscription tiers
export const PRODUCT_IDS = {
  PRO: "smart-link-pro",
  BUSINESS: "smart-link-business",
} as const;

// Subscription tier mapping
export const TIER_MAP: Record<string, string> = {
  [PRODUCT_IDS.PRO]: "pro",
  [PRODUCT_IDS.BUSINESS]: "business",
};

// License verification response from hw-license-center
interface LicenseVerifyResponse {
  success: boolean;
  msg: string;
  token?: string;
  server_time?: string;
  products?: Array<{
    product_id: string;
    status: "active" | "inactive";
    expires_at: string | null;
  }>;
}

// License unbind response
interface LicenseUnbindResponse {
  success: boolean;
  msg: string;
}

export interface LicenseActivationResult {
  success: boolean;
  message: string;
  tier?: string;
  expiresAt?: Date | null;
  token?: string;
}

export const licenseService = {
  /**
   * Verify and activate a license key with hw-license-center
   * @param licenseKey The license key to verify
   * @param deviceId User's unique identifier (we use user ID)
   * @param deviceName Optional device name for display in license center
   */
  async verifyLicense(
    licenseKey: string,
    deviceId: string,
    deviceName?: string
  ): Promise<LicenseActivationResult> {
    const urls = getLicenseServerUrls();
    if (urls.length === 0) {
      return {
        success: false,
        message: "License server not configured",
      };
    }

    let lastError: any = null;

    for (const baseUrl of urls) {
      try {
        console.log(`[LicenseService] Trying to verify with ${baseUrl}...`);
        const response = await fetch(`${baseUrl}/api/v1/auth/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            license_key: licenseKey,
            device_id: deviceId,
            device_name: deviceName,
          }),
        });

        if (!response.ok) {
           const errorText = await response.text();
           console.warn(`[LicenseService] Server ${baseUrl} returned ${response.status}: ${errorText.substring(0, 100)}`);
           continue; // 尝试下一个地址
        }

        const data: LicenseVerifyResponse = await response.json();

        if (!data.success) {
          return {
            success: false,
            message: data.msg || "License verification failed",
          };
        }

        // Find matching product for Smart Link Manager
        let matchedProduct: {
          product_id: string;
          status: string;
          expires_at: string | null;
        } | null = null;

        if (data.products && data.products.length > 0) {
          // First try to find business tier
          matchedProduct =
            data.products.find(
              p => p.product_id === PRODUCT_IDS.BUSINESS && p.status === "active"
            ) || null;

          // If no business, try pro tier
          if (!matchedProduct) {
            matchedProduct =
              data.products.find(
                p => p.product_id === PRODUCT_IDS.PRO && p.status === "active"
              ) || null;
          }
        }

        if (!matchedProduct) {
          return {
            success: false,
            message:
              "No valid Smart Link Manager subscription found in this license",
          };
        }

        const tier = TIER_MAP[matchedProduct.product_id] || "free";
        const expiresAt = matchedProduct.expires_at
          ? new Date(matchedProduct.expires_at)
          : null;

        return {
          success: true,
          message: "License activated successfully",
          tier,
          expiresAt,
          token: data.token,
        };
      } catch (error) {
        lastError = error;
        console.error(`[LicenseService] Error with ${baseUrl}:`, error);
        // Continue to next URL
      }
    }

    return {
      success: false,
      message: lastError?.message || "Failed to reach any license server",
    };
  },

  /**
   * Unbind a device from a license key
   * @param licenseKey The license key to unbind
   * @param deviceId The device ID that was bound
   */
  async unbindLicense(
    licenseKey: string,
    deviceId: string
  ): Promise<{ success: boolean; message: string }> {
    const urls = getLicenseServerUrls();
    if (urls.length === 0) {
      return {
        success: false,
        message: "License server not configured",
      };
    }

    let lastError: any = null;

    for (const baseUrl of urls) {
      try {
        const response = await fetch(`${baseUrl}/api/v1/auth/unbind`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            license_key: licenseKey,
            device_id: deviceId,
          }),
        });

        if (!response.ok) continue;

        const data: LicenseUnbindResponse = await response.json();

        return {
          success: data.success,
          message: data.msg,
        };
      } catch (error) {
        lastError = error;
        console.error(`[LicenseService] Unbind error with ${baseUrl}:`, error);
      }
    }

    return {
      success: false,
      message: lastError?.message || "Failed to reach any license server to unbind",
    };
  },

  /**
   * Check if a subscription is still valid (not expired)
   */
  isSubscriptionValid(expiresAt: Date | null): boolean {
    if (!expiresAt) return true; // null means permanent/perpetual license
    return new Date() < expiresAt;
  },

  /**
   * Get subscription tier limits
   */
  getTierLimits(tier: string): {
    maxLinks: number;
    maxDomains: number;
    maxApiKeys: number;
    monthlyLinksCreated: number; // 每月创建上限
  } {
    switch (tier) {
      case "business":
        return { maxLinks: -1, maxDomains: 10, maxApiKeys: 10, monthlyLinksCreated: 5000 };
      case "pro":
        return { maxLinks: 500, maxDomains: 5, maxApiKeys: 5, monthlyLinksCreated: -1 }; // Pro 是买断，无月限制
      case "free":
      default:
        return { maxLinks: 20, maxDomains: 1, maxApiKeys: 1, monthlyLinksCreated: -1 }; // Free 也是总量限制
    }
  },
};
