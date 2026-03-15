import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2, Building2, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function TenantRegister() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"tenant" | "account" | "success">("tenant");
  const [tenantSlug, setTenantSlug] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const utils = trpc.useUtils();

  // Check tenant status
  const tenantCheck = trpc.tenant.checkTenant.useQuery(
    { slug: tenantSlug },
    { enabled: tenantSlug.length >= 3, retry: false }
  );

  // Register mutation
  const registerMutation = trpc.tenant.registerAdmin.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      setStep("success");
    },
    onError: (err) => {
      setError(err.message || t("common.error"));
    },
  });

  const handleCheckTenant = async () => {
    if (tenantSlug.length < 3) {
      setError(t("admin.tenantRegister.slugMinLength"));
      return;
    }
    setError("");
    // The query will automatically run via the enabled condition
  };

  const handleRegister = async () => {
    setError("");

    if (!username || username.length < 3) {
      setError(t("admin.tenantRegister.usernameMinLength"));
      return;
    }
    if (!password || password.length < 6) {
      setError(t("admin.tenantRegister.passwordMinLength"));
      return;
    }

    await registerMutation.mutateAsync({
      tenantSlug,
      username,
      password,
      name: name || undefined,
    });
  };

  // Auto-advance to account step when tenant is confirmed
  useEffect(() => {
    if (tenantCheck.data?.exists && tenantCheck.data?.active && step === "tenant") {
      setStep("account");
    }
  }, [tenantCheck.data, step]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-4 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setLocation("/")}
          >
            <Link2 className="w-6 h-6 text-accent-blue" />
            <span className="font-bold text-lg">{t("common.brandName")}</span>
          </div>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {step === "tenant" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  {t("admin.tenantRegister.title")}
                </CardTitle>
                <CardDescription>{t("admin.tenantRegister.tenantStepDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                      {error}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="tenantSlug">{t("admin.tenantRegister.tenantSlug")}</Label>
                    <Input
                      id="tenantSlug"
                      value={tenantSlug}
                      onChange={(e) => {
                        setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                        setError("");
                      }}
                      placeholder={t("admin.tenantRegister.tenantSlugPlaceholder")}
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("admin.tenantRegister.tenantSlugHint")}
                    </p>
                  </div>

                  {/* Tenant Status Indicator */}
                  {tenantSlug.length >= 3 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      {tenantCheck.isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">{t("common.loading")}</span>
                        </>
                      ) : tenantCheck.data?.exists ? (
                        tenantCheck.data.active ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-600">
                              {t("admin.tenantRegister.tenantFound")}: {tenantCheck.data.name}
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm text-yellow-600">
                              {t("admin.tenantRegister.tenantInactive")}
                            </span>
                          </>
                        )
                      ) : tenantCheck.isFetched ? (
                        <>
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-600">
                            {t("admin.tenantRegister.tenantNotFound")}
                          </span>
                        </>
                      ) : null}
                    </div>
                  )}

                  <Button
                    onClick={handleCheckTenant}
                    disabled={tenantSlug.length < 3 || tenantCheck.isLoading}
                    className="w-full"
                  >
                    {t("admin.tenantRegister.continue")}
                  </Button>

                  <div className="text-center text-sm text-muted-foreground">
                    {t("admin.tenantRegister.hasAccount")}{" "}
                    <button
                      type="button"
                      onClick={() => setLocation("/login")}
                      className="text-accent-blue hover:underline"
                    >
                      {t("login.loginNow")}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "account" && (
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.tenantRegister.createAccount")}</CardTitle>
                <CardDescription>
                  {t("admin.tenantRegister.createAccountDesc", { tenant: tenantCheck.data?.name || tenantSlug })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                      {error}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="username">{t("common.username")} *</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError("");
                      }}
                      placeholder={t("login.usernamePlaceholder")}
                      className="mt-1.5"
                      minLength={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">{t("common.password")} *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      placeholder={t("login.passwordPlaceholder")}
                      className="mt-1.5"
                      minLength={6}
                    />
                  </div>

                  <div>
                    <Label htmlFor="name">{t("login.displayName")}</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("login.namePlaceholder")}
                      className="mt-1.5"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setStep("tenant")}
                      className="flex-1"
                    >
                      {t("common.back")}
                    </Button>
                    <Button
                      onClick={handleRegister}
                      disabled={registerMutation.isPending}
                      className="flex-1"
                    >
                      {registerMutation.isPending ? t("login.processing") : t("common.register")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "success" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  {t("admin.tenantRegister.success")}
                </CardTitle>
                <CardDescription>{t("admin.tenantRegister.successDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setLocation("/dashboard")}
                  className="w-full"
                >
                  {t("dashboard.myLinks")}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
