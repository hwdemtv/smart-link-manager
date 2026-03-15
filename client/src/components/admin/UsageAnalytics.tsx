import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - recharts types are incompatible with strict mode
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Link2, MousePointer, Activity } from "lucide-react";

export default function UsageAnalytics() {
  const { t } = useTranslation();
  const { data: tenants, isLoading: tenantsLoading } = trpc.tenant.list.useQuery();

  // Get usage for each tenant
  const tenantUsageQueries = trpc.useQueries((t) =>
    tenants?.map((tenant: any) => ({
      queryKey: ["tenant.getUsage", { days: 30 }],
      queryFn: () => t.tenant.getUsage({ days: 30 }),
    })) || []
  );

  const isLoading = tenantsLoading || tenantUsageQueries.some((q: any) => q.isLoading);

  // Calculate platform totals
  const platformTotals = tenantUsageQueries.reduce(
    (acc: { linksCreated: number; apiCalls: number; totalClicks: number }, query: any) => {
      if (query.data?.totals) {
        return {
          linksCreated: acc.linksCreated + (query.data.totals.linksCreated || 0),
          apiCalls: acc.apiCalls + (query.data.totals.apiCalls || 0),
          totalClicks: acc.totalClicks + (query.data.totals.totalClicks || 0),
        };
      }
      return acc;
    },
    { linksCreated: 0, apiCalls: 0, totalClicks: 0 }
  );

  // Build tenant stats with usage data
  const tenantStats = tenants?.map((tenant: any, index: number) => {
    const usageQuery = tenantUsageQueries[index];
    return {
      tenant,
      usage: usageQuery?.data?.totals || { linksCreated: 0, apiCalls: 0, totalClicks: 0 },
    };
  });

  // Build chart data from all tenants' daily usage
  const chartData: Record<string, { date: string; links: number; clicks: number; apiCalls: number }> = {};
  tenantUsageQueries.forEach((query: any) => {
    if (query.data?.daily) {
      query.data.daily.forEach((log: any) => {
        if (!chartData[log.date]) {
          chartData[log.date] = { date: log.date, links: 0, clicks: 0, apiCalls: 0 };
        }
        chartData[log.date].links += log.linksCreated || 0;
        chartData[log.date].clicks += log.totalClicks || 0;
        chartData[log.date].apiCalls += log.apiCalls || 0;
      });
    }
  });

  const sortedChartData = Object.values(chartData).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);

  return (
    <div className="space-y-6">
      {/* Platform Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("admin.usage.links")}</p>
              <p className="text-2xl font-bold">{platformTotals.linksCreated.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MousePointer className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("admin.usage.clicks")}</p>
              <p className="text-2xl font-bold">{platformTotals.totalClicks.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("admin.usage.apiCalls")}</p>
              <p className="text-2xl font-bold">{platformTotals.apiCalls.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Links Created Trend */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.usage.linksTrend")}</CardTitle>
          <CardDescription>{t("admin.usage.linksTrendDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
          ) : sortedChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sortedChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.substring(5)} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  name={t("admin.usage.links")}
                  type="monotone"
                  dataKey="links"
                  stroke="#6366f1"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">{t("admin.tenantMgmt.noTenants")}</div>
          )}
        </CardContent>
      </Card>

      {/* Platform Activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.usage.platformActivity")}</CardTitle>
          <CardDescription>{t("admin.usage.activityDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
          ) : sortedChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sortedChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v: string) => v.substring(5)} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar name={t("admin.usage.clicks")} dataKey="clicks" fill="#ec4899" />
                <Bar name={t("admin.usage.apiCalls")} dataKey="apiCalls" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">{t("admin.tenantMgmt.noTenants")}</div>
          )}
        </CardContent>
      </Card>

      {/* Top Tenants */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.usage.topTenants")}</CardTitle>
          <CardDescription>{t("admin.usage.topTenantsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
          ) : tenantStats && tenantStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.tenantMgmt.name")}</TableHead>
                  <TableHead>{t("admin.usage.links")}</TableHead>
                  <TableHead>{t("admin.usage.clicks")}</TableHead>
                  <TableHead>{t("admin.usage.apiCalls")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantStats
                  .sort((a: any, b: any) => b.usage.totalClicks - a.usage.totalClicks)
                  .slice(0, 10)
                  .map(({ tenant, usage }: any) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tenant.primaryColor || "#6366f1" }}
                          />
                          {tenant.name}
                        </div>
                      </TableCell>
                      <TableCell>{usage.linksCreated.toLocaleString()}</TableCell>
                      <TableCell>{usage.totalClicks.toLocaleString()}</TableCell>
                      <TableCell>{usage.apiCalls.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t("admin.tenantMgmt.noTenants")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
