import { describe, it, expect } from "vitest";

describe("Domains Logic", () => {
  describe("Domain Quota Verification", () => {
    it("should correctly evaluate limits based on customDomains usage", () => {
      const getQuotaStatus = (current: number, max: number) => {
        if (max === 0) return { allowed: false, reason: "none" };
        if (max === -1) return { allowed: true, reason: "unlimited" };
        if (current >= max) return { allowed: false, reason: "exceeded" };
        return { allowed: true, reason: "available" };
      };

      // Free tier: 0 custom domains
      expect(getQuotaStatus(0, 0)).toEqual({ allowed: false, reason: "none" });

      // Pro tier: up to 3 domains
      expect(getQuotaStatus(2, 3)).toEqual({
        allowed: true,
        reason: "available",
      });
      expect(getQuotaStatus(3, 3)).toEqual({
        allowed: false,
        reason: "exceeded",
      });

      // Enterprise tier: unlimited domains (-1)
      expect(getQuotaStatus(100, -1)).toEqual({
        allowed: true,
        reason: "unlimited",
      });
    });
  });

  describe("Domain URL Parsing", () => {
    it("should extract correct hostnames from different formats", () => {
      const extractDomain = (input: string) => {
        try {
          // Add protocol if missing for URL parser
          const urlStr = input.startsWith("http") ? input : `https://${input}`;
          return new URL(urlStr).hostname;
        } catch {
          return null;
        }
      };

      expect(extractDomain("google.com")).toBe("google.com");
      expect(extractDomain("https://app.example.com/login")).toBe(
        "app.example.com"
      );
      expect(extractDomain("http://localhost:3000")).toBe("localhost");
    });
  });
});
