import { ENV } from './_core/env';

// License server URL - required in production
const getLicenseServerUrl = (): string => {
  const url = ENV.licenseServerUrl;
  if (!url) {
    if (ENV.isProduction) {
      throw new Error('LICENSE_SERVER_URL environment variable is required in production');
    }
    // In development, return empty string to allow graceful failure
    return '';
  }
  return url;
};

// Product IDs for different subscription tiers
export const PRODUCT_IDS = {
  PRO: 'smart-link-pro',
  BUSINESS: 'smart-link-business',
} as const;

// Subscription tier mapping
export const TIER_MAP: Record<string, string> = {
  [PRODUCT_IDS.PRO]: 'pro',
  [PRODUCT_IDS.BUSINESS]: 'business',
};

// License verification response from hw-license-center
interface LicenseVerifyResponse {
  success: boolean;
  msg: string;
  token?: string;
  server_time?: string;
  products?: Array<{
    product_id: string;
    status: 'active' | 'inactive';
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
    try {
      const licenseServerUrl = getLicenseServerUrl();
      if (!licenseServerUrl) {
        return {
          success: false,
          message: 'License server not configured',
        };
      }

      const response = await fetch(`${licenseServerUrl}/api/v1/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          license_key: licenseKey,
          device_id: deviceId,
          device_name: deviceName,
        }),
      });

      const data: LicenseVerifyResponse = await response.json();

      if (!data.success) {
        return {
          success: false,
          message: data.msg || 'License verification failed',
        };
      }

      // Find matching product for Smart Link Manager
      let matchedProduct: { product_id: string; status: string; expires_at: string | null } | null = null;

      if (data.products && data.products.length > 0) {
        // First try to find business tier
        matchedProduct = data.products.find(
          (p) => p.product_id === PRODUCT_IDS.BUSINESS && p.status === 'active'
        ) || null;

        // If no business, try pro tier
        if (!matchedProduct) {
          matchedProduct = data.products.find(
            (p) => p.product_id === PRODUCT_IDS.PRO && p.status === 'active'
          ) || null;
        }
      }

      if (!matchedProduct) {
        return {
          success: false,
          message: 'No valid Smart Link Manager subscription found in this license',
        };
      }

      const tier = TIER_MAP[matchedProduct.product_id] || 'free';
      const expiresAt = matchedProduct.expires_at ? new Date(matchedProduct.expires_at) : null;

      return {
        success: true,
        message: 'License activated successfully',
        tier,
        expiresAt,
        token: data.token,
      };
    } catch (error) {
      console.error('[LicenseService] Verification error:', error);
      return {
        success: false,
        message: 'Failed to connect to license server',
      };
    }
  },

  /**
   * Unbind a device from a license key
   * @param licenseKey The license key to unbind
   * @param deviceId The device ID that was bound
   */
  async unbindLicense(licenseKey: string, deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const licenseServerUrl = getLicenseServerUrl();
      if (!licenseServerUrl) {
        return {
          success: false,
          message: 'License server not configured',
        };
      }

      const response = await fetch(`${licenseServerUrl}/api/v1/auth/unbind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          license_key: licenseKey,
          device_id: deviceId,
        }),
      });

      const data: LicenseUnbindResponse = await response.json();

      return {
        success: data.success,
        message: data.msg,
      };
    } catch (error) {
      console.error('[LicenseService] Unbind error:', error);
      return {
        success: false,
        message: 'Failed to connect to license server',
      };
    }
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
  getTierLimits(tier: string): { maxLinks: number; maxDomains: number; maxApiKeys: number } {
    switch (tier) {
      case 'business':
        return { maxLinks: -1, maxDomains: 10, maxApiKeys: 10 }; // -1 means unlimited
      case 'pro':
        return { maxLinks: 500, maxDomains: 5, maxApiKeys: 5 };
      case 'free':
      default:
        return { maxLinks: 20, maxDomains: 1, maxApiKeys: 1 };
    }
  },
};
