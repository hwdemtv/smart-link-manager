import React, { useState } from "react";
import { Link } from "wouter";
import { Search, ArrowLeft, ExternalLink, Copy, QrCode, Calendar, MousePointer2, ShieldCheck, AlertTriangle, Share2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import SEO from "@/components/SEO";
import { format } from "date-fns";

export default function QueryPage() {
  const { t } = useTranslation();
  const [shortCode, setShortCode] = useState("");
  const [searchKey, setSearchKey] = useState("");

  const { data: link, isLoading, isError, error } = trpc.links.getByShortCode.useQuery(
    { shortCode: searchKey },
    { enabled: !!searchKey, retry: false }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (shortCode.trim()) {
      setSearchKey(shortCode.trim());
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("dashboard.copySuccess"));
  };

  const isLinkExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden font-sans">
      <SEO 
        title={t("query.title")} 
        description={t("query.subtitle")}
      />
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-accent-pink/5 blur-[120px] rounded-full" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container h-20 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/30 group-hover:border-primary transition-all duration-300">
                <div className="w-5 h-5 rounded-md bg-primary shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              </div>
              <span className="font-black text-2xl tracking-tighter italic">智链<span className="text-primary not-italic">管理</span></span>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-all">
              <ArrowLeft className="w-4 h-4" /> {t("common.backToHome")}
            </Button>
          </Link>
        </div>
      </header>

      <main className="pt-40 pb-24 container max-w-3xl relative z-10">
        <div className="text-center mb-16 space-y-4">
          <Badge variant="outline" className="px-4 py-1 border-primary/30 text-primary bg-primary/5 animate-in fade-in zoom-in">
            Public Lookup Tool
          </Badge>
          <h1 className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
            {t("query.title")}
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
            {t("query.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative group max-w-2xl mx-auto mb-16 px-4">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-accent-pink/50 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-500" />
          <div className="relative flex gap-3 p-2 bg-card border border-border/50 rounded-2xl shadow-2xl backdrop-blur-sm">
            <div className="flex-1 flex items-center pl-4 bg-muted/30 rounded-xl border border-transparent focus-within:border-primary/30 transition-all">
              <Search className="w-5 h-5 text-muted-foreground mr-3" />
              <Input 
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                placeholder={t("query.searchPlaceholder")}
                className="bg-transparent border-0 focus-visible:ring-0 text-lg py-6"
              />
            </div>
            <Button type="submit" size="lg" disabled={isLoading} className="rounded-xl px-8 shadow-lg shadow-primary/20">
              {isLoading ? t("query.searching") : t("query.searchBtn")}
            </Button>
          </div>
        </form>

        {isError && (
          <div className="p-8 rounded-3xl bg-destructive/5 border border-destructive/20 text-center animate-in fade-in slide-in-from-bottom-4">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4 opacity-50" />
            <p className="text-destructive font-bold text-lg">{t("query.notFound")}</p>
          </div>
        )}

        {link && (
          <div className="max-w-[420px] mx-auto animate-in fade-in slide-in-from-bottom-12 duration-700">
            <Card className="border-0 bg-card shadow-[0_30px_60px_-12px_rgba(0,0,0,0.25)] rounded-[2.5rem] overflow-hidden group">
              {/* Gradient Top Bar - matching SSR landing page */}
              <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
              
              {/* Cover Image from SEO settings */}
              {link.seoImage && (
                <div className="w-full h-44 overflow-hidden border-b border-border/10">
                  <img 
                    src={link.seoImage} 
                    alt="Link Cover" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              )}

              <CardContent className="p-10 space-y-8 text-center">
                {/* Branded Icon Wrap */}
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-primary/20 shadow-inner">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </div>

                <div className="space-y-3">
                  <h2 className="text-3xl font-black tracking-tight text-foreground break-all px-2">
                    {link.seoTitle || link.shortCode}
                  </h2>
                  <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-[280px] mx-auto">
                    {link.seoDescription || link.description || t("query.subtitle")}
                  </p>
                </div>

                {/* Status Badge */}
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] border border-primary/20">
                  <span className="w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" />
                  {link.isActive && !isLinkExpired(link.expiresAt as string) ? t("query.result.active") : t("query.result.expired")}
                </div>

                <div className="space-y-4 pt-4">
                  {/* Detailed Info Grid */}
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-5 rounded-3xl border border-border/40">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{t("query.result.clicks")}</p>
                      <p className="text-2xl font-black text-foreground">{link.clickCount || 0}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{t("query.result.createdAt")}</p>
                      <p className="text-sm font-bold opacity-90">{link.createdAt ? format(new Date(link.createdAt), "yyyy/MM/dd") : "-"}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-2">{t("query.result.originalUrl")}</p>
                    <div className="relative group/link">
                      <div className="bg-muted/50 p-4 rounded-2xl border border-border/50 pr-12 transition-all hover:border-primary/40">
                        <p className="text-xs font-mono font-medium truncate opacity-70">{link.originalUrl}</p>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(link.originalUrl)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-background border border-border/50 text-muted-foreground hover:text-primary hover:border-primary transition-all opacity-0 group-hover/link:opacity-100 shadow-sm"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <Button 
                    onClick={() => {
                      const title = link.seoTitle || t("common.brandName");
                      const url = `${window.location.protocol}//${window.location.host}/s/${link.shortCode}`;
                      const desc = link.description || "";
                      const text = `【${title}】\n🔗 链接：${url}${desc ? `\n🔑 ${desc}` : ""}\n—— 来自 ${t("common.brandName")}`;
                      navigator.clipboard.writeText(text);
                      toast.success(t("query.copyShareSuccess"));
                    }}
                    size="lg" 
                    className="w-full gap-2 rounded-2xl h-14 text-lg font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <Share2 className="w-5 h-5" /> {t("query.copyShareBtn")}
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <a href={link.originalUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                      <Button variant="outline" className="w-full gap-2 rounded-xl h-12 text-muted-foreground hover:bg-muted font-bold transition-all border-border/40">
                        <ExternalLink className="w-4 h-4" /> {t("query.result.visit")}
                      </Button>
                    </a>
                    <Link href={`/qr/${link.shortCode}`} className="w-full">
                      <Button variant="ghost" className="w-full gap-2 rounded-xl h-12 text-muted-foreground hover:bg-muted font-bold transition-all">
                        <QrCode className="w-4 h-4" /> {t("query.result.qrCode")}
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Footer Center - matching SSR landing page */}
                <div className="pt-8 border-t border-border/30 flex items-center justify-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                     安全验证中心 · Smart Link Manager
                   </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <footer className="py-12 border-t border-white/5 text-center text-sm text-muted-foreground relative z-10">
        <p>&copy; {new Date().getFullYear()} 智链管理. All rights reserved.</p>
      </footer>
    </div>
  );
}
