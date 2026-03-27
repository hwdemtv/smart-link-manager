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

重要：只返回 JSON，严禁 Markdown，严禁 JSON 以外的任何文字。
{"seoTitle": "...", "seoDescription": "...", "seoImage": "..."}

---网页内容描述摘要---
${textContent}
-----------------------`,
    temperature: 0.1,
  });

  console.log("\nAI Response:");
  console.log(text);
  
  if (text.includes("提取码") || text.includes("密码")) {
    console.log("\n❌ FAILED: Response contains forbidden keywords");
  } else {
    console.log("\n✅ PASSED: Response is clean");
  }
}

test().catch(console.error);
