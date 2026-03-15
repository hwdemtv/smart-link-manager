import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, CreditCard } from "lucide-react";
import { useState } from "react";
import MemberManagement from "@/components/admin/MemberManagement";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { trpc } from "@/lib/trpc";

export default function TenantSettings() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("members");
  const { t } = useTranslation();

  const { data: subscription } = trpc.tenant.getSubscription.useQuery();

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

  // Only tenant admins can access this page
  if (user?.role !== "tenant_admin" && user?.role !== "admin") {
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{t("admin.tenantSettings")}</h1>
            <p className="text-muted-foreground">{t("admin.tenantSettingsSubtitle")}</p>
          </div>
          <LanguageSwitcher />
        </div>

        {/* Subscription Info */}
        {subscription && (
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">{subscription.plan?.name || "Free"} {t("admin.subMgmt.plan")}</p>
                    <p className="text-sm text-muted-foreground">
                      {subscription.isDefaultFree
                        ? t("admin.memberMgmt.defaultPlan")
                        : `${t("admin.subMgmt.expires")}: ${subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "-"}`}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t("admin.memberMgmt.title")}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t("admin.tenantSettings")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4 space-y-4">
            <MemberManagement />
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.tenantSettings")}</CardTitle>
                <CardDescription>{t("admin.tenantSettingsDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t("admin.comingSoon")}</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
