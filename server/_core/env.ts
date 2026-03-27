import { z } from "zod";
import { logger } from "./logger";
import { randomBytes } from "crypto";

// ============================================================================
// 环境变量 Schema 定义（Zod 强类型验证）
// ============================================================================

/**
 * 生成随机密码
 */
function generateRandomPassword(length: number = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  const randomValues = randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomValues[i] % chars.length];
  }
  return password;
}

/**
 * 环境变量 Schema
 *
 * 分类说明：
 * - Required: 必需的环境变量，缺少会导致启动失败
 * - Optional: 可选的环境变量，有合理的默认值
 * - Conditional: 条件必需，如生产环境强制要求
 */
const envSchema = z.object({
  // === Node 环境 ===
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // === 必需配置 ===
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  // === 服务配置 ===
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  VITE_APP_ID: z.string().default(""),

  // === AI 服务配置（可选） ===
  BUILT_IN_FORGE_API_URL: z.string().optional(),
  BUILT_IN_FORGE_API_KEY: z.string().optional(),

  // === License 服务配置（可选） ===
  LICENSE_SERVER_URL: z.string().optional(),
  LICENSE_SERVER_URLS: z.string().optional(),

  // === 管理员配置 ===
  DEFAULT_ADMIN_USERNAME: z.string().default("admin"),
  DEFAULT_ADMIN_PASSWORD: z.string().optional(),

  // === 功能开关 ===
  REGISTRATION_DISABLED: z.coerce.boolean().default(false),

  // === 请求限制 ===
  BODY_LIMIT: z.string().default("10mb"),
});

// 推断类型
type EnvSchema = z.infer<typeof envSchema>;

// 扩展类型：添加计算字段
interface ExtendedEnv extends EnvSchema {
  isProduction: boolean;
  cookieSecret: string;
  defaultAdminPassword: string;
  defaultAdminUsername: string;
  generatedPassword: string | null;
  appId: string;
  forgeApiUrl: string;
  forgeApiKey: string;
  licenseServerUrl: string;
  licenseServerUrls: string[];
  registrationDisabled: boolean;
}

/**
 * 验证并解析环境变量
 *
 * @throws 如果验证失败，记录错误并退出进程
 */
function parseEnv(): ExtendedEnv {
  // 构建环境变量对象（process.env 中所有值都是 string | undefined）
  const rawEnv = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    PORT: process.env.PORT,
    VITE_APP_ID: process.env.VITE_APP_ID,
    BUILT_IN_FORGE_API_URL: process.env.BUILT_IN_FORGE_API_URL,
    BUILT_IN_FORGE_API_KEY: process.env.BUILT_IN_FORGE_API_KEY,
    LICENSE_SERVER_URL: process.env.LICENSE_SERVER_URL,
    LICENSE_SERVER_URLS: process.env.LICENSE_SERVER_URLS,
    DEFAULT_ADMIN_USERNAME: process.env.DEFAULT_ADMIN_USERNAME,
    DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD,
    REGISTRATION_DISABLED: process.env.REGISTRATION_DISABLED,
    BODY_LIMIT: process.env.BODY_LIMIT,
  };

  // Zod 解析
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    logger.error("[ENV] Environment validation failed:");
    result.error.issues.forEach(issue => {
      logger.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }

  const parsed = result.data;

  // 生产环境额外验证
  if (parsed.NODE_ENV === "production") {
    const productionErrors: string[] = [];

    if (!parsed.DEFAULT_ADMIN_PASSWORD) {
      productionErrors.push("DEFAULT_ADMIN_PASSWORD must be set in production");
    }

    if (productionErrors.length > 0) {
      logger.error("[ENV] Production environment validation failed:");
      productionErrors.forEach(err => logger.error(`  - ${err}`));
      process.exit(1);
    }
  }

  // 开发环境：自动生成管理员密码
  const generatedPassword =
    parsed.DEFAULT_ADMIN_PASSWORD || parsed.NODE_ENV === "production"
      ? null
      : generateRandomPassword();

  const defaultAdminPassword =
    parsed.DEFAULT_ADMIN_PASSWORD || generatedPassword || "";

  // 构建扩展的 ENV 对象
  return {
    ...parsed,
    isProduction: parsed.NODE_ENV === "production",
    cookieSecret: parsed.JWT_SECRET,
    defaultAdminPassword,
    defaultAdminUsername: parsed.DEFAULT_ADMIN_USERNAME,
    generatedPassword,
    appId: parsed.VITE_APP_ID,
    forgeApiUrl: parsed.BUILT_IN_FORGE_API_URL || "",
    forgeApiKey: parsed.BUILT_IN_FORGE_API_KEY || "",
    licenseServerUrl: parsed.LICENSE_SERVER_URL || "",
    licenseServerUrls: parsed.LICENSE_SERVER_URLS
      ? parsed.LICENSE_SERVER_URLS.split(",").map(url => url.trim()).filter(Boolean)
      : [],
    registrationDisabled: parsed.REGISTRATION_DISABLED,
  };
}

// 启动时立即验证并导出
export const ENV = parseEnv();

// 导出 generatedPassword 以便其他模块使用
export const generatedPassword = ENV.generatedPassword;

// 类型导出（供其他模块使用）
export type { EnvSchema, ExtendedEnv };
