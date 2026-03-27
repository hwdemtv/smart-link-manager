import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { ENV } from "./_core/env";
import { createPatchedFetch } from "./_core/patchedFetch";
import { logger } from "./_core/logger";

const DEFAULT_SEO_IMAGE = "/default-seo.png";

import { getSystemConfig } from "./db";

async function createLLMProvider() {
  const dbConfigValue = await getSystemConfig("aiConfig");
  let baseURL = ENV.forgeApiUrl;
  let apiKey = ENV.forgeApiKey;
  let modelName = "gpt-4o";
  let temperature = 0.3;

  if (dbConfigValue) {
    try {
      const dbConfig =
        typeof dbConfigValue === "string"
          ? JSON.parse(dbConfigValue)
          : dbConfigValue;
      if (dbConfig.baseUrl) baseURL = dbConfig.baseUrl;
      if (dbConfig.apiKey) apiKey = dbConfig.apiKey;
      if (dbConfig.model) modelName = dbConfig.model;
      if (dbConfig.temperature !== undefined)
        temperature = dbConfig.temperature;
    } catch (e) {
      console.error("Failed to parse AI config from DB in aiSeoService", e);
    }
  }

  const finalBaseURL = baseURL.endsWith("/v1") ? baseURL : `${baseURL}/v1`;

  const provider = createOpenAI({
    baseURL: finalBaseURL,
    apiKey,
    fetch: createPatchedFetch(fetch),
  });

  return { provider, modelName, temperature };
}

function extractTextFromHTML(html: string): string {
  // 移除 script 和 style 块
  let text = html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    " "
  );
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
  // 移除一般 HTML 标签
  text = text.replace(/<[^>]+>/g, " ");
  // 替换多个连续空白，移除首尾空白
  return text.replace(/\s+/g, " ").trim();
}

/**
 * 从大模型输出文本中智能提取 JSON（兼容 markdown 包裹、裸 JSON、混入说明文字）
 */
function extractJsonFromText(
  text: string
): { seoTitle: string; seoDescription: string; seoImage?: string } | null {
  // 尝试 1: 直接解析
  try {
    return JSON.parse(text.trim());
  } catch {
    /* 继续 */
  }

  // 尝试 2: 从 ```json ... ``` 代码块提取
  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) {
    try {
      return JSON.parse(mdMatch[1].trim());
    } catch {
      /* 继续 */
    }
  }

  // 尝试 3: 正则全文匹配第一个 {...} 对象
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      /* 继续 */
    }
  }

  return null;
}

/**
 * 校验 URL 是否安全（SSRF 防护）
 * 拦截内网 IP 和私有地址段
 */
function validateUrlForSsrf(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL format");
  }

  // 仅允许 HTTP/HTTPS
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP/HTTPS URLs are allowed");
  }

  const hostname = parsed.hostname.toLowerCase();

  // 拦截私有/保留地址
  const blockedPatterns = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
    /^0\.0\.0\.0$/,
    /^169\.254\./, // Link-local
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new Error(`Access to private network addresses is not allowed`);
    }
  }
}

/**
 * AI智能分析原网页提炼SEO内容
 * @param url 需要分析的原始链接
 * @param description 可选的用户描述背景
 */
export async function generateSeoFromUrl(url: string, description?: string) {
  try {
    const defaultResult = {
      seoTitle: "",
      seoDescription: "",
      seoImage: DEFAULT_SEO_IMAGE,
    };

    // 优先策略：如果用户已填入描述，直接用描述来生成 SEO
    // 无需抓取网页（特别适合网盘链接、需登录的页面等）
    if (description && description.trim().length > 0) {
      logger.info(
        `[AI SEO] 检测到用户描述，跳过网页抓取，直接基于描述生成 SEO...`
      );

      const { provider, modelName, temperature } = await createLLMProvider();
      const { text } = await generateText({
        model: provider.chat(modelName),
        prompt: `你是一个专业的数字营销与 SEO 专家。
请根据用户提供的**描述内容**，撰写高质量的 SEO 标题(seoTitle)和页面摘要描述(seoDescription)。
语言：必须使用中文。
风格：吸引点击、清晰传达价值。
目标链接(仅供参考)：${url}
seoTitle 建议 20-40 个汉字，seoDescription 建议 80-150 个汉字。

 💡 核心原则：
 1. **原词准则**：提取码必须是内容中的原词。内容里没写，结果里严禁出现。
 2. **电商禁区**：淘宝/天猫分享链接没有任何提取码。严禁生成“提取码”字样或“XXX”、“见详情”等占位符。
 
 ✅ 正确示例 (淘宝)：
 输入：链接 https://m.tb.cn/... , 描述：耐克运动鞋...
 输出：{"seoTitle": "耐克运动鞋专场...", "seoDescription": "正品耐克运动鞋...", "seoImage": "..."}
 
 ✅ 正确示例 (网盘)：
 输入：链接 https://pan.baidu.com/... , 描述：内含软件，提取码是 1234
 输出：{"seoTitle": "软件下载...", "seoDescription": "...提取码：1234", "seoImage": "..."}
 
 ❌ 错误做法：在描述没写提取码时，自行生成“提取码：XXX”或从 URL 找参数。

重要：只返回 JSON，严禁 Markdown，严禁 JSON 以外的任何文字。
{"seoTitle": "...", "seoDescription": "...", "seoImage": "..."}

用户提供的描述内容：
${description.trim()}`,
        temperature: 0.1,
      });

      const parsed = extractJsonFromText(text);
      const result = {
        seoTitle: (parsed?.seoTitle || "").slice(0, 60),
        seoDescription: (parsed?.seoDescription || "").slice(0, 160),
        seoImage: parsed?.seoImage || DEFAULT_SEO_IMAGE,
      };
      logger.info("[AI SEO] 基于用户描述生成 SEO 完成", result);
      return { success: true, ...result };
    }

    // 降级策略：无描述时抓取网页内容
    // SSRF 防护：校验目标 URL 合法性
    validateUrlForSsrf(url);

    logger.info(`[AI SEO] 根据 ${url} 提取网页内容...`);

    // 1. 获取目标网页 HTML
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 SmartLinkBot/1.0",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`无法访问目标网页 HTTP ${response.status}`);
    }

    const html = await response.text();
    let textContent = extractTextFromHTML(html);

    if (textContent.length > 3000) {
      textContent = textContent.slice(0, 3000);
    }

    if (!textContent || textContent.trim() === "") {
      throw new Error("未能从网页提取到任何有效文本");
    }

    logger.info(
      `[AI SEO] 网页抓取成功，开始调用大模型分析内容 (截取前 ${textContent.length} 字符)...`
    );

    // 2. 初始化大模型提供者和参数
    const { provider, modelName, temperature } = await createLLMProvider();

    // 3. 调用 generateText（兼容所有大模型，不依赖 Function Calling）
    const { text } = await generateText({
      model: provider.chat(modelName),
      prompt: `你是一个专业的数字营销与 SEO 专家。
请根据以下提取到的**网页内容描述**，为其撰写高质量的 SEO 标题(seoTitle)和页面摘要描述(seoDescription)。
语言：必须使用中文。
风格：吸引点击、清晰表达核心商品/内容信息。
目标链接(仅供参考)：${url}
seoTitle 建议 40-60 个汉字，seoDescription 建议 100-160 个汉字。

 💡 核心原则：
 1. **原词准则**：提取码必须是网页摘要中的原词。没写就禁止生成。
 2. **电商禁区**：淘宝/天猫等电商链接绝无提取码。禁止生成“提取码”字样或“XXX”、“见详情”、“1234”等。
 
 ✅ 正确示例 (淘宝)：
 摘要：热销运动鞋，领券立减...
 输出：{"seoTitle": "热销运动鞋...", "seoDescription": "...", "seoImage": ""}
 
 ✅ 正确示例 (网盘)：
 摘要：作品合集，访问密码 6666
 输出：{"seoTitle": "作品合集...", "seoDescription": "...访问密码：6666", "seoImage": "..."}
 
 ❌ 错误：在摘要里没看到提取码时，强行在 description 里加“提取码：XXX”。

重要：只返回 JSON，严禁 Markdown，严禁 JSON 外的任何文字。
{"seoTitle": "...", "seoDescription": "...", "seoImage": "..."}

---网页内容描述摘要---
${textContent}
-----------------------`,
      temperature: 0.1,
    });

    // 4. 多层 JSON 提取（兼容 markdown 包裹和裸 JSON）
    const parsed = extractJsonFromText(text);
    if (
      !parsed ||
      typeof parsed.seoTitle !== "string" ||
      typeof parsed.seoDescription !== "string"
    ) {
      throw new Error(
        "AI 未能生成有效的 JSON 格式 SEO 数据，原始响应: " + text.slice(0, 200)
      );
    }

    // 5. 业务层截断逻辑，确保入库安全
    const finalObject = {
      seoTitle: parsed.seoTitle.slice(0, 60),
      seoDescription: parsed.seoDescription.slice(0, 160),
      seoImage: parsed.seoImage || DEFAULT_SEO_IMAGE,
    };

    logger.info("[AI SEO] AI 分析完成并已自动截断", finalObject);
    return { success: true, ...finalObject };
  } catch (error) {
    const aiError = error as { message?: string };
    logger.error("[AI SEO] 分析失败:", error);
    throw new Error(aiError.message || "智能生成 SEO 失败");
  }
}

/**
 * 测试 AI 连通性
 * @param config 可选的临时配置，用于在保存前测试
 */
export async function testAiConnection(config?: {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}) {
  try {
    const dbConfigValue = await getSystemConfig("aiConfig");
    let baseURL = config?.baseUrl || ENV.forgeApiUrl;
    let apiKey = config?.apiKey || ENV.forgeApiKey;
    let modelName = config?.model || "gpt-4o";

    if (!config && dbConfigValue) {
      try {
        const dbConfig =
          typeof dbConfigValue === "string"
            ? JSON.parse(dbConfigValue)
            : dbConfigValue;
        if (dbConfig.baseUrl) baseURL = dbConfig.baseUrl;
        if (dbConfig.apiKey) apiKey = dbConfig.apiKey;
        if (dbConfig.model) modelName = dbConfig.model;
      } catch (e) {
        // 忽略解析错误，使用默认或传入值
      }
    }

    if (!apiKey) {
      throw new Error("API Key 未配置");
    }

    const finalBaseURL = baseURL.endsWith("/v1") ? baseURL : `${baseURL}/v1`;

    const provider = createOpenAI({
      baseURL: finalBaseURL,
      apiKey,
      fetch: createPatchedFetch(fetch),
    });

    const startTime = Date.now();
    const { text } = await generateText({
      model: provider.chat(modelName),
      prompt: "Respond with 'pong' in 1 word.",
    });
    const duration = Date.now() - startTime;

    return {
      success: true,
      message: text.trim(),
      duration,
      model: modelName,
    };
  } catch (error) {
    const aiError = error as {
      message?: string;
      name?: string;
      status?: number;
    };
    logger.error("[AI Test] 连通性测试失败:", error);
    return {
      success: false,
      message: aiError.message || "连接超时或认证失败",
      error: aiError.name || "UnknownError",
      status: aiError.status,
    };
  }
}
