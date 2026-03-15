import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";
import * as cryptoNode from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(cryptoNode.scrypt);

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

// 精简后的认证服务：仅保留 JWT 签发/验证功能
class AuthService {
  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * 创建 session token（JWT）
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  /**
   * 验证 session token，返回用户会话信息或 null
   */
  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      const isNonEmptyString = (v: unknown): v is string =>
        typeof v === "string" && v.length > 0;

      if (!isNonEmptyString(openId) || !isNonEmptyString(appId)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name: isNonEmptyString(name) ? name : "",
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  /**
   * 创建访客安全令牌 (VisitorToken)
   * 有效期固定为 5 分钟，用于 PC 端引导页 URL 脱敏
   */
  async createVisitorToken(shortCode: string): Promise<string> {
    const secretKey = this.getSessionSecret();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expirationSeconds = issuedAt + (5 * 60); // 5 minutes

    const jwt = await new SignJWT({ shortCode })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(issuedAt)
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
    
    // Replace dots with tilde to avoid static file routing issues in some servers
    return jwt.replace(/\./g, "~");
  }

  /**
   * 验证访客安全令牌
   */
  async verifyVisitorToken(token: string): Promise<string | null> {
    try {
      const secretKey = this.getSessionSecret();
      // Restore dots
      const jwt = token.replace(/~/g, ".");
      const { payload } = await jwtVerify(jwt, secretKey, {
        algorithms: ["HS256"],
      });
      
      const { shortCode } = payload as { shortCode: string };
      return typeof shortCode === "string" ? shortCode : null;
    } catch (error) {
      console.warn("[Auth] Visitor token verification failed", String(error));
      return null;
    }
  }
}

export const authService = new AuthService();

// 导出底层加解密工具以供 API Key 服务使用
export const crypto = {
  randomBytes: (size: number) => cryptoNode.randomBytes(size),
  hashPassword: async (password: string): Promise<string> => {
    const salt = cryptoNode.randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${buf.toString("hex")}`;
  },
  verifyPassword: async (hash: string, password: string): Promise<boolean> => {
    const [salt, key] = hash.split(":");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return buf.toString("hex") === key;
  }
};
