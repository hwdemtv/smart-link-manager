import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import * as QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Download, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/lib/clipboard";

export default function QRPage() {
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);

  const { shortCode: routeShortCode } = useParams() as any;
  const params = new URLSearchParams(window.location.search);
  // 优先使用路由参数（/qr/:shortCode），兼容旧的 Query string
  const shortCode = routeShortCode || params.get("code") || "";

  // 通过短码向后端请求原始链接详情，不再依赖 URL 参数传递
  const { data: link } = trpc.links.getByShortCode.useQuery(
    { shortCode },
    { enabled: !!shortCode }
  );

  const configQuery = trpc.configs.getConfig.useQuery();
  const defaultDomain = configQuery.data?.defaultDomain;

  const originalUrl = link?.originalUrl || "";
  const description = link?.description || "";

  let baseDomain =
    link?.customDomain || defaultDomain || window.location.origin;
  if (!baseDomain.startsWith("http")) {
    baseDomain = `${window.location.protocol}//${baseDomain}`;
  }
  // 移除端口号，避免 HTTPS 使用 HTTP 端口（如 :80）导致 SSL 错误
  try {
    const url = new URL(baseDomain);
    // 只在生产环境（默认端口）移除显式端口号
    // 开发环境保留端口（如 localhost:5173）
    const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!isDev && url.port) {
      url.port = "";
      baseDomain = url.origin;
    }
  } catch {
    // URL 解析失败时保持原样
  }
  const cleanBaseDomain = baseDomain.replace(/\/+$/, "");
  const fullUrl = shortCode ? `${cleanBaseDomain}/s/${shortCode}` : "";

  useEffect(() => {
    if (shortCode) {
      // Generate QR code
      const generateQR = async () => {
        try {
          const url = await QRCode.toDataURL(fullUrl, {
            errorCorrectionLevel: "H",
            type: "image/png",
            margin: 1,
            width: 300,
            color: {
              dark: "#111827",
              light: "#f9fafb",
            },
          });
          setQrDataUrl(url);
          setLoading(false);
        } catch (error: any) {
          console.error("Error generating QR code:", error);
          setLoading(false);
        }
      };
      generateQR();
    }
  }, [shortCode, fullUrl]);

  const handleCopyLink = async () => {
    const success = await copyToClipboard(fullUrl);
    if (success) {
      toast.success(t("qr.copySuccess"));
    } else {
      toast.error(t("qr.copyFailed"));
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;

    const downloadLink = document.createElement("a");
    downloadLink.href = qrDataUrl;
    downloadLink.download = `qrcode-${shortCode}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    toast.success(t("qr.downloadSuccess"));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{t("qr.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("qr.subtitle")}</p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          {loading ? (
            <div className="w-72 h-72 bg-secondary rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">
                  {t("qr.generating")}
                </p>
              </div>
            </div>
          ) : qrDataUrl ? (
            <div className="p-4 bg-white rounded-lg shadow-sm border border-border">
              <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
            </div>
          ) : (
            <div className="w-72 h-72 bg-secondary rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">{t("qr.failed")}</p>
            </div>
          )}
        </div>

        {/* Short Code Display */}
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">{t("qr.shortLink")}</p>
          <p className="font-mono text-lg font-semibold text-blue-600 break-all">
            {fullUrl}
          </p>
        </div>

        {/* Description */}
        {description && (
          <div className="p-3 bg-secondary/50 rounded-lg border border-border">
            <p className="text-sm text-foreground">{description}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleCopyLink}
            variant="outline"
            className="w-full gap-2"
          >
            <Copy className="w-4 h-4" />
            {t("qr.copyLink")}
          </Button>

          <Button
            onClick={handleDownloadQR}
            variant="outline"
            className="w-full gap-2"
            disabled={!qrDataUrl}
          >
            <Download className="w-4 h-4" />
            {t("qr.download")}
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
          <p>{t("qr.footer")}</p>
        </div>
      </Card>
    </div>
  );
}
