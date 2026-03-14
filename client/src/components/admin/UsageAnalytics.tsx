import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const mockData = [
  { date: "2024-01-01", links: 120, clicks: 2400, apiCalls: 1200 },
  { date: "2024-01-02", links: 150, clicks: 2210, apiCalls: 1290 },
  { date: "2024-01-03", links: 200, clicks: 2290, apiCalls: 1000 },
  { date: "2024-01-04", links: 180, clicks: 2000, apiCalls: 1181 },
  { date: "2024-01-05", links: 220, clicks: 2181, apiCalls: 1500 },
  { date: "2024-01-06", links: 250, clicks: 2500, apiCalls: 1100 },
  { date: "2024-01-07", links: 300, clicks: 2100, apiCalls: 1200 },
];

export default function UsageAnalytics() {
  return (
    <div className="space-y-6">
      {/* Links Created Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Links Created (7 Days)</CardTitle>
          <CardDescription>Total short links created across all tenants</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="links" stroke="#6366f1" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Platform Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Activity (7 Days)</CardTitle>
          <CardDescription>Clicks and API calls across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="clicks" fill="#ec4899" />
              <Bar dataKey="apiCalls" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Tenants */}
      <Card>
        <CardHeader>
          <CardTitle>Top Tenants (This Month)</CardTitle>
          <CardDescription>Tenants with highest usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: "Acme Corp", links: 1250, clicks: 45000 },
              { name: "TechStart Inc", links: 890, clicks: 32000 },
              { name: "Global Solutions", links: 750, clicks: 28000 },
            ].map((tenant, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{tenant.name}</p>
                  <p className="text-sm text-muted-foreground">{tenant.links} links • {tenant.clicks.toLocaleString()} clicks</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
