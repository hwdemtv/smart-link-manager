import React, { useState } from "react";
import { Link } from "wouter";
import { Search, ArrowLeft, ExternalLink, Copy, QrCode, Calendar, MousePointer2, ShieldCheck, AlertTriangle } from "lucide-react";
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
          <Card className="border-border/60 bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-500">
            <CardHeader className="border-b border-border/50 p-8 bg-muted/20">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                    {link.shortCode}
                  </CardTitle>
                  <CardDescription>ID: #{link.id}</CardDescription>
                </div>
                <Badge 
                  variant={link.isActive && !isLinkExpired(link.expiresAt as string) ? "outline" : "destructive"}
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${link.isActive && !isLinkExpired(link.expiresAt as string) ? "border-primary text-primary" : ""}`}
                >
                  {link.isActive && !isLinkExpired(link.expiresAt as string) ? t("query.result.active") : t("query.result.expired")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <ExternalLink className="w-3 h-3" /> {t("query.result.originalUrl")}
                    </label>
                    <div className="group relative">
                      <p className="text-sm font-medium bg-muted/50 p-3 rounded-xl border border-border/50 break-all pr-12 transition-all hover:border-primary/50">
                        {link.originalUrl}
                      </p>
                      <button 
                        onClick={() => copyToClipboard(link.originalUrl)}
                        className="absolute right-2 top-2 p-1.5 rounded-lg bg-background border border-border/50 text-muted-foreground hover:text-primary hover:border-primary transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <MousePointer2 className="w-3 h-3" /> {t("query.result.clicks")}
                      </label>
                      <p className="text-2xl font-black text-primary">{link.clickCount || 0}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> {t("query.result.createdAt")}
                      </label>
                      <p className="text-sm font-bold opacity-80">
                        {link.createdAt ? format(new Date(link.createdAt), "yyyy-MM-dd") : "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-end gap-3">
                  <Link href={`/qr/${link.shortCode}`}>
                    <Button variant="outline" className="w-full gap-2 rounded-xl border-border/60 hover:bg-primary/5 hover:text-primary transition-all">
                      <QrCode className="w-4 h-4" /> {t("query.result.qrCode")}
                    </Button>
                  </Link>
                  <a href={link.originalUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full gap-2 rounded-xl shadow-lg shadow-primary/20">
                      <ExternalLink className="w-4 h-4" /> {t("query.result.visit")}
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="py-12 border-t border-white/5 text-center text-sm text-muted-foreground relative z-10">
        <p>&copy; {new Date().getFullYear()} 智链管理. All rights reserved.</p>
      </footer>
    </div>
  );
}
