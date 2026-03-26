import React from "react";
import { Link } from "wouter";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import SEO from "@/components/SEO";
import Breadcrumbs from "@/components/Breadcrumbs";

const faqData = [
  {
    q: "什么是短链接？",
    a: "短链接是一种将长 URL 转换为简短网址的技术。Smart Link Manager 提供专业的短链接服务，支持自定义短码、域名绑定、点击统计等功能。"
  },
  {
    q: "短链接会影响 SEO 吗？",
    a: "使用 301 重定向的短链接可以传递 SEO 权重。Smart Link Manager 支持 301/302/307/308 多种重定向类型，您可以根据需求选择。"
  },
  {
    q: "如何创建短链接？",
    a: "在 Smart Link Manager 中创建短链接只需三步：1) 注册账户 2) 粘贴原始链接 3) 自定义短码或自动生成。整个过程只需 10 秒。"
  },
  {
      q: "短链接安全吗？",
      a: "Smart Link Manager 采用企业级安全架构：scrypt 密码哈希、JWT 认证、HTTPS 加密、IP 匿名化处理。您还可以为链接设置访问密码。"
  },
  {
      q: "短链接有免费版吗？",
      a: "Smart Link Manager 提供免费版，支持基础短链接创建、点击统计、二维码生成。Pro 版提供更多高级功能如 A/B 测试、自定义域名。"
  }
];

export default function FAQPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqData.map(item => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.a
      }
    }))
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden font-sans">
      <SEO 
        title="常见问题解答 (FAQ)" 
        description="了解 Smart Link Manager 的核心功能、安全策略、价格体系以及短链接 SEO 最佳实践。"
        schema={schema}
      />
      
      {/* Background glow effects matching DocPage.tsx */}
      <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/10 blur-[100px] rounded-full -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-accent-pink/5 blur-[100px] rounded-full -z-10 pointer-events-none" />

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container h-20 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/30 group-hover:border-primary transition-all duration-300">
                <div className="w-5 h-5 rounded-md bg-primary shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse" />
              </div>
              <span className="font-black text-2xl tracking-tighter italic">Smart<span className="text-primary not-italic">Link</span></span>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-all">
              <ArrowLeft className="w-4 h-4" /> 返回首页
            </Button>
          </Link>
        </div>
      </header>

      <main className="pt-40 pb-24 container max-w-4xl relative z-10">
        <Breadcrumbs items={[{ name: "文档", href: "/docs/about" }, { name: "常见问题" }]} />
        
        <div className="flex items-center gap-5 mb-12">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent border border-primary/20 shadow-inner">
            <HelpCircle className="w-8 h-8 text-primary" />
          </div>
          <div>
            <nav className="text-xs font-bold text-primary/50 uppercase tracking-widest mb-1">Support / FAQ</nav>
            <h1 className="text-5xl font-black tracking-tight drop-shadow-sm">常见问题解答</h1>
          </div>
        </div>

        <div className="p-8 md:p-12 bg-card/50 backdrop-blur-md border border-border/60 rounded-3xl shadow-2xl relative overflow-hidden">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqData.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-border/50 px-2">
                <AccordionTrigger className="text-left font-bold text-lg hover:text-primary transition-colors py-6">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed text-base pb-6">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>

      <footer className="py-12 border-t border-white/5 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Smart Link Manager. All rights reserved.</p>
      </footer>
    </div>
  );
}
