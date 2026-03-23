import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Login() {
  const [, setLocation] = useLocation();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const utils = trpc.useUtils();

  const configQuery = trpc.configs.getConfig.useQuery();
  const registrationDisabled = configQuery.data?.registrationDisabled;

  // 如果注册被禁用且当前在注册模式，强制切回登录模式
  if (registrationDisabled && isRegister) {
    setIsRegister(false);
  }

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      setLocation("/dashboard");
    },
    onError: (err) => {
      // 尝试翻译错误码，如果翻译不存在则显示原始消息
      const errorCode = err.message;
      const translated = t(`serverError.${errorCode}`, { defaultValue: errorCode });
      setError(translated);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      setLocation("/dashboard");
    },
    onError: (err) => {
      // 尝试翻译错误码，如果翻译不存在则显示原始消息
      const errorCode = err.message;
      const translated = t(`serverError.${errorCode}`, { defaultValue: errorCode });
      setError(translated);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await registerMutation.mutateAsync({ username, password, name: name || undefined });
      } else {
        await loginMutation.mutateAsync({ username, password });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 顶部导航 */}
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

      {/* 登录表单 */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
            <h1 className="text-2xl font-bold text-center mb-6">
              {isRegister ? t("login.registerNow") : t("common.login")}
            </h1>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="username">
                  {t("common.username")}
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
                  placeholder={t("login.usernamePlaceholder")}
                  required
                  minLength={isRegister ? 3 : 1}
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="password">
                  {t("common.password")}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
                  placeholder={t("login.passwordPlaceholder")}
                  required
                  minLength={isRegister ? 6 : 1}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                />
              </div>

              {isRegister && (
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="name">
                    {t("login.displayName")} <span className="text-muted-foreground">({t("common.optional")})</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
                    placeholder={t("login.namePlaceholder")}
                    autoComplete="name"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? t("login.processing") : (isRegister ? t("common.register") : t("common.login"))}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {isRegister ? (
                <>
                  {t("login.haveAccount")}{" "}
                  <button
                    type="button"
                    onClick={() => { setIsRegister(false); setError(""); }}
                    className="text-accent-blue hover:underline font-medium"
                  >
                    {t("login.loginNow")}
                  </button>
                </>
              ) : (
                !registrationDisabled && (
                  <>
                    {t("login.noAccount")}{" "}
                    <button
                      type="button"
                      onClick={() => { setIsRegister(true); setError(""); }}
                      className="text-accent-blue hover:underline font-medium"
                    >
                      {t("login.registerNow")}
                    </button>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
