import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Globe, ShieldCheck, Link2, Terminal, Bot, Settings, Key, ChevronRight, User } from "lucide-react";
import * as React from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: any) {
  const [sidebarWidth, setSidebarWidth] = React.useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const parsed = saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
    return parsed < DEFAULT_WIDTH ? DEFAULT_WIDTH : parsed;
  });
  const { loading, user } = useAuth();
  const { t } = useTranslation();

  React.useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              {t("auth.signInToContinue")}
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {t("auth.authRequired")}
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            {t("auth.signIn")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
          "--primary": "#1d4ed8",
          "--ring": "#1d4ed8",
        } as any
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: any;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: any) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { t } = useTranslation();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = React.useState(false);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const mainItems = [
    { icon: LayoutDashboard, label: t("common.analytics"), path: "/dashboard" },
    { icon: Link2, label: t("common.links"), path: "/links" },
    { icon: Globe, label: t("dashboard.customDomain"), path: "/domains" },
    { icon: Terminal, label: "OpenAPI", path: "/api-keys" },
  ];

  const manageItems = [
    { icon: Bot, label: "AI 设置", path: "/ai-settings" },
    { icon: Key, label: t("license.title"), path: "/license" },
  ];

  // Add Admin menu if applicable
  if (user?.role === "admin") {
    manageItems.push({
      icon: ShieldCheck,
      label: t("admin.dashboardTitle"),
      path: "/admin"
    });
  }

  const allItems = [...mainItems, ...manageItems];
  const activeMenuItem = allItems.find(item => item.path === location);

  React.useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center overflow-hidden">
            <div className="flex items-center justify-between px-2 transition-all w-full">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={toggleSidebar}
                  className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  aria-label="Toggle navigation"
                >
                  <PanelLeft className="h-4 w-4 text-muted-foreground" />
                </button>
                {!isCollapsed ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Link2 className="h-4 w-4 text-accent-blue shrink-0" />
                    <span className="font-semibold tracking-tight truncate text-sm">
                      {t("common.brandName")}
                    </span>
                  </div>
                ) : null}
              </div>
              {!isCollapsed && (
                <div className="shrink-0 scale-90 origin-right">
                  <LanguageSwitcher />
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-2 pt-2">
            <SidebarMenu className="px-2">
              {mainItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path} className="mb-0.5">
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-11 transition-all rounded-xl px-3 group flex items-center justify-between`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon
                          className={`h-[18px] w-[18px] ${isActive ? "text-accent-blue" : "text-muted-foreground/70"}`}
                        />
                        <span className={`font-medium ${isActive ? "text-accent-blue" : "text-foreground/80"}`}>{item.label}</span>
                      </div>
                      {!isCollapsed && (
                        <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${isActive ? "text-accent-blue opacity-100" : "text-muted-foreground/30 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"}`} />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            <div className="mt-4 mb-2 px-5 group-data-[collapsible=icon]:hidden">
              <div className="h-px bg-border/50 w-full" />
            </div>

            <SidebarMenu className="px-2">
              {!isCollapsed && (
                <div className="px-3 mb-2 text-[11px] font-bold text-muted-foreground/50 tracking-wider uppercase group-data-[collapsible=icon]:hidden">
                  {t("common.management")}
                </div>
              )}
              {manageItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path} className="mb-0.5">
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-11 transition-all rounded-xl px-3 group flex items-center justify-between`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon
                          className={`h-[18px] w-[18px] ${isActive ? "text-accent-blue" : "text-muted-foreground/70"}`}
                        />
                        <span className={`font-medium ${isActive ? "text-accent-blue" : "text-foreground/80"}`}>{item.label}</span>
                      </div>
                      {!isCollapsed && (
                        <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${isActive ? "text-accent-blue opacity-100" : "text-muted-foreground/30 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"}`} />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <div className="flex flex-col gap-2">
              {/* 通知铃铛 */}
              <div className="flex items-center justify-end group-data-[collapsible=icon]:hidden">
                <NotificationBell />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="h-9 w-9 border shrink-0">
                      <AvatarFallback className="text-xs font-medium bg-accent-blue/10 text-accent-blue">
                        {user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-1.5 opacity-70">
                        {user?.role === "admin" ? t("auth.saasAdmin") : t("auth.user")}
                      </p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => setLocation("/profile")}
                    className="cursor-pointer"
                  >
                    <User className="mr-2 h-4 w-4" />
                    <span>{t("profile.title")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t("common.signOut")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-sm font-semibold text-foreground">
                    {activeMenuItem?.label ?? t("common.brandName")}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <LanguageSwitcher />
            </div>
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
