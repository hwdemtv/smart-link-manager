import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Link2, Zap, BarChart3, Shield } from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to dashboard if authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  // Handle sign in - redirect to dashboard (dev mode) or OAuth
  const handleSignIn = () => {
    // In development mode, just go to dashboard (auto-login enabled)
    setLocation("/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-border border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
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
            <span className="font-bold text-lg">Smart Link Manager</span>
          </div>
          {!isAuthenticated && (
            <Button onClick={handleSignIn}>Sign In</Button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Smart Link Management
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-powder-blue via-accent-blue to-accent-pink mt-2">
              Made Simple
            </span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Create short links for your cloud storage files. Get device-aware redirects, automatic validity checking, and detailed analytics—all in one place.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" className="w-full sm:w-auto" onClick={handleSignIn}>
              Get Started Free
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => setLocation("/dashboard")}>
              View Dashboard
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-2">Powerful Features</h2>
          <p className="text-muted-foreground">Everything you need to manage and share your links</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="p-6 rounded-lg border border-border bg-card hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-powder-blue to-accent-blue flex items-center justify-center mb-4">
              <Link2 className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="font-semibold mb-2">Smart Redirects</h3>
            <p className="text-sm text-muted-foreground">
              Mobile devices get direct access. Desktop users see a QR code for easy scanning.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-6 rounded-lg border border-border bg-card hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blush-pink to-accent-pink flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="font-semibold mb-2">Link Validity Check</h3>
            <p className="text-sm text-muted-foreground">
              Automatic detection for Baidu, Aliyun, and Quark cloud storage. Get alerts when links expire.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-6 rounded-lg border border-border bg-card hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-blue to-powder-blue flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="font-semibold mb-2">Detailed Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Track clicks, device types, and access patterns with comprehensive statistics.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-6 rounded-lg border border-border bg-card hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-powder-blue to-blush-pink flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="font-semibold mb-2">Quick Setup</h3>
            <p className="text-sm text-muted-foreground">
              Create custom short codes in seconds. No technical knowledge required.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="p-6 rounded-lg border border-border bg-card hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-pink to-blush-pink flex items-center justify-center mb-4">
              <Link2 className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="font-semibold mb-2">Batch Operations</h3>
            <p className="text-sm text-muted-foreground">
              Import multiple links via CSV and export your data anytime.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="p-6 rounded-lg border border-border bg-card hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-blue to-accent-pink flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="font-semibold mb-2">Notifications</h3>
            <p className="text-sm text-muted-foreground">
              Instant alerts when your links become invalid or expire.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-20">
        <div className="rounded-lg border border-border bg-card p-8 md:p-12 text-center space-y-6">
          <h2 className="text-3xl font-bold">Ready to get started?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Join thousands of users who are simplifying their link management with Smart Link Manager.
          </p>
          <Button size="lg" onClick={handleSignIn}>Sign Up Now</Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 mt-20">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2026 Smart Link Manager. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
