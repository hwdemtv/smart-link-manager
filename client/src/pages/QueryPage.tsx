import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Search, ArrowLeft, ShieldCheck, AlertTriangle, Share2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import SEO from "@/components/SEO";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export default function QueryPage() {
  const { t } = useTranslation();
  const [shortCode, setShortCode] = useState("");
  const [searchKey, setSearchKey] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [showResult, setShowResult] = useState(false);

  const { data: link, isLoading, isError } = trpc.links.getByShortCode.useQuery(
    { shortCode: searchKey },
    { 
      enabled: !!searchKey, 
      retry: false,
    }
  );

  useEffect(() => {
    const generateQR = async () => {
      if (link) {
        try {
          const url = `${window.location.protocol}//${window.location.host}/s/${link.shortCode}`;
          const qr = await QRCode.toDataURL(url, { 
            margin: 2, 
            width: 600,
            color: {
              dark: '#0f172a',
              light: '#ffffff'
            }
          });
          setQrDataUrl(qr);
          setShowResult(true); // Data found, open dialog
        } catch (err) {
          console.error("QR Generation failed", err);
        }
      } else {
        setQrDataUrl("");
      }
    };
    generateQR();
  }, [link]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (shortCode.trim()) {
      setSearchKey(shortCode.trim().toLowerCase());
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden font-sans">
      <SEO
        title={t("query.title")}
        description={t("query.subtitle")}
        canonicalPath="/query"
        schema={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": t("query.title"),
          "description": t("query.subtitle"),
          "url": `${window.location.origin}/query`,
          "mainEntity": {
            "@type": "WebApplication",
            "name": "Short Code Lookup",
            "applicationCategory": "UtilityApplication",
            "operatingSystem": "Web"
          }
        }}
      />
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-accent-pink/5 blur-[120px] rounded-full" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container h-20 flex items-center justify-between px-6">
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

      <main className="pt-40 pb-24 container max-w-3xl relative z-10 px-6">
        <div className="text-center mb-16 space-y-4 px-4">
          <Badge variant="outline" className="px-4 py-1 border-primary/30 text-primary bg-primary/5 animate-in fade-in zoom-in">
            {t("query.badge")}
          </Badge>
          <h1 className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
            {t("query.title")}
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto leading-relaxed">
            {t("query.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative group max-w-2xl mx-auto mb-16">
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
          <div className="p-10 rounded-[2.5rem] bg-destructive/5 border border-destructive/20 text-center animate-in fade-in slide-in-from-bottom-4 max-w-md mx-auto shadow-sm">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4 opacity-70" />
            <p className="text-destructive font-black text-xl mb-2">{t("query.notFound")}</p>
            <p className="text-destructive/60 text-sm">{t("query.notFoundHint")}</p>
          </div>
        )}

        {/* Result Dialog - Consistent across app */}
        <Dialog open={showResult} onOpenChange={setShowResult}>
          <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-[440px]">
            <DialogTitle className="sr-only">{t("query.result.title")}</DialogTitle>
            <div className="animate-in fade-in zoom-in-95 duration-500">
              {link && (
                <Card className="border-0 bg-card shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] rounded-[2.5rem] overflow-hidden">
                  <div className="h-2 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />
                  
                  <CardContent className="p-10 text-center flex flex-col items-center">
                    <div className="space-y-4 mb-10 pt-4">
                      <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight px-4">
                        {link.seoTitle || link.shortCode}
                      </h2>
                      <p className="text-muted-foreground text-base font-medium leading-relaxed max-w-[320px] mx-auto opacity-80">
                        {link.seoDescription || link.description || t("query.subtitle")}
                      </p>
                    </div>

                    {qrDataUrl && (
                      <div className="group relative">
                        <div className="absolute -inset-4 bg-muted/20 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-700" />
                        <div className="relative p-7 bg-muted/40 rounded-[2.5rem] border border-border/20 shadow-inner overflow-hidden mb-10">
                          <img 
                            src={qrDataUrl} 
                            alt="QR Code" 
                            className="w-64 h-64 rounded-2xl shadow-xl transition-transform duration-700 group-hover:scale-110"
                          />
                        </div>
                      </div>
                    )}

                    <div className="w-full">
                      <Button 
                        onClick={() => {
                          const title = link.seoTitle || t("common.brandName");
                          const url = `${window.location.protocol}//${window.location.host}/s/${link.shortCode}`;
                          const desc = link.description || "";
                          const textToCopy = `【${title}】\n🔗 ${t("query.result.originalUrl")}：${url}${desc ? `\n🔑 ${desc}` : ""}\n—— ${t("query.shareFrom")} ${t("common.brandName")}`;
                          navigator.clipboard.writeText(textToCopy);
                          toast.success(t("query.copyShareSuccess"));
                        }}
                        size="lg" 
                        className="w-full gap-3 rounded-2xl h-16 text-xl font-black shadow-2xl shadow-primary/10 hover:shadow-primary/25 hover:scale-[1.03] active:scale-95 transition-all bg-[#0f172a] hover:bg-slate-900 border border-white/5"
                      >
                        <Share2 className="w-6 h-6" /> {t("query.copyShareBtn")}
                      </Button>
                    </div>

                    <div className="mt-12 flex items-center justify-center gap-3">
                       <div className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                       </div>
                       <span className="text-[11px] font-black text-muted-foreground/50 uppercase tracking-[0.3em]">
                         {t("query.securityCenter")}
                       </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>

      <footer className="py-12 border-t border-white/5 text-center text-sm text-muted-foreground relative z-10 px-6">
        <p>&copy; {new Date().getFullYear()} {t("common.brandName")}. {t("home.footer.rights")}</p>
      </footer>
    </div>
  );
}
