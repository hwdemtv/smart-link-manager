import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Shield, Plus, Trash2, Loader2, Ban } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";

export default function IpBlacklistPanel() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "zh" ? zhCN : enUS;
  const utils = trpc.useUtils();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [ipPattern, setIpPattern] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  // 获取黑名单列表
  const { data: blacklist, isLoading } = trpc.blacklist.list.useQuery();

  // 添加黑名单
  const addMutation = trpc.blacklist.add.useMutation({
    onSuccess: () => {
      toast.success(t("blacklist.addSuccess") || "已添加到黑名单");
      utils.blacklist.list.invalidate();
      setAddDialogOpen(false);
      setIpPattern("");
      setReason("");
      setExpiresAt("");
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  // 移除黑名单
  const removeMutation = trpc.blacklist.remove.useMutation({
    onSuccess: () => {
      toast.success(t("blacklist.removeSuccess") || "已从黑名单移除");
      utils.blacklist.list.invalidate();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const handleAdd = () => {
    if (!ipPattern.trim()) {
      toast.error(t("blacklist.ipRequired") || "请输入 IP 地址");
      return;
    }

    addMutation.mutate({
      ipPattern: ipPattern.trim(),
      reason: reason.trim() || undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
  };

  const handleRemove = (id: number) => {
    if (confirm(t("blacklist.removeConfirm") || "确定要移除此 IP 吗？")) {
      removeMutation.mutate({ id });
    }
  };

  // 判断是否过期
  const isExpired = (expiresAt: Date | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle>{t("blacklist.title") || "IP 黑名单"}</CardTitle>
            </div>
            <Button onClick={() => setAddDialogOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              {t("blacklist.add") || "添加 IP"}
            </Button>
          </div>
          <CardDescription>
            {t("blacklist.description") ||
              "被封禁的 IP 将无法访问任何短链接。支持 CIDR 格式（如 192.168.1.0/24）进行网段封禁。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !blacklist || blacklist.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ban className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>{t("blacklist.empty") || "黑名单为空"}</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t("blacklist.ipPattern") || "IP/网段"}
                    </TableHead>
                    <TableHead>{t("blacklist.reason") || "原因"}</TableHead>
                    <TableHead>
                      {t("blacklist.expiresAt") || "过期时间"}
                    </TableHead>
                    <TableHead>
                      {t("blacklist.createdAt") || "添加时间"}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("common.actions") || "操作"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blacklist.map((item: any) => {
                    const expired = isExpired(item.expiresAt);
                    return (
                      <TableRow
                        key={item.id}
                        className={expired ? "opacity-50" : ""}
                      >
                        <TableCell className="font-mono">
                          {item.ipPattern}
                        </TableCell>
                        <TableCell>{item.reason || "-"}</TableCell>
                        <TableCell>
                          {item.expiresAt ? (
                            <span
                              className={
                                expired ? "text-green-600" : "text-orange-600"
                              }
                            >
                              {expired
                                ? t("blacklist.expired") || "已过期"
                                : formatDistanceToNow(
                                    new Date(item.expiresAt),
                                    {
                                      addSuffix: true,
                                      locale,
                                    }
                                  )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {t("blacklist.permanent") || "永久"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(item.createdAt), {
                            addSuffix: true,
                            locale,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(item.id)}
                            disabled={removeMutation.isPending}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 添加黑名单对话框 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("blacklist.addTitle") || "添加 IP 到黑名单"}
            </DialogTitle>
            <DialogDescription>
              {t("blacklist.addDescription") ||
                "支持单个 IP（如 192.168.1.1）或 CIDR 网段（如 192.168.1.0/24）"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ip">
                {t("blacklist.ipPattern") || "IP/网段"}
              </Label>
              <Input
                id="ip"
                value={ipPattern}
                onChange={e => setIpPattern(e.target.value)}
                placeholder="例如：192.168.1.1 或 192.168.1.0/24"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">
                {t("blacklist.reason") || "原因"} (可选)
              </Label>
              <Input
                id="reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={t("blacklist.reasonPlaceholder") || "封禁原因"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires">
                {t("blacklist.expiresAt") || "过期时间"} (可选)
              </Label>
              <Input
                id="expires"
                type="datetime-local"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("blacklist.expiresHint") || "留空表示永久封禁"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={addMutation.isPending}
            >
              {t("common.cancel") || "取消"}
            </Button>
            <Button onClick={handleAdd} disabled={addMutation.isPending}>
              {addMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("blacklist.add") || "添加"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
