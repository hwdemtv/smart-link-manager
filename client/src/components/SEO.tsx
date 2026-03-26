import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface SEOProps {
  title?: string;
  description?: string;
  schema?: object | object[];
  lang?: string;
  canonicalPath?: string; // 如 /query，用于生成完整 canonical URL
  ogImage?: string;       // 自定义 OG 图片
  ogType?: "website" | "article" | "product";
  noindex?: boolean;      // 是否禁止索引
}

/**
 * SEO 组件：动态管理页面元数据与结构化数据
 * 采用原生 DOM 操作以避免引入额外的 react-helmet 依赖
 */
const SEO: React.FC<SEOProps> = ({
  title,
  description,
  schema,
  lang,
  canonicalPath,
  ogImage = "/og-image.png",
  ogType = "website",
  noindex = false
}) => {
  const { i18n } = useTranslation();
  const currentLang = lang || i18n.language || "zh";
  const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;

  useEffect(() => {
    const updateMeta = (name: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement("meta");
        if (isProperty) {
          meta.setAttribute("property", name);
        } else {
          meta.setAttribute("name", name);
        }
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    // 1. 更新标题
    if (title) {
      document.title = `${title} - Smart Link Manager`;
    }

    // 2. 更新 Meta Description
    if (description) {
      updateMeta("description", description);
    }

    // 3. 更新 HTML 语言属性
    document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";

    // 4. Robots 指令
    updateMeta("robots", noindex ? "noindex, nofollow" : "index, follow");

    // 5. Canonical URL
    if (canonicalPath) {
      const canonicalUrl = `${baseUrl}${canonicalPath}`;
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonicalUrl;

      // 同时更新 OG URL
      updateMeta("og:url", canonicalUrl, true);
    }

    // 6. Open Graph 标签
    if (title) {
      updateMeta("og:title", title, true);
      updateMeta("twitter:title", title);
    }
    if (description) {
      updateMeta("og:description", description, true);
      updateMeta("twitter:description", description);
    }
    if (ogImage) {
      const fullImageUrl = ogImage.startsWith("http") ? ogImage : `${baseUrl}${ogImage}`;
      updateMeta("og:image", fullImageUrl, true);
      updateMeta("twitter:image", fullImageUrl);
    }
    updateMeta("og:type", ogType, true);
    updateMeta("og:locale", currentLang === "zh" ? "zh_CN" : "en_US", true);

    // 7. Twitter Card
    updateMeta("twitter:card", "summary_large_image");

    // 8. 注入 JSON-LD 结构化数据
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

    return () => {
      // 清理可选
    };
  }, [title, description, schema, currentLang, canonicalPath, ogImage, ogType, noindex, baseUrl]);

  return null; // 此组件不渲染任何可见内容
};

export default SEO;
