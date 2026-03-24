import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Ghost, Home, AlertTriangle, Clock } from "lucide-react";
import { useLocation } from "wouter";

export default function LinkErrorPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  // Get error type from URL query: /error?type=EXPIRED
  const searchParams = new URLSearchParams(window.location.search);
  const type = searchParams.get("type") || "NOT_FOUND";

  const isExpired = type === "EXPIRED" || type === "410";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans selection:bg-red-100">
      <Card className="w-full max-w-lg overflow-hidden border-none shadow-2xl relative">
        {/* Accent Bar */}
        <div className={`h-2 ${isExpired ? "bg-amber-500" : "bg-red-500"}`} />

        <div className="p-10 space-y-8 text-center">
          {/* Icon Area */}
          <div className="relative inline-block">
            <div
              className={`absolute inset-0 blur-2xl opacity-20 rounded-full ${isExpired ? "bg-amber-500" : "bg-red-500"}`}
            />
            <div
              className={`relative w-24 h-24 rounded-3xl flex items-center justify-center mx-auto ${isExpired ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}
            >
              {isExpired ? (
                <Clock className="w-12 h-12 animate-pulse" />
              ) : (
                <Ghost className="w-12 h-12 animate-bounce" />
              )}
            </div>
          </div>

          {/* Text Content */}
          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              {isExpired ? t("error.expiredTitle") : t("error.notFoundTitle")}
            </h1>
            <p className="text-slate-500 text-lg leading-relaxed max-w-sm mx-auto">
              {isExpired ? t("error.expiredDesc") : t("error.notFoundDesc")}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              size="lg"
              className="h-14 px-8 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-lg shadow-slate-200"
              onClick={() => setLocation("/dashboard")}
            >
              <Home className="mr-2 w-5 h-5" />
              {t("error.backHome")}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-8 border-slate-200 hover:bg-slate-50 rounded-xl font-bold"
              onClick={() => window.location.reload()}
            >
              {t("error.retry")}
            </Button>
          </div>

          {/* Help Text */}
          <div className="pt-8 border-t border-slate-100 italic text-slate-400 text-sm">
            {t("error.contactAdmin")}
          </div>
        </div>
      </Card>

      {/* Background Decor */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
        <div
          className={`absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[150px] opacity-20 ${isExpired ? "bg-amber-200" : "bg-red-200"}`}
        />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-slate-200 rounded-full blur-[150px] opacity-20" />
      </div>
    </div>
  );
}
