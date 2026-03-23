import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Notification = {
  id: number;
  type: string;
  title: string;
  message: string | null;
  priority: string;
  isRead: number;
  createdAt: Date | string;
};

export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // 轮询通知：3 分钟 = 180000ms
  const { data, isLoading, refetch } = trpc.user.getMyNotifications.useQuery(
    { limit: 10, offset: 0 },
    {
      refetchInterval: 180000,
      refetchIntervalInBackground: false,
    }
  );

  // 标记已读 mutation
  const markReadMutation = trpc.user.markNotificationRead.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => toast.error(err.message),
  });

  // 全部标记已读 mutation
  const markAllReadMutation = trpc.user.markAllNotificationsRead.useMutation({
    onSuccess: () => {
      toast.success(t("notifications.markAllSuccess"));
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const unreadCount = data?.unread ?? 0;
  const notifications = data?.notifications ?? [];

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      announcement: "📢",
      warning: "⚠️",
      info: "ℹ️",
      system: "⚙️",
      link_invalid: "🔗",
      link_expired: "⏰",
    };
    return icons[type] || "🔔";
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      high: "border-l-red-500",
      normal: "border-l-blue-500",
      low: "border-l-gray-300",
    };
    return colors[priority] || colors.normal;
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t("notifications.timeMinutes", { count: 0 });
    if (minutes < 60) return t("notifications.timeMinutes", { count: minutes });
    if (hours < 24) return t("notifications.timeHours", { count: hours });
    return t("notifications.timeDays", { count: days });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="font-semibold text-sm">{t("notifications.title")}</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">
                {t("common.loading")}
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">{t("notifications.empty")}</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n: Notification) => (
                <div
                  key={n.id}
                  className={cn(
                    "p-3 border-l-2 hover:bg-muted/50 transition-colors cursor-pointer",
                    getPriorityColor(n.priority),
                    n.isRead ? "bg-background" : "bg-muted/30"
                  )}
                  onClick={() => {
                    if (!n.isRead) {
                      markReadMutation.mutate({ notificationId: n.id });
                    }
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0 mt-0.5">
                      {getTypeIcon(n.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm truncate",
                            !n.isRead && "font-semibold"
                          )}
                        >
                          {n.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatTime(n.createdAt)}
                        </span>
                      </div>
                      {n.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                setOpen(false);
              }}
            >
              {t("notifications.viewAll")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
