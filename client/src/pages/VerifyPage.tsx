import React, { useEffect, useState } from "react";
import { useParams } from "wouter";
import * as QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ShieldCheck,
  Copy,
  Download,
  AlertCircle,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/lib/clipboard";

export default function VerifyPage() {
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Get token from URL /verify/:token
  const { token } = useParams() as { token: string };

  // Resolve token via tRPC
  const {
    data: resolveResult,
    isLoading: resolveLoading,
    error,
  } = trpc.links.resolveVisitorToken.useQuery(
    { token },
    {
      enabled: !!token,
      retry: false, // Don't retry if token is expired
    }
  );

  const verifyPasswordMutation = trpc.links.verifyAccessPassword.useMutation();

  const isPasswordProtected = resolveResult?.isPasswordProtected;
  const fullUrl = resolveResult?.fullUrl || "";
  const shortCode = resolveResult?.shortCode || "";

  useEffect(() => {
    // Only generate QR if data is loaded AND (not protected OR already verified)
    if (
      resolveResult &&
      fullUrl &&
      (isPasswordProtected === false || passwordVerified)
    ) {
      // Generate QR code
      const generateQR = async () => {
        setQrLoading(true);
        try {
          const url = await QRCode.toDataURL(fullUrl, {
            errorCorrectionLevel: "H",
            type: "image/png",
            margin: 1,
            width: 300,
            color: {
              dark: "#111827",
              light: "#ffffff",
            },
          });
          setQrDataUrl(url);
          setQrLoading(false);
        } catch (err: any) {
          console.error("Error generating QR code:", err);
          setQrLoading(false);
        }
      };
      generateQR();
    }
  }, [fullUrl, isPasswordProtected, passwordVerified]);

  const handleVerifyPassword = async (e: any) => {
    e.preventDefault();
    if (!password) return;

    setIsVerifyingPassword(true);
    setErrorMsg("");
    try {
      const result = await verifyPasswordMutation.mutateAsync({
        token,
        password,
      });
      if (result.success) {
        setPasswordVerified(true);
        toast.success(t("verify.passwordSuccess"));
      }
    } catch (err: any) {
      setErrorMsg(err.message || t("verify.passwordError"));
      toast.error(err.message || t("verify.passwordError"));
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleCopyLink = async () => {
    const success = await copyToClipboard(fullUrl);
    if (success) {
      toast.success(t("verify.copySuccess"));
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;

    const downloadLink = document.createElement("a");
    downloadLink.href = qrDataUrl;
    downloadLink.download = `secure-qr-${shortCode || "scan"}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    toast.success(t("verify.downloadSuccess"));
  };

  if (resolveLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto text-blue-500" />
          <p className="text-slate-500 font-medium animate-pulse">
            {t("verify.validating")}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <Card className="w-full max-w-md p-8 text-center space-y-6 border-red-100 shadow-xl shadow-red-500/5">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">
              {t("verify.expiredTitle")}
            </h1>
            <p className="text-slate-500">{t("verify.expiredDesc")}</p>
          </div>
          <Button
            className="w-full bg-slate-900 hover:bg-slate-800"
            onClick={() => window.location.reload()}
          >
            {t("verify.retry")}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans selection:bg-blue-100">
      <Card className="w-full max-w-md overflow-hidden border-none shadow-2xl relative">
        {/* Top Accent Bar */}
        <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />

        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-2">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {isPasswordProtected && !passwordVerified
                ? t("verify.passwordTitle")
                : t("verify.title")}
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed max-w-[280px] mx-auto">
              {isPasswordProtected && !passwordVerified
                ? t("verify.passwordDesc")
                : t("verify.subtitle")}
            </p>
          </div>

          {/* Condition Rendering: Password or QR */}
          {isPasswordProtected && !passwordVerified ? (
            <form
              onSubmit={handleVerifyPassword}
              className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <div className="space-y-4">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type="password"
                    autoFocus
                    placeholder={t("verify.passwordPlaceholder")}
                    className="block w-full pl-10 pr-3 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-lg font-medium tracking-widest placeholder:tracking-normal placeholder:font-normal"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
                {errorMsg && (
                  <div className="flex items-center gap-2 text-red-500 text-sm font-medium animate-in shake duration-300">
                    <AlertCircle className="w-4 h-4" />
                    {errorMsg}
                  </div>
                )}
              </div>
              <Button
                type="submit"
                className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-lg shadow-lg shadow-slate-200"
                disabled={isVerifyingPassword}
              >
                {isVerifyingPassword ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  t("verify.unlock")
                )}
              </Button>
            </form>
          ) : (
            <>
              {/* QR Code Section */}
              <div className="relative group animate-in zoom-in-95 duration-500">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-white p-6 rounded-2xl border border-slate-100 flex justify-center">
                  {qrLoading ? (
                    <div className="w-64 h-64 bg-slate-50 rounded-xl flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <img
                        src={qrDataUrl}
                        alt="Secure QR"
                        className="w-64 h-64 select-none pointer-events-none"
                      />
                      <p className="mt-4 text-[10px] font-medium text-slate-400 opacity-80 uppercase tracking-wider">
                        {t("verify.qrCodeTip")}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Actions */}
              <div className="flex justify-center">
                <Button
                  onClick={handleDownloadQR}
                  variant="outline"
                  className="h-12 border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all font-medium text-slate-600 px-8"
                  disabled={!qrDataUrl}
                >
                  <Download className="mr-2 w-4 h-4" />
                  {t("verify.download")}
                </Button>
              </div>
            </>
          )}

          {/* Trust Footer */}
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {t("verify.secureStamp")}
            </div>
          </div>
        </div>
      </Card>

      {/* Background Decor */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px]" />
      </div>
    </div>
  );
}
