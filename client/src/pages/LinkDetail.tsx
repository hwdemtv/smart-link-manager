import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, ExternalLink, Copy, QrCode, TrendingUp, Monitor, Smartphone, Tablet, Globe, Clock } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";

import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export default function LinkDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const linkId = parseInt(id || "0");
  const { t } = useTranslation();

  const linkQuery = trpc.links.getById.useQuery({ linkId });
  const statsQuery = trpc.links.getStatsSummary.useQuery({ linkId });
  const configQuery = trpc.configs.getConfig.useQuery();

  const link = linkQuery.data;
  const stats = statsQuery.data;
  const defaultDomain = configQuery.data?.defaultDomain;

  const copyToClipboard = () => {
    if (!link) return;
    let baseDomain = link.customDomain || defaultDomain || window.location.origin;
    if (!baseDomain.startsWith("http")) baseDomain = `${window.location.protocol}//${baseDomain}`;
    const cleanBaseDomain = baseDomain.replace(/\/+$/, "");
    const fullUrl = `${cleanBaseDomain}/s/${link.shortCode}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success(t("linkDetail.copySuccess"));
  };

  const deviceIcons: Record<string, any> = {
    desktop: Monitor,
    mobile: Smartphone,
    tablet: Tablet,
    unknown: Globe,
  };

  const formatDataForPie = (dataRecord: Record<string, number> | undefined, limit = 5) => {
    if (!dataRecord) return [];
    const entries = Object.entries(dataRecord).sort((a, b) => b[1] - a[1]);
    if (entries.length <= limit) {
      return entries.map(([name, value]) => ({ name, value }));
    }
    const top = entries.slice(0, limit).map(([name, value]) => ({ name, value }));
    const others = entries.slice(limit).reduce((sum, [, value]) => sum + value, 0);
    top.push({ name: t("common.other", "Other"), value: others });
    return top;
  };

  const StatPieChart = ({ title, data, isLoading }: { title: string, data?: any[], isLoading?: boolean }) => {
    if (isLoading) {
      return (
        <Card className="p-6 flex flex-col h-[320px]">
          <Skeleton className="h-6 w-3/4 mb-4" />
          <div className="flex-1 flex items-center justify-center">
            <Skeleton className="h-40 w-40 rounded-full" />
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
          </div>
        </Card>
      );
    }

    if (!data || data.length === 0) {
      return (
        <Card className="p-6 flex flex-col h-[320px]">
          <h2 className="text-xl font-semibold mb-4">{title}</h2>
          <div className="flex-1 flex items-center justify-center text-muted-foreground">{t("linkDetail.noData")}</div>
        </Card>
      );
    }
    return (
      <Card className="p-6 flex flex-col h-[320px]">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: any) => [value, t("linkDetail.clicks", "Clicks")]} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    );
  };

  if (linkQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t("linkDetail.loading")}</div>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{t("linkDetail.notFound")}</h1>
          <Button onClick={() => setLocation("/dashboard")}>{t("linkDetail.backToDashboard")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container py-6">
          <Button variant="ghost" className="mb-4" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("linkDetail.backToDashboard")}
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <span className="font-mono text-accent-blue">{link.shortCode}</span>
                <span
                  className={`text-sm px-2 py-1 rounded ${
                    link.isValid
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {link.isValid ? t("linkDetail.valid") : t("linkDetail.invalid")}
                </span>
              </h1>
              {link.customDomain && (
                <p className="text-muted-foreground mt-1">{link.customDomain}</p>
              )}
              {link.description && (
                <p className="text-muted-foreground mt-2">{link.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyToClipboard}>
                <Copy className="w-4 h-4 mr-2" />
                {t("linkDetail.copyLink")}
              </Button>
              <Button asChild>
                <a href={link.originalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t("linkDetail.visitOriginal")}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-accent opacity-50" />
              <div>
                <p className="text-sm text-muted-foreground">{t("linkDetail.totalClicks")}</p>
                <p className="text-2xl font-bold">{stats?.totalClicks || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-accent opacity-50" />
              <div>
                <p className="text-sm text-muted-foreground">{t("linkDetail.created")}</p>
                <p className="text-lg font-semibold">{new Date(link.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Globe className="w-8 h-8 text-accent opacity-50" />
              <div>
                <p className="text-sm text-muted-foreground">{t("linkDetail.domain")}</p>
                <p className="text-lg font-semibold">{link.customDomain || t("linkDetail.default")}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <QrCode className="w-8 h-8 text-accent opacity-50" />
              <div>
                <p className="text-sm text-muted-foreground">{t("linkDetail.status")}</p>
                <p className="text-lg font-semibold">{link.isActive ? t("linkDetail.active") : t("linkDetail.inactive")}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Click Trend */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">{t("linkDetail.last7Days")}</h2>
          {statsQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : stats?.last7Days ? (
            <div className="flex items-end gap-2 h-40">
              {Object.entries(stats.last7Days).map(([date, count]) => {
                const maxCount = Math.max(...Object.values(stats.last7Days));
                const height = maxCount > 0 ? ((count as number) / maxCount) * 100 : 0;
                return (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-accent rounded-t"
                      style={{ height: `${Math.max(height, 4)}%`, minHeight: count ? "4px" : "0" }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {new Date(date).toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span className="text-xs font-medium">{count as number}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">{t("linkDetail.noData")}</div>
          )}
        </Card>
        </div>

        {/* Detailed Stats Grid (Doughnut Charts) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-8">
          <StatPieChart title={t("linkDetail.deviceDistribution")} data={formatDataForPie(stats?.deviceStats)} />
          <StatPieChart title={t("common.browser", "Browser")} data={formatDataForPie(stats?.browserStats)} />
          <StatPieChart title={t("common.os", "Operating System")} data={formatDataForPie(stats?.osStats)} />
          <StatPieChart title={t("common.country", "Country / Region")} data={formatDataForPie(stats?.countryStats)} />
          
          {link?.abTestEnabled === 1 && (
            <StatPieChart title={t("linkDetail.variantDistribution", "A/B 变体流向 (Variant Traffic)")} data={formatDataForPie((stats as any)?.variantStats)} />
          )}
        </div>

        {/* Original URL */}
        <Card className="p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">{t("linkDetail.originalUrl")}</h2>
          <a
            href={link.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-blue hover:underline break-all"
          >
            {link.originalUrl}
          </a>
        </Card>

        {/* Variant B URL (A/B Test) */}
        {link?.abTestEnabled === 1 && link?.abTestUrl && (
          <Card className="p-6 mt-4">
            <h2 className="text-xl font-semibold mb-4">{t("linkDetail.variantBUrl", "变体 B 目标链接 (Variant B URL)")}</h2>
            <a
              href={link.abTestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-500 hover:underline break-all"
            >
              {link.abTestUrl}
            </a>
          </Card>
        )}

        {/* Recent Clicks */}
        {stats?.recentClicks && stats.recentClicks.length > 0 && (
          <Card className="p-6 mt-8">
            <h2 className="text-xl font-semibold mb-4">{t("linkDetail.recentClicks")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-4">{t("linkDetail.time")}</th>
                    <th className="text-left py-2 px-4">{t("linkDetail.device")}</th>
                    <th className="text-left py-2 px-4">{t("linkDetail.browser")}</th>
                    <th className="text-left py-2 px-4">{t("linkDetail.os")}</th>
                    <th className="text-left py-2 px-4">{t("linkDetail.country")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentClicks.slice(0, 10).map((click: any, index: number) => (
                    <tr key={index} className="border-b border-border">
                      <td className="py-2 px-4 text-muted-foreground">
                        {new Date(click.clickedAt).toLocaleString()}
                      </td>
                      <td className="py-2 px-4 capitalize">{click.deviceType || t("linkDetail.unknown")}</td>
                      <td className="py-2 px-4">{click.browserName || t("linkDetail.unknown")}</td>
                      <td className="py-2 px-4">{click.osName || t("linkDetail.unknown")}</td>
                      <td className="py-2 px-4">{click.country || t("linkDetail.unknown")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
