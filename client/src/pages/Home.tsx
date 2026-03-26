import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";
import { useEffect, useState, useRef } from "react";
import {
  Link2,
  BarChart3,
  GitBranch,
  QrCode,
  Code,
  Smartphone,
  Shield,
  Cloud,
  MapPin,
  MonitorSmartphone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Zap,
  Check,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { cn } from "@/lib/utils";

// 数字滚动动画组件
function StatCounter({ end, suffix = "", duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const startTime = Date.now();
          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const easeOut = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(easeOut * end));
            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [end, duration]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}{suffix}
    </span>
  );
}

// FAQ 项组件
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        className="w-full py-4 flex items-center justify-between text-left hover:text-accent-blue transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium pr-4">{question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
        )}
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          isOpen ? "max-h-96 pb-4" : "max-h-0"
        )}
      >
        <p className="text-muted-foreground text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  // 交互演示状态
  const [demoUrl, setDemoUrl] = useState("");
  const [demoResult, setDemoResult] = useState("");
  const [isShortening, setIsShortening] = useState(false);

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

  // 模拟缩短链接
  const handleShorten = () => {
    if (!demoUrl.trim()) return;
    setIsShortening(true);
    // 模拟生成短码
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const shortCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setTimeout(() => {
      setDemoResult(`s.link/${shortCode}`);
      setIsShortening(false);
    }, 800);
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

  // 应用场景数据
  const useCases = [
    { icon: Cloud, titleKey: "home.useCases.cloudDrive.title", descKey: "home.useCases.cloudDrive.desc" },
    { icon: MapPin, titleKey: "home.useCases.offlineMarketing.title", descKey: "home.useCases.offlineMarketing.desc" },
    { icon: MonitorSmartphone, titleKey: "home.useCases.crossPlatform.title", descKey: "home.useCases.crossPlatform.desc" },
    { icon: MessageSquare, titleKey: "home.useCases.socialMarketing.title", descKey: "home.useCases.socialMarketing.desc" },
  ];

  // 功能特性数据
  const features = [
    { icon: BarChart3, titleKey: "home.features.tracking", descKey: "home.features.trackingDesc", gradient: "from-[#00BFA5] to-[#00C2FF]" },
    { icon: GitBranch, titleKey: "home.features.abTest", descKey: "home.features.abTestDesc", gradient: "from-[#8E44AD] to-[#E8C361]" },
    { icon: QrCode, titleKey: "home.features.qrCode", descKey: "home.features.qrCodeDesc", gradient: "from-[#1DD1A1] to-[#00C2FF]" },
    { icon: Code, titleKey: "home.features.developer", descKey: "home.features.developerDesc", gradient: "from-[#F39C12] to-[#E8C361]" },
    { icon: Smartphone, titleKey: "home.features.mobile", descKey: "home.features.mobileDesc", gradient: "from-[#FF6B6B] to-[#EF5350]" },
    { icon: Shield, titleKey: "home.features.security", descKey: "home.features.securityDesc", gradient: "from-[#3498DB] to-[#00BFA5]" },
  ];

  // FAQ 数据
  const faqs = [
    { qKey: "home.faq.q1", aKey: "home.faq.a1" },
    { qKey: "home.faq.q2", aKey: "home.faq.a2" },
    { qKey: "home.faq.q3", aKey: "home.faq.a3" },
    { qKey: "home.faq.q4", aKey: "home.faq.a4" },
    { qKey: "home.faq.q5", aKey: "home.faq.a5" },
    { qKey: "home.faq.q6", aKey: "home.faq.a6" },
    { qKey: "home.faq.q7", aKey: "home.faq.a7" },
    { qKey: "home.faq.q8", aKey: "home.faq.a8" },
    { qKey: "home.faq.q9", aKey: "home.faq.a9" },
    { qKey: "home.faq.q10", aKey: "home.faq.a10" },
  ];

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Link2 className="w-6 h-6 text-primary" />
            </div>
            <span className="font-bold text-xl tracking-tight">{t("common.brandName")}</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            {!isAuthenticated && (
              <Button onClick={handleSignIn} className="shadow-lg shadow-primary/20">{t("common.login")}</Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container py-20 md:py-32 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/10 blur-[100px] rounded-full -z-10" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-accent-pink/5 blur-[100px] rounded-full -z-10" />

        <div className="max-w-4xl mx-auto text-center space-y-8 relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-2 border border-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Zap className="w-4 h-4 fill-primary" />
            2ms 极速跳转引擎已就绪
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight text-balance animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            {t("home.title")}
          </h1>

          <p className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            {t("home.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <Button
              size="lg"
              className="w-full sm:w-auto text-lg px-10 h-14 rounded-xl shadow-xl shadow-primary/25 hover:scale-105 transition-all"
              onClick={handleSignIn}
            >
              {t("home.getStarted")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto text-lg px-10 h-14 rounded-xl backdrop-blur-sm border-border hover:bg-muted/50 transition-all"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              {t("home.learnMore")}
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border/50 bg-card/30 backdrop-blur-sm relative py-12">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div className="space-y-3 p-4 rounded-2xl hover:bg-white/5 transition-colors">
              <div className="text-4xl md:text-5xl font-black text-primary font-mono tracking-tighter">
                <StatCounter end={1000000} suffix="+" />
              </div>
              <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">{t("home.statsBar.linksCreated")}</p>
            </div>
            <div className="space-y-3 p-4 rounded-2xl hover:bg-white/5 transition-colors">
              <div className="text-4xl md:text-5xl font-black text-accent-pink font-mono tracking-tighter">
                <StatCounter end={10000} suffix="+" />
              </div>
              <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">{t("home.statsBar.enterprisesServed")}</p>
            </div>
            <div className="space-y-3 p-4 rounded-2xl hover:bg-white/5 transition-colors">
              <div className="text-4xl md:text-5xl font-black text-primary font-mono tracking-tighter">
                <StatCounter end={99.9} suffix="%" />
              </div>
              <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">{t("home.statsBar.uptime")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Try It Now Section */}
      <section className="container py-24 md:py-32 relative">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">{t("home.tryNow")}</h2>
            <p className="text-muted-foreground text-lg">输入长链接，见证秒级转换</p>
          </div>
          <div className="bg-card/50 backdrop-blur-md border border-border/60 rounded-3xl p-8 shadow-2xl relative">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/10 blur-2xl rounded-full -z-10" />

            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="url"
                placeholder={t("home.enterUrl")}
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                className="flex-1 px-6 py-4 rounded-2xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-lg shadow-inner"
              />
              <Button
                onClick={handleShorten}
                disabled={isShortening || !demoUrl.trim()}
                className="sm:w-32 h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20"
              >
                {isShortening ? (
                  <span className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  t("home.shortenBtn")
                )}
              </Button>
            </div>
            {demoResult && (
              <div className="mt-8 bg-primary/5 border border-primary/20 rounded-2xl p-6 animate-in zoom-in-95 duration-300">
                <p className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">{t("home.tryResult")}</p>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <code className="text-2xl font-mono font-bold text-foreground break-all">{demoResult}</code>
                  <Button size="lg" variant="default" onClick={handleSignIn} className="w-full sm:w-auto rounded-xl">
                    <Check className="w-5 h-5 mr-2" />
                    {t("home.saveLink")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-24 md:py-32 bg-secondary/30 relative overflow-hidden">
        <div className="container relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter">{t("home.useCases.title")}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("home.useCases.subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon;
              return (
                <div
                  key={index}
                  className="p-8 rounded-[2rem] border border-border bg-card hover:bg-card/80 hover:shadow-2xl hover:border-primary/30 transition-all group relative overflow-hidden"
                >
                  <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-primary/5 rounded-full group-hover:bg-primary/10 transition-colors" />
                  <div className="flex flex-col sm:flex-row items-start gap-6 relative">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent-pink flex items-center justify-center flex-shrink-0 group-hover:rotate-6 transition-transform shadow-lg shadow-primary/10">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-2xl mb-3 group-hover:text-primary transition-colors">{t(useCase.titleKey)}</h3>
                      <p className="text-muted-foreground leading-relaxed text-lg">{t(useCase.descKey)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container py-16 md:py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-2">{t("home.featuresTitle")}</h2>
          <p className="text-muted-foreground">{t("home.featuresSubtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="p-6 rounded-xl border border-border bg-card hover:shadow-lg transition-shadow group"
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center mb-4 group-hover:scale-110 transition-transform",
                    feature.gradient
                  )}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{t(feature.titleKey)}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{t(feature.descKey)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 md:py-32 bg-secondary/30 relative overflow-hidden">
        <div className="container relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter">{t("home.pricing.title")}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("home.pricing.subtitle")}</p>
            <p className="text-sm text-muted-foreground mt-3 flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              {t("home.pricing.quotaNote")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free */}
            <div className="p-8 rounded-[2rem] border border-border bg-card hover:border-primary/20 transition-all relative">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-1">{t("home.pricing.free.name")}</h3>
                <p className="text-muted-foreground">{t("home.pricing.free.desc")}</p>
              </div>
              <div className="mb-8">
                <span className="text-5xl font-black">{t("home.pricing.free.price")}</span>
                <span className="text-muted-foreground">{t("home.pricing.free.period")}</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span>{t("home.pricing.free.links")}</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span>{t("home.pricing.free.domains")}</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span>{t("home.pricing.free.apiKeys")}</span></li>
                <li className="flex items-center gap-3 text-muted-foreground"><span className="w-5 h-5" />{t("home.pricing.free.abTest")}</li>
                <li className="flex items-center gap-3 text-muted-foreground text-sm">{t("home.pricing.free.support")}</li>
              </ul>
              <Button variant="outline" className="w-full rounded-xl h-12" onClick={handleSignIn}>
                {t("home.pricing.free.cta")}
              </Button>
            </div>

            {/* Pro - Highlighted */}
            <div className="p-8 rounded-[2rem] border-2 border-primary bg-card relative shadow-2xl shadow-primary/10 scale-105 z-10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-bold rounded-full">
                {t("home.pricing.pro.badge")}
              </div>
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-1">{t("home.pricing.pro.name")}</h3>
                <p className="text-muted-foreground">{t("home.pricing.pro.desc")}</p>
              </div>
              <div className="mb-8">
                <span className="text-5xl font-black">{t("home.pricing.pro.price")}</span>
                <span className="text-muted-foreground">{t("home.pricing.pro.period")}</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span>{t("home.pricing.pro.links")}</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span>{t("home.pricing.pro.domains")}</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span>{t("home.pricing.pro.apiKeys")}</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="font-semibold text-primary">{t("home.pricing.pro.abTest")}</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span>{t("home.pricing.pro.support")}</span></li>
              </ul>
              <Button
                className="w-full rounded-xl h-12 shadow-lg shadow-primary/20"
                onClick={() => window.open("https://s.hwdemtv.com/s/pro", "_blank")}
              >
                {t("home.pricing.pro.cta")}
              </Button>
            </div>

            {/* Business */}
            <div className="p-8 rounded-[2rem] border border-border bg-card hover:border-primary/20 transition-all relative">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-1">{t("home.pricing.business.name")}</h3>
                <p className="text-muted-foreground">{t("home.pricing.business.desc")}</p>
              </div>
              <div className="mb-8">
                <span className="text-5xl font-black">{t("home.pricing.business.price")}</span>
                <span className="text-muted-foreground">{t("home.pricing.business.period")}</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="font-semibold">{t("home.pricing.business.links")}</span></li>
                <li className="flex items-center gap-3 text-muted-foreground"><span className="w-5 h-5" />{t("home.pricing.business.monthlyLimit")}</li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span>{t("home.pricing.business.domains")}</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span>{t("home.pricing.business.apiKeys")}</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span className="font-semibold text-primary">{t("home.pricing.business.abTest")}</span></li>
                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-primary" /><span>{t("home.pricing.business.support")}</span></li>
              </ul>
              <Link href="/docs/contact">
                <Button variant="outline" className="w-full rounded-xl h-12">
                  {t("home.pricing.business.cta")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container py-16 md:py-20 bg-card/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-2">{t("home.faq.title")}</h2>
            <p className="text-muted-foreground">{t("home.faq.subtitle")}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                question={t(faq.qKey)}
                answer={t(faq.aKey)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-16 md:py-20">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold">准备好开始了吗？</h2>
          <p className="text-muted-foreground">
            免费创建您的第一个短链接，体验专业级链接管理服务。
          </p>
          <Button size="lg" onClick={handleSignIn} className="text-base px-8">
            {t("home.getStarted")}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card relative">
        <div className="container py-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            {/* Product */}
            <div className="space-y-6">
              <h4 className="font-bold text-lg text-foreground tracking-tight underline decoration-primary/30 decoration-2 underline-offset-8 decoration-skip-ink-none">
                {t("home.footer.product")}
              </h4>
              <ul className="space-y-4 text-muted-foreground">
                <li><a href="#features" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />{t("home.footer.productFeatures")}</a></li>
                <li><a href="#pricing" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />{t("home.footer.pricing")}</a></li>
                <li><a href="/docs/changelog" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />{t("home.footer.changelog")}</a></li>
              </ul>
            </div>
            {/* Developer */}
            <div className="space-y-6">
              <h4 className="font-bold text-lg text-foreground tracking-tight underline decoration-primary/30 decoration-2 underline-offset-8 decoration-skip-ink-none">
                {t("home.footer.developer")}
              </h4>
              <ul className="space-y-4 text-muted-foreground">
                <li><a href="/docs/api" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />{t("home.footer.apiDocs")}</a></li>
                <li><a href="https://github.com/hwdemtv/smart-link-manager" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />{t("home.footer.sdk")}</a></li>
                <li><a href="/admin" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />{t("home.footer.monitoring")}</a></li>
              </ul>
            </div>
            {/* Company/Author */}
            <div className="space-y-6">
              <h4 className="font-bold text-lg text-foreground tracking-tight underline decoration-primary/30 decoration-2 underline-offset-8 decoration-skip-ink-none">
                学习中心
              </h4>
              <ul className="space-y-4 text-muted-foreground">
                <li><Link href="/docs/what-is-url-shortener" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />什么是短链接？</Link></li>
                <li><Link href="/docs/how-it-works" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />技术实现原理</Link></li>
                <li><Link href="/docs/best-practices" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />SEO 最佳实践</Link></li>
                <li><Link href="/faq" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />常见问题解答</Link></li>
              </ul>
            </div>
            {/* Legal */}
            <div className="space-y-6">
              <h4 className="font-bold text-lg text-foreground tracking-tight underline decoration-primary/30 decoration-2 underline-offset-8 decoration-skip-ink-none">
                关于我们
              </h4>
              <ul className="space-y-4 text-muted-foreground">
                <li><Link href="/about" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />团队介绍</Link></li>
                <li><a href="https://www.hwdemtv.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />个人主页 ↗</a></li>
                <li><Link href="/terms" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />服务协议</Link></li>
                <li><Link href="/privacy" className="hover:text-primary transition-colors flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" />隐私政策</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground font-medium">
            <p className="flex items-center gap-2">
              &copy; {new Date().getFullYear()} <span className="text-foreground font-bold">{t("common.brandName")}</span>. {t("home.footer.rights")}
            </p>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" /> 全球节点运行正常</span>
              <span>Crafted with ❤️ by <a href="https://www.hwdemtv.com" className="text-foreground hover:text-primary transition-colors font-bold">hwdemtv</a></span>
            </div>
          </div>
        </div>
      </footer>

      {/* JSON-LD for FAQ - SEO优化 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqs.map((faq) => ({
              "@type": "Question",
              "name": t(faq.qKey),
              "acceptedAnswer": {
                "@type": "Answer",
                "text": t(faq.aKey),
              },
            })),
          }),
        }}
      />
      
      {/* Organization JSON-LD - E-E-A-T优化 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Smart Link Manager",
            "alternateName": ["SLM", "智链管理"],
            "url": "https://smartlink.example.com",
            "logo": "https://smartlink.example.com/logo.png",
            "description": "专业的 2ms 极速短链接管理与全球流量数据分析平台。",
            "sameAs": [
              "https://github.com/hwdemtv/smart-link-manager",
              "https://twitter.com/SmartLinkMgr"
            ],
            "contactPoint": {
              "@type": "ContactPoint",
              "contactType": "customer service",
              "email": "support@hwdemtv.com"
            }
          }),
        }}
      />
    </div>
  );
}
