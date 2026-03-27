import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const url = "https://m.tb.cn/h.iiCizOU?tk=Br6G5Y438e6";
const baseURL = "https://api.hwdemtv.com/v1";
const apiKey = "sk-gzqmBiVD3TZatsQz473d70CdF1Ed4d46939663D52f83378e";
const modelName = "glm-4-flash";

const provider = createOpenAI({
  baseURL,
  apiKey,
});

const textContent = `
淘宝网 - 淘！我喜欢
[热销] 某品牌时尚运动鞋 夏季透气男女同款
价格：¥299.00
库存：1000
商品详情：这款运动鞋采用高科技透气网面，轻便耐穿，适合各种运动场景。
立即购买，领券立减 20 元。
店铺：某某官方旗舰店
`;

async function test() {
  console.log("Testing with URL:", url);
  console.log("Model:", modelName);
  
  const { text } = await generateText({
    model: provider.chat(modelName),
    prompt: `你是一个专业的数字营销与 SEO 专家。
请根据以下提取到的**网页内容描述**，为其撰写高质量的 SEO 标题(seoTitle)和页面摘要描述(seoDescription)。
语言：必须使用中文。
风格：吸引点击、清晰表达核心商品/内容信息。
目标链接(仅供参考)：${url}
seoTitle 建议 40-60 个汉字，seoDescription 建议 100-160 个汉字。

💡 特别要求：
1. **提取码识别 (核心约束)**：只有在**网页内容描述**中明确且直白地包含了“提取码”、“取件密码”等信息且后跟具体代码时，才允许包含在结果中。
2. **严禁从 URL 提取**：绝对禁止从“目标链接”中提取任何参数作为提取码。淘宝/天猫分享链接中的 \`tk\` 参数**绝对不是**提取码，严禁在该场景下生成“提取码”字样。
3. **严禁任何幻觉**：如果内容描述中未发现明确的提取码，**绝对禁止**在生成结果中出现“提取码”字样。**严禁**自行编造或添加“123456”、“9999”等虚假代码。
4. **原词串联**：你输出的提取码必须是**网页内容描述**中的**原词子字符串**。
5. **封面图逻辑**：如果没找到网页的主题封面图（或是解析出的图片与内容无关），请将 seoImage 设为空字符串，以便系统填充默认封面。

重要：只返回一个 JSON 对象，不要包含任何 Markdown 代码块标签：
{"seoTitle": "...", "seoDescription": "...", "seoImage": "..."}

---网页内容描述摘要---
${textContent}
-----------------------`,
    temperature: 0.3,
  });

  console.log("\nAI Response:");
  console.log(text);
  
  if (text.includes("提取码")) {
    console.log("\n❌ FAILED: Response contains '提取码'");
  } else {
    console.log("\n✅ PASSED: Response does NOT contain '提取码'");
  }
}

test().catch(console.error);
