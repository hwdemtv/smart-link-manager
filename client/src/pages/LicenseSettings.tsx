import { useAuth } from "@/_core/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Key,
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
  Crown,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function LicenseSettings() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [licenseKey, setLicenseKey] = useState("");

  const {
    data: subscription,
    isLoading,
    refetch,
  } = trpc.user.getSubscription.useQuery();
  const activateMutation = trpc.user.activateLicense.useMutation({
    onSuccess: () => {
      toast.success(t("license.activateSuccess"));
      setLicenseKey("");
      refetch();
    },
    onError: error => {
      toast.error(error.message);
    },
  });
  const unbindMutation = trpc.user.unbindLicense.useMutation({
    onSuccess: () => {
      toast.success(t("license.unbindSuccess"));
      refetch();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const handleActivate = () => {
    if (!licenseKey.trim()) {
      toast.error(t("license.keyRequired"));
      return;
    }
    activateMutation.mutate({ licenseKey: licenseKey.trim() });
  };

  const handleUnbind = () => {
    unbindMutation.mutate();
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "business":
        return (
          <Badge className="bg-purple-500">
            <Crown className="w-3 h-3 mr-1" />
            Business
          </Badge>
        );
      case "pro":
        return (
          <Badge className="bg-blue-500">
            <Zap className="w-3 h-3 mr-1" />
            Pro
          </Badge>
        );
      default:
        return <Badge variant="secondary">Free</Badge>;
    }
  };

  const getTierName = (tier: string) => {
    switch (tier) {
      case "business":
        return "Business";
      case "pro":
        return "Pro";
      default:
        return "Free";
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return t("license.permanent");
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const limits = subscription?.limits || {
    maxLinks: 20,
    maxDomains: 1,
    maxApiKeys: 1,
  };
  const usage = subscription?.usage || { links: 0, domains: 0 };

  return (
    <div className="min-h-content bg-background">
      <div className="container mx-auto py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t("license.title")}
          </h1>
          <p className="text-muted-foreground">{t("license.subtitle")}</p>
        </div>

        {/* Current Plan */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {t("license.currentPlan")}
                  {getTierBadge(subscription?.tier || "free")}
                </CardTitle>
                <CardDescription>
                  {subscription?.isValid
                    ? t("license.active")
                    : t("license.expired")}
                </CardDescription>
              </div>
              {subscription?.isValid ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscription?.licenseKey && (
              <div className="flex items-center gap-2 text-sm">
                <Key className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t("license.keyLabel")}:
                </span>
                <code className="bg-muted px-2 py-1 rounded font-mono">
                  {subscription.licenseKey}
                </code>
              </div>
            )}
            {subscription?.expiresAt && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t("license.expiresAt")}:
                </span>
                <span>{formatDate(subscription.expiresAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("license.usageOverview")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Links Usage */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t("license.linksUsage")}</span>
                <span>
                  {usage.links} /{" "}
                  {limits.maxLinks === -1 ? "∞" : limits.maxLinks}
                </span>
              </div>
              <Progress
                value={
                  limits.maxLinks === -1
                    ? 0
                    : (usage.links / limits.maxLinks) * 100
                }
                className="h-2"
              />
            </div>

            {/* Domains Usage */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t("license.domainsUsage")}</span>
                <span>
                  {usage.domains} /{" "}
                  {limits.maxDomains === -1 ? "∞" : limits.maxDomains}
                </span>
              </div>
              <Progress
                value={
                  limits.maxDomains === -1
                    ? 0
                    : (usage.domains / limits.maxDomains) * 100
                }
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Activate License */}
        <Card>
          <CardHeader>
            <CardTitle>{t("license.activateTitle")}</CardTitle>
            <CardDescription>{t("license.activateDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder={t("license.keyPlaceholder")}
                value={licenseKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLicenseKey(e.target.value)
                }
                className="flex-1"
              />
              <Button
                onClick={handleActivate}
                disabled={activateMutation.isPending || !licenseKey.trim()}
              >
                {activateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("license.activate")}
              </Button>
            </div>

            {subscription?.licenseKey && (
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={handleUnbind}
                  disabled={unbindMutation.isPending}
                >
                  {unbindMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("license.unbind")}
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  {t("license.unbindWarning")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Comparison */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("license.planComparison")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div
                className={`p-4 rounded-lg border ${subscription?.tier === "free" ? "border-primary bg-primary/5" : ""}`}
              >
                <h3 className="font-semibold mb-2">Free</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{t("license.links")}: 20</p>
                  <p>{t("license.domains")}: 1</p>
                  <p>{t("license.apiKeys")}: 1</p>
                </div>
              </div>
              <div
                className={`p-4 rounded-lg border ${subscription?.tier === "pro" ? "border-primary bg-primary/5" : ""}`}
              >
                <h3 className="font-semibold mb-2">Pro</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{t("license.links")}: 500</p>
                  <p>{t("license.domains")}: 5</p>
                  <p>{t("license.apiKeys")}: 5</p>
                </div>
              </div>
              <div
                className={`p-4 rounded-lg border ${subscription?.tier === "business" ? "border-primary bg-primary/5" : ""}`}
              >
                <h3 className="font-semibold mb-2">Business</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{t("license.links")}: ∞</p>
                  <p>{t("license.domains")}: 10</p>
                  <p>{t("license.apiKeys")}: 10</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
