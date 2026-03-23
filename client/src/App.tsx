import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import AdminDashboard from "@/pages/AdminDashboard";
import LicenseSettings from "@/pages/LicenseSettings";
import ProfileSettings from "@/pages/ProfileSettings";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Domains from "./pages/Domains";
import ApiKeys from "./pages/ApiKeys";
import AiSettings from "./pages/AiSettings";
import QRPage from "./pages/QRPage";
import VerifyPage from "./pages/VerifyPage";
import LinkErrorPage from "./pages/LinkErrorPage";
import LinkDetail from "./pages/LinkDetail";
import DashboardLayout from "./components/DashboardLayout";
import ComponentsShowcase from "./pages/ComponentShowcase";

function Router() {
  return (
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
  );
}

function App() {
  const ErrorBoundaryAny = ErrorBoundary as any;
  return (
    <ErrorBoundaryAny>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundaryAny>
  );
}

export default App;
