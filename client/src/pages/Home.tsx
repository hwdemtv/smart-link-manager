import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Link2, Zap, BarChart3, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  // Redirect to dashboard if authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  // 导航到登录页面
  const handleSignIn = () => {
    setLocation("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-border border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-6 h-6 text-accent-blue" />
            <span className="font-bold text-lg">{t("common.brandName")}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {!isAuthenticated && (
              <Button onClick={handleSignIn}>{t("common.login")}</Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            {t("home.title")}
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("home.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" className="w-full sm:w-auto" onClick={handleSignIn}>
              {t("home.getStarted")}
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => setLocation("/dashboard")}>
              {t("common.dashboard")}
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-2">{t("home.featuresTitle")}</h2>
          <p className="text-muted-foreground">{t("home.featuresSubtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="p-6 rounded-lg border border-border bg-card hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-powder-blue to-accent-blue flex items-center justify-center mb-4">
              <Link2 className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="font-semibold mb-2">{t("home.features.tracking")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("home.features.trackingDesc")}
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-6 rounded-lg border border-border bg-card hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blush-pink to-accent-pink flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="font-semibold mb-2">{t("home.features.security")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("home.features.securityDesc")}
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-6 rounded-lg border border-border bg-card hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-blue to-powder-blue flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="font-semibold mb-2">{t("home.features.domains")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("home.features.domainsDesc")}
            </p>
          </div>
        </div>
      </section>

      {/*CTA Section removed or kept for simplicity */}

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 mt-20">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2026 {t("common.brandName")}. {t("home.footer.rights")}</p>
        </div>
      </footer>
    </div>
  );
}
