import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BarChart3, Link2, UserCircle, FileText, Bell, Shield } from "lucide-react";
import { useState } from "react";
import UsageAnalytics from "@/components/admin/UsageAnalytics";
import UserManagement from "@/components/admin/UserManagement";
import LinkManagement from "@/components/admin/LinkManagement";
import AuditLogManagement from "@/components/admin/AuditLogManagement";
import NotificationManagement from "@/components/admin/NotificationManagement";
import PlatformSettings from "@/components/admin/PlatformSettings";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const { t } = useTranslation();

  const { data: stats, isLoading: statsLoading } = trpc.user.getAdminStats.useQuery();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  // Only admins can access this page
  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("admin.accessDenied")}</CardTitle>
            <CardDescription>{t("admin.noPermission")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-content bg-background">
      <div className="container mx-auto py-8">
        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">{t("admin.dashboardTitle")}</h1>
            <p className="text-muted-foreground">{t("admin.dashboardSubtitle")}</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <UserCircle className="w-4 h-4" />
                {t("admin.totalUsers")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {statsLoading ? "--" : stats?.totalUsers || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {statsLoading ? "--" : stats?.activeUsers || 0} {t("admin.activeUsers")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                {t("dashboard.totalLinks")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {statsLoading ? "--" : stats?.totalLinks || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("admin.usage.linksTrendDesc")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                {t("dashboard.totalClicks")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {statsLoading ? "--" : stats?.totalClicks || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("admin.usage.clicksTrendDesc")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t("admin.userDistribution")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Free:</span>
                  <span className="font-mono">{stats?.tierDistribution?.free || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Pro:</span>
                  <span className="font-mono">{stats?.tierDistribution?.pro || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Business:</span>
                  <span className="font-mono">{stats?.tierDistribution?.business || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dynamic Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-8">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              {t("admin.overview")}
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t("admin.users")}
            </TabsTrigger>
            <TabsTrigger value="links" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              {t("admin.links")}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              {t("admin.notifications")}
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t("admin.audit")}
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {t("admin.system_settings")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <UsageAnalytics />
          </TabsContent>

          <TabsContent value="users" className="mt-4 space-y-4">
            <UserManagement />
          </TabsContent>

          <TabsContent value="links" className="mt-4 space-y-4">
            <LinkManagement />
          </TabsContent>

          <TabsContent value="notifications" className="mt-4 space-y-4">
            <NotificationManagement />
          </TabsContent>

          <TabsContent value="audit" className="mt-4 space-y-4">
            <AuditLogManagement />
          </TabsContent>

          <TabsContent value="system" className="mt-4 space-y-4">
            <PlatformSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
