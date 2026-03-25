import { Suspense, lazy } from "react";
import { Link, useRoute } from "wouter";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Book, Shield, History, Info, Mail } from "lucide-react";

// 使用 Vite 的 ?raw 简单直接地导入文档内容
import aboutContent from "../../../docs/about.md?raw";
import termsContent from "../../../docs/terms.md?raw";
import privacyContent from "../../../docs/privacy.md?raw";
import apiContent from "../../../docs/api.md?raw";
import securityContent from "../../../docs/security.md?raw";
import changelogContent from "../../../docs/changelog.md?raw";
import contactContent from "../../../docs/contact.md?raw";

const docMap: Record<string, { title: string; content: string; icon: any }> = {
  about: { title: "关于我们", content: aboutContent, icon: Info },
  terms: { title: "服务协议", content: termsContent, icon: Book },
  privacy: { title: "隐私政策", content: privacyContent, icon: Shield },
  api: { title: "API 文档", content: apiContent, icon: Book },
  security: { title: "安全中心", content: securityContent, icon: Shield },
  changelog: { title: "系统更新", content: changelogContent, icon: History },
  contact: { title: "联系销售", content: contactContent, icon: Mail },
};

export default function DocPage({ slug: propSlug }: { slug?: string }) {
  const [match, params] = useRoute("/docs/:slug");
  const slug = propSlug || params?.slug || "about";
  const doc = docMap[slug] || docMap.about;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 relative overflow-hidden font-sans">
      {/* Background glow effects matching Home.tsx */}
      <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/10 blur-[100px] rounded-full -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-accent-pink/5 blur-[100px] rounded-full -z-10 pointer-events-none" />

      {/* 极简 Header */}
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
        <div className="flex items-center gap-5 mb-12">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent border border-primary/20 shadow-inner">
            <doc.icon className="w-8 h-8 text-primary" />
          </div>
          <div>
            <nav className="text-xs font-bold text-primary/50 uppercase tracking-widest mb-1">Documentation / {slug}</nav>
            <h1 className="text-5xl font-black tracking-tight drop-shadow-sm">{doc.title}</h1>
          </div>
        </div>

        <div className="p-8 md:p-12 bg-card/50 backdrop-blur-md border border-border/60 rounded-3xl shadow-2xl relative group overflow-hidden">
          {/* Card glow matching Home.tsx input section */}
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/10 blur-2xl rounded-full -z-10" />
          
          <div className="prose max-w-none 
            prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:text-lg
            prose-headings:text-foreground prose-headings:font-black
            prose-strong:text-foreground prose-strong:font-bold
            prose-li:text-muted-foreground
            prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-a:text-primary hover:prose-a:text-primary/80 transition-all">
            <Markdown>{doc.content}</Markdown>
          </div>
        </div>
      </main>

      <footer className="py-12 border-t border-white/5 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Smart Link Manager. All rights reserved.</p>
      </footer>
    </div>
  );
}
