import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Bell,
  Send,
  Trash2,
  Check,
  AlertTriangle,
  Info,
  Megaphone,
  Users,
  Eye,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type NotificationType = {
  id: number;
  userId: number | null;
  senderId: number | null;
  linkId: number | null;
  type: string;
  title: string;
  message: string | null;
  priority: string;
  isRead: number;
  createdAt: Date;
};

type SendNotificationInput = {
  title: string;
  message: string;
  type: "announcement" | "warning" | "info" | "system";
  priority: "low" | "normal" | "high";
  targetUserIds?: number[];
};

export default function NotificationManagement() {
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Send notification dialog state
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [sendForm, setSendForm] = useState<SendNotificationInput>({
    title: "",
    message: "",
    type: "announcement",
    priority: "normal",
  });

  // Queries
  const {
    data: notifications,
    isLoading,
    refetch,
  } = trpc.user.listNotifications.useQuery({
    limit: itemsPerPage,
    offset: (currentPage - 1) * itemsPerPage,
    type: typeFilter === "all" ? undefined : typeFilter,
  });

  const { data: stats } = trpc.user.getNotificationStats.useQuery();
  const { data: users } = trpc.user.list.useQuery({ limit: 100 });

  // Mutations
  const sendMutation = trpc.user.sendNotification.useMutation({
    onSuccess: result => {
      const countText =
        result.count === -1
          ? t("admin.notify.allUsers")
          : t("admin.notify.usersCount", { count: result.count });
      toast.success(`${t("admin.notify.sendSuccess")} ${countText}`);
      setIsSendDialogOpen(false);
      setSendForm({
        title: "",
        message: "",
        type: "announcement",
        priority: "normal",
      });
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.user.deleteNotification.useMutation({
    onSuccess: () => {
      toast.success(t("admin.notify.deleteSuccess"));
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter]);

  const handleSendNotification = async () => {
    if (!sendForm.title || !sendForm.message) {
      toast.error(t("admin.notify.requiredFields"));
      return;
    }
    await sendMutation.mutateAsync(sendForm);
  };

  const handleDelete = async (notificationId: number) => {
    if (window.confirm(t("admin.notify.deleteConfirm"))) {
      await deleteMutation.mutateAsync({ notificationId });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "announcement":
        return <Megaphone className="w-4 h-4 text-blue-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "info":
        return <Info className="w-4 h-4 text-green-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      announcement:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      warning:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      info: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      system:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      link_invalid:
        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      link_expired:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    };
    return (
      <Badge className={`${colors[type] || colors.system} capitalize`}>
        {t(`admin.notify.type${type.charAt(0).toUpperCase() + type.slice(1)}`)}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      high: "bg-red-500 text-white",
      normal: "bg-gray-500 text-white",
      low: "bg-gray-300 text-gray-800",
    };
    return (
      <Badge className={`${colors[priority] || colors.normal} text-xs`}>
        {t(`admin.notify.priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`)}
      </Badge>
    );
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("admin.notify.title")}</CardTitle>
              <CardDescription>{t("admin.notify.subtitle")}</CardDescription>
            </div>
            <Button onClick={() => setIsSendDialogOpen(true)} className="gap-2">
              <Send className="w-4 h-4" />
              {t("admin.notify.sendNotification")}
            </Button>
          </div>

          {/* Stats & Filter */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t">
            {stats && (
              <>
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t("admin.notify.total")}:
                  </span>
                  <span className="font-semibold">{stats.total}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t("admin.notify.unread")}:
                  </span>
                  <span className="font-semibold text-blue-500">
                    {stats.unread}
                  </span>
                </div>
              </>
            )}
            <div className="ml-auto">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t("admin.notify.filterByType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("admin.notify.allTypes")}
                  </SelectItem>
                  <SelectItem value="announcement">
                    {t("admin.notify.typeAnnouncement")}
                  </SelectItem>
                  <SelectItem value="warning">
                    {t("admin.notify.typeWarning")}
                  </SelectItem>
                  <SelectItem value="info">
                    {t("admin.notify.typeInfo")}
                  </SelectItem>
                  <SelectItem value="system">
                    {t("admin.notify.typeSystem")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">{t("common.loading")}</div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("admin.notify.noNotifications")}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.notify.type")}</TableHead>
                    <TableHead>{t("admin.notify.title")}</TableHead>
                    <TableHead>{t("admin.notify.priority")}</TableHead>
                    <TableHead>{t("admin.notify.recipients")}</TableHead>
                    <TableHead>{t("admin.notify.status")}</TableHead>
                    <TableHead>{t("admin.notify.createdAt")}</TableHead>
                    <TableHead className="text-right">
                      {t("admin.notify.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((notification: NotificationType) => (
                    <TableRow key={notification.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(notification.type)}
                          {getTypeBadge(notification.type)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <div className="font-medium truncate">
                            {notification.title}
                          </div>
                          {notification.message && (
                            <div className="text-xs text-muted-foreground truncate">
                              {notification.message}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getPriorityBadge(notification.priority)}
                      </TableCell>
                      <TableCell>
                        {notification.userId ? (
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span className="text-xs">
                              {t("admin.notify.userWithId", { id: notification.userId })}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {t("admin.notify.broadcast")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {notification.isRead ? (
                          <Badge variant="secondary" className="gap-1">
                            <Check className="w-3 h-3" />
                            {t("admin.notify.read")}
                          </Badge>
                        ) : (
                          <Badge variant="default" className="gap-1">
                            {t("admin.notify.unread")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(notification.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(notification.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-2 py-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  {t("common.pagination.showing", {
                    from: (currentPage - 1) * itemsPerPage + 1,
                    to: Math.min(
                      currentPage * itemsPerPage,
                      (notifications as NotificationType[]).length
                    ),
                    total: (notifications as NotificationType[]).length,
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Send Notification Dialog */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.notify.sendNotification")}</DialogTitle>
            <DialogDescription>
              {t("admin.notify.sendDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="notify-title">{t("admin.notify.title")} *</Label>
              <Input
                id="notify-title"
                placeholder={t("admin.notify.titlePlaceholder")}
                value={sendForm.title}
                onChange={e =>
                  setSendForm({ ...sendForm, title: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="notify-message">
                {t("admin.notify.message")} *
              </Label>
              <Textarea
                id="notify-message"
                placeholder={t("admin.notify.messagePlaceholder")}
                value={sendForm.message}
                onChange={e =>
                  setSendForm({ ...sendForm, message: e.target.value })
                }
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="notify-type">{t("admin.notify.type")}</Label>
                <Select
                  value={sendForm.type}
                  onValueChange={(value: any) =>
                    setSendForm({ ...sendForm, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">
                      {t("admin.notify.typeAnnouncement")}
                    </SelectItem>
                    <SelectItem value="warning">
                      {t("admin.notify.typeWarning")}
                    </SelectItem>
                    <SelectItem value="info">
                      {t("admin.notify.typeInfo")}
                    </SelectItem>
                    <SelectItem value="system">
                      {t("admin.notify.typeSystem")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notify-priority">
                  {t("admin.notify.priority")}
                </Label>
                <Select
                  value={sendForm.priority}
                  onValueChange={(value: any) =>
                    setSendForm({ ...sendForm, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      {t("admin.notify.priorityLow")}
                    </SelectItem>
                    <SelectItem value="normal">
                      {t("admin.notify.priorityNormal")}
                    </SelectItem>
                    <SelectItem value="high">
                      {t("admin.notify.priorityHigh")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">
                {t("admin.notify.broadcastHint")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSendDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSendNotification}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending
                ? t("admin.notify.sending")
                : t("admin.notify.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
