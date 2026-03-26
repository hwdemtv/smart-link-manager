import React from "react";
import { Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import SEO from "./SEO";

interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  // 生成 BreadcrumbList 结构化数据
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      ...(item.href && { "item": window.location.origin + item.href })
    }))
  };

  return (
    <nav aria-label="Breadcrumb" className="flex mb-6 overflow-x-auto no-scrollbar py-2">
      <SEO schema={schema} />
      <ol className="flex items-center space-x-2 text-sm text-muted-foreground whitespace-nowrap">
        <li className="flex items-center">
          <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1.5">
            <Home className="w-3.5 h-3.5" />
            <span>首页</span>
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center space-x-2">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            {item.href ? (
              <Link href={item.href} className="hover:text-primary transition-colors">
                {item.name}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{item.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
