import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { AlertCircle } from "lucide-react";

export default function SubscriptionManagement() {
  const { t } = useTranslation();
  const { data: plans, isLoading: plansLoading, error: plansError } = trpc.tenant.getPlans.useQuery();
  const { data: subscriptions, isLoading: subsLoading, error: subsError } = trpc.tenant.getAllSubscriptions.useQuery();

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      cancelled: "secondary",
      expired: "destructive",
      suspended: "outline",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.subMgmt.title")}</CardTitle>
        <CardDescription>{t("admin.subMgmt.subtitle")}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          {/* Subscription Plans */}
          <div>
            <h3 className="font-semibold mb-3">{t("admin.subMgmt.plans")}</h3>
            {plansError ? (
              <div className="flex items-center gap-2 text-destructive py-4">
                <AlertCircle className="w-4 h-4" />
                <span>{plansError.message}</span>
              </div>
            ) : plansLoading ? (
              <div className="text-center py-4 text-muted-foreground">{t("common.loading")}</div>
            ) : plans && plans.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.subMgmt.planName")}</TableHead>
                    <TableHead>{t("admin.subMgmt.monthlyPrice")}</TableHead>
                    <TableHead>{t("admin.subMgmt.maxLinks")}</TableHead>
                    <TableHead>{t("admin.subMgmt.apiCallsDay")}</TableHead>
                    <TableHead>{t("admin.subMgmt.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan: any) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>
                        {plan.monthlyPrice === 0 ? t("admin.subMgmt.custom") : formatPrice(plan.monthlyPrice)}
                      </TableCell>
                      <TableCell>{plan.maxLinks === -1 ? t("admin.subMgmt.unlimited") : plan.maxLinks.toLocaleString()}</TableCell>
                      <TableCell>{plan.maxApiCallsPerDay === -1 ? t("admin.subMgmt.unlimited") : plan.maxApiCallsPerDay.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={plan.isActive ? "default" : "secondary"}>
                          {plan.isActive ? t("admin.subMgmt.active") : t("admin.tenantMgmt.table.inactive")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-4 text-muted-foreground">{t("admin.tenantMgmt.noTenants")}</div>
            )}
          </div>

          {/* Active Subscriptions */}
          <div>
            <h3 className="font-semibold mb-3">{t("admin.subMgmt.activeSubs")}</h3>
            {subsError ? (
              <div className="flex items-center gap-2 text-destructive py-4">
                <AlertCircle className="w-4 h-4" />
                <span>{subsError.message}</span>
              </div>
            ) : subsLoading ? (
              <div className="text-center py-4 text-muted-foreground">{t("common.loading")}</div>
            ) : subscriptions && subscriptions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.subMgmt.tenant")}</TableHead>
                    <TableHead>{t("admin.subMgmt.plan")}</TableHead>
                    <TableHead>{t("admin.subMgmt.billingCycle")}</TableHead>
                    <TableHead>{t("admin.subMgmt.status")}</TableHead>
                    <TableHead>{t("admin.subMgmt.expires")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((item: any) => (
                    <TableRow key={item.subscription.id}>
                      <TableCell className="font-medium">{item.tenant?.name || "-"}</TableCell>
                      <TableCell>{item.plan?.name || "-"}</TableCell>
                      <TableCell className="capitalize">{item.subscription.billingCycle}</TableCell>
                      <TableCell>{getStatusBadge(item.subscription.status)}</TableCell>
                      <TableCell>{formatDate(item.subscription.currentPeriodEnd)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                {t("admin.tenantMgmt.noTenants")}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
