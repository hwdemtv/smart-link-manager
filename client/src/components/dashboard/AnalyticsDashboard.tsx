import React from "react";
import { Card } from "@/components/ui/card";
// Recharts types are properly defined but TypeScript's moduleResolution: bundler has issues
// with packages that don't have an "exports" field.
// @ts-ignore
import * as Recharts from "recharts";
const {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
  Treemap,
  BarChart,
  Bar,
} = Recharts as any;
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { Loader2, MapPin, Globe2, TrendingUp } from "lucide-react";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#f97316",
];

// 国旗 Emoji 映射（常见国家）
const COUNTRY_FLAGS: Record<string, string> = {
  China: "🇨🇳",
  "United States": "🇺🇸",
  Japan: "🇯🇵",
  Korea: "🇰🇷",
  "United Kingdom": "🇬🇧",
  Germany: "🇩🇪",
  France: "🇫🇷",
  Canada: "🇨🇦",
  Australia: "🇦🇺",
  India: "🇮🇳",
  Brazil: "🇧🇷",
  Russia: "🇷🇺",
  Singapore: "🇸🇬",
  "Hong Kong": "🇭🇰",
  Taiwan: "🇹🇼",
  Thailand: "🇹🇭",
  Vietnam: "🇻🇳",
  Malaysia: "🇲🇾",
  Indonesia: "🇮🇩",
  Philippines: "🇵🇭",
  Local: "🏠",
  Unknown: "❓",
};

// Treemap 自定义内容渲染
const TREEMAP_COLORS = [
  "#3b82f6",
  "#2563eb",
  "#1d4ed8",
  "#60a5fa",
  "#93c5fd",
  "#06b6d4",
  "#0891b2",
  "#0e7490",
];

// Chart data types
interface TimeSeriesItem {
  date: string;
  clicks: number;
}

interface NameValueItem {
  name: string;
  value: number;
}

interface TreemapContentProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  value: number;
  index: number;
}

const CustomTreemapContent = (props: TreemapContentProps) => {
  const { x, y, width, height, name, value, index } = props;
  if (width < 30 || height < 30) return null;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: TREEMAP_COLORS[index % TREEMAP_COLORS.length],
          stroke: "#fff",
          strokeWidth: 2,
          strokeOpacity: 1,
          rx: 4,
          ry: 4,
        }}
      />
      {width > 60 && height > 40 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 8}
            textAnchor="middle"
            fill="#fff"
            fontSize={width > 100 ? 14 : 11}
            fontWeight="600"
          >
            {COUNTRY_FLAGS[name] || "🌐"} {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 12}
            textAnchor="middle"
            fill="rgba(255,255,255,0.8)"
            fontSize={width > 100 ? 12 : 10}
          >
            {value} 次点击
          </text>
        </>
      )}
    </g>
  );
};

export function AnalyticsDashboard() {
  const { t } = useTranslation();

  // 拉取过去 7 天的全局大盘数据
  const { data: stats, isLoading } = trpc.links.globalStats.useQuery({
    days: 7,
  });

  if (isLoading) {
    return (
      <Card className="p-12 flex justify-center items-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mr-3" />
        <span className="text-muted-foreground">{t("analytics.loading")}</span>
      </Card>
    );
  }

  if (!stats || stats.totalClicks === 0) {
    return (
      <Card className="p-12 flex flex-col justify-center items-center min-h-[300px] border-dashed bg-muted/20">
        <div className="p-4 bg-muted/50 rounded-full mb-4">
          <TrendingUp className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-center max-w-xs">
          {t("analytics.noData")}
        </p>
      </Card>
    );
  }

  // 整理折线图数据
  const timeSeriesData: TimeSeriesItem[] = Object.entries(stats.timeSeries)
    .map(([date, count]) => ({
      date: date.substring(5),
      clicks: count as number,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 整理饼图数据
  const deviceData: NameValueItem[] = Object.entries(stats.deviceStats || {})
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: value as number,
    }))
    .sort((a, b) => b.value - a.value);

  // 整理国家 Treemap 数据
  const countryData: NameValueItem[] = Object.entries(stats.countryStats || {})
    .map(([name, value]) => ({
      name,
      value: value as number,
    }))
    .sort((a, b) => b.value - a.value);

  // 整理城市 Top 排行数据
  const cityData: NameValueItem[] = Object.entries(
    (stats as { cityStats?: Record<string, number> }).cityStats || {}
  )
    .map(([name, value]) => ({
      name,
      value: value as number,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // 整理浏览器数据
  const browserData: NameValueItem[] = Object.entries(
    (stats as { browserStats?: Record<string, number> }).browserStats || {}
  )
    .map(([name, value]) => ({
      name,
      value: value as number,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      {/* 访问趋势面积图 (占满2栏) */}
      <Card className="p-4 lg:col-span-2">
        <h3 className="text-md font-semibold mb-4 flex items-center">
          📈 {t("analytics.recentTraffic")}
        </h3>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={timeSeriesData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                opacity={0.3}
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                dy={10}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              />
              <Area
                type="monotone"
                dataKey="clicks"
                name={t("analytics.clicks")}
                stroke="#3b82f6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorClicks)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 地域分布 Treemap (占满2栏) */}
      {countryData.length > 0 && (
        <Card className="p-4 lg:col-span-2">
          <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-accent-blue" />
            {t("analytics.countryDistribution")} · 地域热力图
          </h3>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={countryData}
                dataKey="value"
                nameKey="name"
                aspectRatio={4 / 3}
                stroke="#fff"
                content={
                  <CustomTreemapContent {...({} as TreemapContentProps)} />
                }
              />
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* 城市 Top 排行 (占1栏) */}
      {cityData.length > 0 && (
        <Card className="p-4">
          <h3 className="text-md font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-accent-blue" />
            城市 Top 排行
          </h3>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cityData}
                layout="vertical"
                margin={{ left: 0, right: 16 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  opacity={0.3}
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value: number) => [`${value}`, "点击量"]}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* 设备分布饼图 (占1栏) */}
      <Card className="p-4">
        <h3 className="text-md font-semibold mb-4 flex items-center">
          📱 {t("analytics.deviceDistribution")}
        </h3>
        <div className="h-[220px] w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={deviceData}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {deviceData.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
                formatter={(value: number) => [
                  `${value}`,
                  t("analytics.visits"),
                ]}
              />
              <Legend
                verticalAlign="bottom"
                height={30}
                iconType="circle"
                wrapperStyle={{ fontSize: "12px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 浏览器分布 + 国家列表 (占满2栏) */}
      <Card className="p-4 lg:col-span-2">
        <h3 className="text-md font-semibold mb-4">📊 详细数据分布</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 浏览器 */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              浏览器
            </h4>
            <div className="space-y-2">
              {browserData.map((item, i) => {
                const maxVal = browserData[0]?.value || 1;
                const pct = Math.round((item.value / maxVal) * 100);
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-sm w-20 truncate">{item.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {item.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* 国家列表 */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              国家 / 地区
            </h4>
            <div className="space-y-2">
              {countryData.slice(0, 5).map((item, i) => {
                const maxVal = countryData[0]?.value || 1;
                const pct = Math.round((item.value / maxVal) * 100);
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-sm w-20 truncate">
                      {COUNTRY_FLAGS[item.name] || "🌐"} {item.name}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            TREEMAP_COLORS[i % TREEMAP_COLORS.length],
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {item.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
