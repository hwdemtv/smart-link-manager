import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// 保持首页同步加载，确保首屏速度
import Home from "./pages/Home";

// 非核心页面采用懒加载
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Domains = lazy(() => import("./pages/Domains"));
const ApiKeys = lazy(() => import("./pages/ApiKeys"));
const AiSettings = lazy(() => import("./pages/AiSettings"));
const QRPage = lazy(() => import("./pages/QRPage"));
const VerifyPage = lazy(() => import("./pages/VerifyPage"));
const LinkErrorPage = lazy(() => import("./pages/LinkErrorPage"));
const LinkDetail = lazy(() => import("./pages/LinkDetail"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const LicenseSettings = lazy(() => import("./pages/LicenseSettings"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const ComponentsShowcase = lazy(() => import("./pages/ComponentShowcase"));
const NotFound = lazy(() => import("./pages/NotFound"));

import DashboardLayout from "./components/DashboardLayout";

function Router() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/showcase" component={ComponentsShowcase} />

        {/* 应用内路由，统一使用 DashboardLayout */}
        <Route path="/dashboard">
          <DashboardLayout>
            <Analytics />
          </DashboardLayout>
        </Route>
        <Route path="/links">
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </Route>
        <Route path="/links/:id">
          <DashboardLayout>
            <LinkDetail />
          </DashboardLayout>
        </Route>
        <Route path="/domains">
          <DashboardLayout>
            <Domains />
          </DashboardLayout>
        </Route>
        <Route path="/api-keys">
          <DashboardLayout>
            <ApiKeys />
          </DashboardLayout>
        </Route>
        <Route path="/ai-settings">
          <DashboardLayout>
            <AiSettings />
          </DashboardLayout>
        </Route>
        <Route path="/license">
          <DashboardLayout>
            <LicenseSettings />
          </DashboardLayout>
        </Route>
        <Route path="/verify/:token" component={VerifyPage} />
        <Route path="/error" component={LinkErrorPage} />
        <Route path="/qr/:shortCode">
          <DashboardLayout>
            <QRPage />
          </DashboardLayout>
        </Route>
        <Route path="/admin">
          <DashboardLayout>
            <AdminDashboard />
          </DashboardLayout>
        </Route>
        <Route path="/profile">
          <DashboardLayout>
            <ProfileSettings />
          </DashboardLayout>
        </Route>

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const ErrorBoundaryAny = ErrorBoundary as any;
  return (
    <ErrorBoundaryAny>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundaryAny>
  );
}

export default App;
