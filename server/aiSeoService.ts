import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod/v4";
import { ENV } from "./_core/env";
import { createPatchedFetch } from "./_core/patchedFetch";
import { logger } from "./_core/logger";
import { getTenantConfig } from "./db";

async function createLLMProvider(tenantId?: number) {
  let baseURL = ENV.forgeApiUrl;
  let apiKey = ENV.forgeApiKey;
  let modelName = "gpt-4o";
  let temperature = 0.3;

  if (tenantId) {
    const config = await getTenantConfig(tenantId, "ai_model_config");
    if (config?.configValue) {
      const val = config.configValue as any;
      if (val.baseUrl) baseURL = val.baseUrl;
      if (val.apiKey) apiKey = val.apiKey;
      if (val.model) modelName = val.model;
      if (val.temperature !== undefined) temperature = val.temperature;
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
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  // 移除一般 HTML 标签
  text = text.replace(/<[^>]+>/g, ' ');
  // 替换多个连续空白，移除首尾空白
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * AI智能分析原网页提炼SEO内容
 * @param url 需要分析的原始链接
 * @param tenantId 租户ID，用于获取自定义配置
 */
export async function generateSeoFromUrl(url: string, tenantId?: number) {
  try {
    logger.info(`[AI SEO] 根据 ${url} 提取网页内容...`);
    
    // 1. 获取目标网页 HTML
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 SmartLinkBot/1.0"
      }
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

    if (!textContent || textContent.trim() === '') {
      throw new Error("未能从网页提取到任何有效文本");
    }

    logger.info(`[AI SEO] 网页抓取成功，开始调用大模型分析内容 (截取前 ${textContent.length} 字符)...`);

    // 2. 初始化大模型提供者和参数
    const { provider, modelName, temperature } = await createLLMProvider(tenantId);

    // 3. 调用大模型结构化输出
    const result = await generateObject({
      model: provider.chat(modelName),
      schema: z.object({
        seoTitle: z.string().max(60).describe("高度凝练、吸引点击的网页标题，不超过 40 个中文字符，用于社交平台和搜索引擎优化。"),
        seoDescription: z.string().max(160).describe("用于展示在连接下方的摘要，概述网站/网页核心价值或内容，引人入胜，不超过 120 个中文字符。"),
      }),
      prompt: `你是一个专业的数字营销与 SEO 专家。
请根据以下提取到的网页文本内容，为其撰写高质量的 SEO 标题(Title)和页面摘要描述(Description)。
语言：必须使用中文。
风格：吸引点击、清晰表达核心商品/内容信息。

---网页抓取文本摘要信息---
${textContent}
-----------------------`,
      temperature, // 使用配置的温度
    });

    logger.info("[AI SEO] AI 分析完成", result.object);
    return result.object;

  } catch (error: any) {
    logger.error("[AI SEO] 分析失败:", error);
    throw new Error(error.message || "智能生成 SEO 失败");
  }
}
