import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, ExternalLink, Copy, QrCode, TrendingUp, Monitor, Smartphone, Tablet, Globe, Clock } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export default function LinkDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const linkId = parseInt(id || "0");
  const { t } = useTranslation();

  const linkQuery = trpc.links.getById.useQuery({ linkId });
  const statsQuery = trpc.links.getStatsSummary.useQuery({ linkId });

  const link = linkQuery.data;
  const stats = statsQuery.data;

  const copyToClipboard = () => {
    if (!link) return;
    const fullUrl = `${window.location.origin}/s/${link.shortCode}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success(t("linkDetail.copySuccess"));
  };

  const deviceIcons: Record<string, any> = {
    desktop: Monitor,
    mobile: Smartphone,
    tablet: Tablet,
    unknown: Globe,
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
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">{t("linkDetail.last7Days")}</h2>
            {stats?.last7Days ? (
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

          {/* Device Distribution */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">{t("linkDetail.deviceDistribution")}</h2>
            {stats?.deviceStats && Object.keys(stats.deviceStats).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(stats.deviceStats).map(([device, count]) => {
                  const Icon = deviceIcons[device] || Globe;
                  const percentage = stats.totalClicks > 0 ? ((count as number) / stats.totalClicks) * 100 : 0;
                  return (
                    <div key={device} className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="capitalize">{device}</span>
                          <span>{count} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">{t("linkDetail.noData")}</div>
            )}
          </Card>
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
