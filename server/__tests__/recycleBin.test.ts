import { describe, it, expect } from "vitest";

describe("Recycle Bin Logic", () => {
  describe("Soft Delete and Restore Checks", () => {
    it("should correctly mark a link as deleted and preserve original code", () => {
      const link = {
        id: 100,
        shortCode: "my-promo",
        isDeleted: 0,
        deletedAt: null as Date | null,
        originalShortCode: null as string | null,
      };

      const softDelete = (l: typeof link) => {
        return {
          ...l,
          isDeleted: 1,
          deletedAt: new Date(),
          originalShortCode: l.shortCode,
          shortCode: `del_${Math.random().toString(36).substring(2, 7)}`,
        };
      };

      const deletedLink = softDelete(link);

      expect(deletedLink.isDeleted).toBe(1);
      expect(deletedLink.originalShortCode).toBe("my-promo");
      expect(deletedLink.shortCode.startsWith("del_")).toBe(true);
      expect(deletedLink.deletedAt).toBeInstanceOf(Date);
    });

    it("should correctly restore a link if shortcode is available", () => {
      const deletedLink = {
        id: 100,
        shortCode: "del_x1y2z",
        isDeleted: 1,
        deletedAt: new Date(),
        originalShortCode: "my-promo",
      };

      const restore = (l: typeof deletedLink) => {
        return {
          ...l,
          isDeleted: 0,
          deletedAt: null,
          shortCode: l.originalShortCode,
          originalShortCode: null,
        };
      };

      const restoredLink = restore(deletedLink);
      expect(restoredLink.isDeleted).toBe(0);
      expect(restoredLink.shortCode).toBe("my-promo");
      expect(restoredLink.originalShortCode).toBeNull();
      expect(restoredLink.deletedAt).toBeNull();
    });
  });
});
