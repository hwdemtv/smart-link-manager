import { describe, it, expect, vi } from "vitest";
import { renderQRPage } from "./redirectHandler";
import { Link } from "../drizzle/schema";

vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mock"),
}));

vi.mock("./_core/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("redirectHandler - renderQRPage (Unit Test)", () => {
  it("should contain the QR code tip in the rendered HTML output", async () => {
    const mockRes: any = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    const mockLink: Partial<Link> = {
      id: 1,
      shortCode: "test",
      originalUrl: "https://example.com/target",
      description: "Test description",
      isActive: 1,
      isValid: 1,
    };

    await renderQRPage(mockRes, "test", "https://example.com/s/test", mockLink as Link, "zh");

    expect(mockRes.status).toHaveBeenCalledWith(200);
    const html = mockRes.send.mock.calls[0][0];
    
    // Check for the tip text in Chinese
    expect(html).toContain("使用手机相机或微信扫码访问");
    expect(html).toContain("安全验证中心 · Smart Link Manager");
  });

  it("should contain the QR code tip in English when language is set to 'en'", async () => {
    const mockRes: any = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    const mockLink: Partial<Link> = {
      id: 1,
      shortCode: "test",
      originalUrl: "https://example.com/target",
    };

    await renderQRPage(mockRes, "test", "https://example.com/s/test", mockLink as Link, "en");

    const html = mockRes.send.mock.calls[0][0];
    
    // Check for the tip text in English
    expect(html).toContain("Scan with WeChat or Long press");
    expect(html).toContain("Security Center · Smart Link Manager");
  });
});
