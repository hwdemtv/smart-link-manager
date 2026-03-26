import { describe, it, expect, vi } from "vitest";
import { handleTrpcError, translateServerError, isErrorCode } from "../errorUtils";
import { TRPCClientError } from "@trpc/client";
import { ErrorCodes } from "@shared/errorCodes";

describe("errorUtils", () => {
  // 模拟翻译函数
  const t = vi.fn((key: string) => `translated_${key}`) as any;

  describe("translateServerError", () => {
    it("应该翻译已知的错误码", () => {
      const result = translateServerError(t, ErrorCodes.LINK_SHORT_CODE_EXISTS);
      expect(result).toBe(`translated_serverError.${ErrorCodes.LINK_SHORT_CODE_EXISTS}`);
      expect(t).toHaveBeenCalled();
    });

    it("对于未知错误码应返回 UNKNOWN_ERROR", () => {
      const result = translateServerError(t, "NON_EXISTENT_CODE");
      expect(result).toBe("translated_serverError.UNKNOWN_ERROR");
    });
  });

  describe("isErrorCode", () => {
    it("应该正确识别合法错误码", () => {
      expect(isErrorCode(ErrorCodes.AUTH_INVALID_CREDENTIALS)).toBe(true);
      expect(isErrorCode("RANDOM_STRING")).toBe(false);
    });
  });

  describe("handleTrpcError", () => {
    it("应该处理 TRPCClientError 并翻译其错误码消息", () => {
      const error = new TRPCClientError(ErrorCodes.LINK_NOT_FOUND);
      const result = handleTrpcError(t, error);
      expect(result).toBe(`translated_serverError.${ErrorCodes.LINK_NOT_FOUND}`);
    });

    it("如果 TRPCClientError 消息不是错误码，应返回原消息", () => {
      const rawMessage = "Something went wrong manually";
      const error = new TRPCClientError(rawMessage);
      const result = handleTrpcError(t, error);
      expect(result).toBe(rawMessage);
    });

    it("应该处理标准 Error 对象", () => {
      const error = new Error("Standard error message");
      const result = handleTrpcError(t, error);
      expect(result).toBe("Standard error message");
    });

    it("对于完全未知的错误类型应返回通用错误", () => {
      const result = handleTrpcError(t, { some: "random object" });
      expect(result).toBe("translated_serverError.UNKNOWN_ERROR");
    });
  });
});
