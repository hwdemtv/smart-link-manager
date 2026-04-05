import React, { useState, useEffect } from "react";
import { Search, ShieldCheck, AlertTriangle, Share2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PublicLinkLookupProps {
  initialOpen?: boolean;
}

export function PublicLinkLookup({ initialOpen = false }: PublicLinkLookupProps) {
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
          // 生产环境移除端口号，避免 HTTPS 使用 HTTP 端口导致 SSL 错误
          const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
          const host = isDev ? window.location.host : window.location.hostname;
          const url = `${window.location.protocol}//${host}/s/${link.shortCode}`;
          const qr = await QRCode.toDataURL(url, {
            margin: 2,
            width: 600,
            color: { dark: '#0f172a', light: '#ffffff' }
          });
          setQrDataUrl(qr);
          setShowResult(true);
        } catch (err) {
          console.error("QR Generation failed", err);
        }
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
    <div className="w-full max-w-xl mx-auto">
      <div className="text-center mb-10 space-y-3">
        <Badge variant="outline" className="px-3 py-0.5 border-primary/30 text-primary bg-primary/5 rounded-full text-[10px] font-bold uppercase tracking-widest">
          Public Lookup Tool
        </Badge>
        <h1 className="text-4xl font-black tracking-tight text-slate-900">
          {t("query.title")}
        </h1>
        <p className="text-slate-500 text-sm max-w-sm mx-auto">
          {t("query.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative group">
        <div className="absolute -inset-1.5 bg-gradient-to-r from-primary/30 to-blue-500/30 rounded-[2rem] blur opacity-20 group-focus-within:opacity-40 transition duration-500" />
        <div className="relative flex gap-2 p-2.5 bg-white border border-slate-200 rounded-[1.8rem] shadow-xl shadow-slate-200/50 backdrop-blur-xl">
          <div className="flex-1 flex items-center pl-4 bg-slate-50/50 rounded-2xl transition-all focus-within:bg-white focus-within:ring-2 ring-primary/10">
            <Search className="w-5 h-5 text-slate-400 mr-3" />
            <Input 
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value)}
              placeholder={t("query.searchPlaceholder")}
              className="bg-transparent border-0 focus-visible:ring-0 text-base py-6 h-12"
              autoFocus
            />
          </div>
          <Button type="submit" size="lg" disabled={isLoading} className="rounded-2xl px-8 h-12 font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all">
            {isLoading ? t("query.searching") : t("query.searchBtn")}
          </Button>
        </div>
      </form>

      {isError && (
        <div className="mt-8 p-6 rounded-3xl bg-white border border-rose-100 shadow-xl shadow-rose-100/20 text-center animate-in slide-in-from-top-4">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-3 opacity-80" />
          <p className="text-slate-900 font-bold">{t("query.notFound")}</p>
        </div>
      )}

      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-[440px]">
          <DialogTitle className="sr-only">Query Result</DialogTitle>
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <Card className="border-0 bg-card shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] rounded-[2.5rem] overflow-hidden relative">
              <div className="h-2 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />
              
              <CardContent className="p-10 text-center flex flex-col items-center">
                <div className="space-y-4 mb-10 pt-4">
                  <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight px-4">
                    {link?.seoTitle || link?.shortCode}
                  </h2>
                  <p className="text-muted-foreground text-base font-medium leading-relaxed max-w-[320px] mx-auto opacity-80">
                    {link?.seoDescription || link?.description || t("query.subtitle")}
                  </p>
                </div>

                  <div className="p-7 bg-muted/40 rounded-[2.5rem] border border-border/20 shadow-inner mb-10 text-center">
                    <img src={qrDataUrl} alt="QR Code" className="w-64 h-64 rounded-2xl shadow-xl mx-auto" />
                    <p className="mt-4 text-[10px] sm:text-xs font-medium text-muted-foreground opacity-60">
                      {t("query.qrCodeTip")}
                    </p>
                  </div>

                <div className="w-full">
                  <Button 
                    onClick={() => {
                      if (!link) return;
                      const title = link.seoTitle || t("common.brandName");
                      const url = `${window.location.protocol}//${window.location.host}/s/${link.shortCode}`;
                      const desc = link.description || "";
                      const textToCopy = `【${title}】\n🔗 链接：${url}${desc ? `\n🔑 ${desc}` : ""}\n—— 来自 ${t("common.brandName")}`;
                      navigator.clipboard.writeText(textToCopy);
                      toast.success(t("query.copyShareSuccess"));
                    }}
                    size="lg" 
                    className="w-full gap-3 rounded-2xl h-16 text-xl font-black bg-[#0f172a] hover:bg-slate-900"
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
                     安全验证中心 · Smart Link Manager
                   </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
