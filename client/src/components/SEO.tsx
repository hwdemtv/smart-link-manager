import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface SEOProps {
  title?: string;
  description?: string;
  schema?: object | object[];
  lang?: string;
}

/**
 * SEO 组件：动态管理页面元数据与结构化数据
 * 采用原生 DOM 操作以避免引入额外的 react-helmet 依赖
 */
const SEO: React.FC<SEOProps> = ({ title, description, schema, lang }) => {
  const { i18n } = useTranslation();
  const currentLang = lang || i18n.language || "zh";

  useEffect(() => {
    // 1. 更新标题
    if (title) {
      document.title = `${title} - Smart Link Manager`;
    }

    // 2. 更新 Meta Description
    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement("meta");
        metaDesc.setAttribute("name", "description");
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute("content", description);
    }

    // 3. 更新 HTML 语言属性
    document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";

    // 4. 注入 JSON-LD 结构化数据
    if (schema) {
      const scriptId = "seo-json-ld";
      let script = document.getElementById(scriptId) as HTMLScriptElement;
      
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }

      script.text = JSON.stringify(schema);
    }

    // 清理函数（可选，但在单页应用中通常保持现状直至下一页面覆盖）
    return () => {
      // 可以在路由切换时清理特定 schema，但通常直接被新页面的 SEO 组件覆盖即可
    };
  }, [title, description, schema, currentLang]);

  return null; // 此组件不渲染任何可见内容
};

export default SEO;
