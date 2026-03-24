import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import React from "react";
import { Link2, TrendingUp, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard";

export default function Analytics() {
  const { t } = useTranslation();
  const linksQuery = trpc.links.list.useQuery();

  const links = linksQuery.data || [];
  const totalClicks = links.reduce(
    (sum: number, link: any) => sum + (link.clickCount || 0),
    0
  );
  const invalidLinks = links.filter((link: any) => !link.isValid).length;

  return (
    <div className="min-h-content bg-background">
      <div className="container py-4">
        <h1 className="text-xl font-bold tracking-tight mb-1">
          {t("common.analytics")}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t("dashboard.analyticsSubtitle") || "实时追踪您的链接访问数据与趋势"}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="container py-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-accent-blue/10 bg-accent-blue/5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.totalLinks")}
                </p>
                <p className="text-2xl font-bold mt-1">{links.length}</p>
              </div>
              <div className="p-1.5 bg-accent-blue/10 rounded-lg">
                <Link2 className="w-5 h-5 text-accent-blue" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border-green-500/10 bg-green-500/5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.totalClicks")}
                </p>
                <p className="text-2xl font-bold mt-1">{totalClicks}</p>
              </div>
              <div className="p-1.5 bg-green-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border-red-500/10 bg-red-500/5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.invalidLinks")}
                </p>
                <p className="text-2xl font-bold mt-1 text-destructive">
                  {invalidLinks}
                </p>
              </div>
              <div className="p-1.5 bg-red-500/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Advanced Analytics Dashboard */}
      <div className="container py-4">
        <AnalyticsDashboard />
      </div>
    </div>
  );
}
