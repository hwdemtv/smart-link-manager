import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// @ts-ignore
import * as Recharts from "recharts";
const {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} = Recharts as any;
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Link2, MousePointer, Activity } from "lucide-react";

// Chart data type
interface ChartDataItem {
  date: string;
  links: number;
  clicks: number;
  apiCalls: number;
}

// User stat type
interface UserStatItem {
  userId: number;
  userName?: string;
  userUsername?: string;
  linksCreated?: number;
  totalClicks?: number;
  apiCalls?: number;
}

export default function UsageAnalytics() {
  const { t } = useTranslation();
  const { data: platformUsage, isLoading } = trpc.user.getPlatformUsage.useQuery({ days: 30 });

  const platformTotals = platformUsage?.totals || { linksCreated: 0, apiCalls: 0, totalClicks: 0 };
  const dailyData = platformUsage?.daily || [];
  const userStats = platformUsage?.userStats || [];

  // Format chart data
  const sortedChartData: ChartDataItem[] = dailyData
    .map((d: { date: string; linksCreated?: number; totalClicks?: number; apiCalls?: number }) => ({
      date: d.date,
      links: d.linksCreated || 0,
      clicks: d.totalClicks || 0,
      apiCalls: d.apiCalls || 0,
    }))
    .sort((a: ChartDataItem, b: ChartDataItem) => a.date.localeCompare(b.date))
    .slice(-7);

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
            <div className="text-center py-8 text-muted-foreground">{t("admin.usage.noData")}</div>
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
            <div className="text-center py-8 text-muted-foreground">{t("admin.usage.noData")}</div>
          )}
        </CardContent>
      </Card>

      {/* Top Users */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.usage.topUsers")}</CardTitle>
          <CardDescription>{t("admin.usage.topUsersDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
          ) : userStats && userStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.userMgmt.username")}</TableHead>
                  <TableHead>{t("admin.usage.links")}</TableHead>
                  <TableHead>{t("admin.usage.clicks")}</TableHead>
                  <TableHead>{t("admin.usage.apiCalls")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(userStats as UserStatItem[]).slice(0, 10).map((stat) => (
                  <TableRow key={stat.userId}>
                    <TableCell className="font-medium">
                      {stat.userName || stat.userUsername || `User ${stat.userId}`}
                    </TableCell>
                    <TableCell>{(stat.linksCreated || 0).toLocaleString()}</TableCell>
                    <TableCell>{(stat.totalClicks || 0).toLocaleString()}</TableCell>
                    <TableCell>{(stat.apiCalls || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t("admin.usage.noUsers")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
