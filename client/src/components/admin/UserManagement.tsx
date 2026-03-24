import { useState, useMemo, useEffect } from "react";
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
import {
  Search,
  X,
  Shield,
  User,
  Key,
  Edit2,
  MoreHorizontal,
  Mail,
  Globe,
  Link2,
  Trash2,
  CheckCircle,
  Ban,
  Download,
  Clock,
  Settings,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ChangeEventT<T = Element> = any;

type UserType = {
  id: number;
  openId: string;
  username: string | null;
  name: string | null;
  email: string | null;
  role: string;
  subscriptionTier: string | null;
  licenseExpiresAt: Date | null;
  lastSignedIn: Date | null;
  createdAt: Date;
  linkCount: number;
  domainCount: number;
  isActive: number;
  lastIpAddress: string | null;
};

export default function UserManagement() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  // 对话框状态
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false); // 授权管理对话框
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    name: "",
    role: "user",
  });
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<string>("");

  // 授权管理表单状态
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    role: "user" as "user" | "admin",
    subscriptionTier: "free" as "free" | "pro" | "business",
    licenseExpiresAt: "",
    isActive: true,
  });

  const { data, isLoading, refetch } = trpc.user.list.useQuery({
    limit: itemsPerPage,
    offset: (currentPage - 1) * itemsPerPage,
    search: searchQuery || undefined,
  });

  const { data: quickStats, isLoading: isStatsLoading } =
    trpc.user.getQuickStats.useQuery();

  const exportCsvMutation = trpc.user.exportUsersCSV.useMutation({
    onSuccess: csvInput => {
      const blob = new Blob([csvInput], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.setAttribute(
        "download",
        `users-export-${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(t("admin.userMgmt.exportSuccess", "导出成功"));
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const batchUpdateMutation = trpc.user.batchUpdate.useMutation({
    onSuccess: () => {
      toast.success(t("admin.userMgmt.batchUpdateSuccess", "批量更新成功"));
      setSelectedUsers([]);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const batchDeleteMutation = trpc.user.batchDelete.useMutation({
    onSuccess: () => {
      toast.success(t("admin.userMgmt.batchDeleteSuccess", "批量删除成功"));
      setSelectedUsers([]);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const roleMutation = trpc.user.update.useMutation({
    onSuccess: () => {
      toast.success(t("admin.userMgmt.roleUpdated"));
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const passwordMutation = trpc.user.resetPassword.useMutation({
    onSuccess: () => {
      toast.success(t("admin.userMgmt.passwordReset"));
      setIsPasswordDialogOpen(false);
      setNewPassword("");
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: () => {
      toast.success(t("admin.userMgmt.deleteSuccess") || "User deleted");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const addUserMutation = trpc.user.create.useMutation({
    onSuccess: () => {
      toast.success(t("admin.userMgmt.addSuccess") || "User added");
      setIsAddUserDialogOpen(false);
      setNewUser({ username: "", password: "", name: "", role: "user" });
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // 授权管理更新
  const authUpdateMutation = trpc.user.update.useMutation({
    onSuccess: () => {
      toast.success(t("admin.userMgmt.authUpdateSuccess", "授权更新成功"));
      setIsAuthDialogOpen(false);
      setSelectedUser(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / itemsPerPage);

  // 搜索变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
    setSelectedUsers([]);
  }, [searchQuery]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(users.map((u: UserType) => u.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectOne = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    }
  };

  const isAllSelected =
    users.length > 0 && selectedUsers.length === users.length;

  const getRoleBadge = (role: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      admin: "destructive",
      tenant_admin: "destructive",
      user: "secondary",
    };
    const icons: Record<string, React.ReactNode> = {
      admin: <Shield className="w-3 h-3" />,
      tenant_admin: <Shield className="w-3 h-3" />,
      user: <User className="w-3 h-3" />,
    };
    const labels: Record<string, string> = {
      admin: t("admin.userMgmt.roleAdmin"),
      tenant_admin: t("admin.userMgmt.roleAdmin"), // Map tenant_admin to Admin
      user: t("admin.userMgmt.roleUser"),
    };
    return (
      <Badge variant={variants[role] || "secondary"} className="gap-1">
        {icons[role] || icons.user}
        {labels[role] || role}
      </Badge>
    );
  };

  const getTierBadge = (tier: string | null) => {
    const tierColors: Record<string, string> = {
      business: "bg-indigo-600 hover:bg-indigo-700 text-white border-0",
      pro: "bg-blue-600 hover:bg-blue-700 text-white border-0",
      free: "bg-slate-500 hover:bg-slate-600 text-white border-0",
    };
    const tierLabels: Record<string, string> = {
      business: "Business",
      pro: "Pro",
      free: "Free",
    };
    return (
      <Badge
        className={`${tierColors[tier || "free"] || tierColors.free} capitalize px-2 py-0.5`}
      >
        {tierLabels[tier || "free"] || tier || "Free"}
      </Badge>
    );
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return;
    await roleMutation.mutateAsync({
      userId: selectedUser.id,
      role: newRole as any,
    });
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    await passwordMutation.mutateAsync({
      userId: selectedUser.id,
      password: newPassword,
    });
  };

  const handleDeleteUser = async (user: UserType) => {
    if (
      window.confirm(
        t("admin.userMgmt.deleteConfirm", { name: user.username || user.name })
      )
    ) {
      await deleteMutation.mutateAsync({ userId: user.id });
    }
  };

  // 打开授权管理对话框
  const openAuthDialog = (user: UserType) => {
    setSelectedUser(user);
    setAuthForm({
      name: user.name || "",
      email: user.email || "",
      role:
        user.role === "tenant_admin"
          ? "admin"
          : (user.role as "user" | "admin"),
      subscriptionTier: (user.subscriptionTier || "free") as
        | "free"
        | "pro"
        | "business",
      licenseExpiresAt: user.licenseExpiresAt
        ? new Date(user.licenseExpiresAt).toISOString().split("T")[0]
        : "",
      isActive: user.isActive === 1,
    });
    setIsAuthDialogOpen(true);
  };

  // 保存授权管理
  const handleAuthSave = async () => {
    if (!selectedUser) return;
    await authUpdateMutation.mutateAsync({
      userId: selectedUser.id,
      name: authForm.name || undefined,
      email: authForm.email || undefined,
      role: authForm.role,
      subscriptionTier: authForm.subscriptionTier,
      licenseExpiresAt: authForm.licenseExpiresAt
        ? new Date(authForm.licenseExpiresAt)
        : null,
      isActive: authForm.isActive ? 1 : 0,
    });
  };

  // 快捷设置过期时间
  const setExpiryQuick = (type: "30d" | "1y" | "permanent") => {
    if (type === "permanent") {
      setAuthForm(prev => ({ ...prev, licenseExpiresAt: "" }));
    } else {
      const date = new Date();
      if (type === "30d") {
        date.setDate(date.getDate() + 30);
      } else {
        date.setFullYear(date.getFullYear() + 1);
      }
      setAuthForm(prev => ({
        ...prev,
        licenseExpiresAt: date.toISOString().split("T")[0],
      }));
    }
  };

  return (
    <>
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="w-4 h-4" />
              今日新注册
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {isStatsLoading ? "--" : quickStats?.todayRegistrations || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" />
              活跃 Pro / Business
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {isStatsLoading ? "--" : quickStats?.activeProUsers || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              30天内即将到期
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {isStatsLoading ? "--" : quickStats?.expiringSoonUsers || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("admin.userMgmt.title")}</CardTitle>
            <CardDescription>{t("admin.userMgmt.subtitle")}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => exportCsvMutation.mutate()}
              disabled={exportCsvMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              {exportCsvMutation.isPending
                ? t("common.loading", "处理中...")
                : "导出 CSV"}
            </Button>
            <Button onClick={() => setIsAddUserDialogOpen(true)}>
              <User className="mr-2 h-4 w-4" />
              {t("admin.userMgmt.addUser")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 搜索框 */}
          {isLoading ? (
            <div className="text-center py-8">{t("common.loading")}</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("admin.userMgmt.noUsers")}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>{t("admin.userMgmt.username")}</TableHead>
                    <TableHead>{t("admin.userMgmt.displayName")}</TableHead>
                    <TableHead>{t("admin.userMgmt.role")}</TableHead>
                    <TableHead>{t("license.title")}</TableHead>
                    <TableHead className="text-center">
                      {t("common.links")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("common.domains")}
                    </TableHead>
                    <TableHead>{t("admin.userMgmt.lastLogin")}</TableHead>
                    <TableHead className="text-right">
                      {t("admin.userMgmt.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((item: UserType) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.includes(item.id)}
                          onCheckedChange={checked =>
                            handleSelectOne(item.id, checked as boolean)
                          }
                          aria-label={`Select user ${item.username}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-blue-600 dark:text-blue-400">
                              {item.username || "-"}
                            </span>
                            {item.isActive === 0 && (
                              <Badge
                                variant="destructive"
                                className="px-1 py-0 h-4 text-[10px]"
                              >
                                已封禁
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {item.email || "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{item.name || "-"}</TableCell>
                      <TableCell>{getRoleBadge(item.role)}</TableCell>
                      <TableCell>
                        {getTierBadge(item.subscriptionTier)}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        <Badge
                          variant="outline"
                          className="font-normal opacity-70"
                        >
                          {item.linkCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        <Badge
                          variant="outline"
                          className="font-normal opacity-70"
                        >
                          {item.domainCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex flex-col">
                          <span>{formatDate(item.lastSignedIn)}</span>
                          {item.lastIpAddress && (
                            <span
                              className="text-[10px] opacity-70 flex items-center gap-1 mt-0.5"
                              title="最近登录 IP"
                            >
                              <Globe className="w-3 h-3" />
                              {item.lastIpAddress}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>
                              {t("admin.userMgmt.actions")}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openAuthDialog(item)}
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              {t("admin.userMgmt.authManage", "授权管理")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(item);
                                setNewPassword("");
                                setIsPasswordDialogOpen(true);
                              }}
                            >
                              <Key className="mr-2 h-4 w-4" />
                              {t("admin.userMgmt.resetPassword")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteUser(item)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 分页控件 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    {t("admin.pagination.showing", {
                      from: (currentPage - 1) * itemsPerPage + 1,
                      to: Math.min(currentPage * itemsPerPage, total),
                      total,
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p: number) => Math.max(1, p - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      ← {t("admin.pagination.prev")}
                    </Button>
                    <div className="flex items-center justify-center text-sm font-medium px-2">
                      {currentPage} / {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p: number) =>
                          Math.min(totalPages, p + 1)
                        )
                      }
                      disabled={currentPage === totalPages}
                    >
                      {t("admin.pagination.next")} →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Floating Batch Action Bar */}
      {selectedUsers.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-popover border border-border shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
          <span className="text-sm font-medium whitespace-nowrap">
            已选择 {selectedUsers.length} 项
          </span>
          <div className="h-4 w-px bg-border"></div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full">
                {t("admin.userMgmt.changeRole", "修改角色")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  batchUpdateMutation.mutate({
                    userIds: selectedUsers,
                    data: { role: "user" },
                  })
                }
              >
                {t("admin.userMgmt.roleUser", "User")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  batchUpdateMutation.mutate({
                    userIds: selectedUsers,
                    data: { role: "admin" },
                  })
                }
              >
                {t("admin.userMgmt.roleAdmin", "Admin")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full">
                套餐设置
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  batchUpdateMutation.mutate({
                    userIds: selectedUsers,
                    data: { subscriptionTier: "free" },
                  })
                }
              >
                Free
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  batchUpdateMutation.mutate({
                    userIds: selectedUsers,
                    data: { subscriptionTier: "pro" },
                  })
                }
              >
                Pro
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  batchUpdateMutation.mutate({
                    userIds: selectedUsers,
                    data: { subscriptionTier: "business" },
                  })
                }
              >
                Business
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full">
                {t("admin.userMgmt.setExpiry", "过期时间")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() + 30);
                  batchUpdateMutation.mutate({
                    userIds: selectedUsers,
                    data: { licenseExpiresAt: date },
                  });
                }}
              >
                <Clock className="mr-2 h-4 w-4" /> +30天
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const date = new Date();
                  date.setFullYear(date.getFullYear() + 1);
                  batchUpdateMutation.mutate({
                    userIds: selectedUsers,
                    data: { licenseExpiresAt: date },
                  });
                }}
              >
                <Clock className="mr-2 h-4 w-4" /> +1年
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  batchUpdateMutation.mutate({
                    userIds: selectedUsers,
                    data: { licenseExpiresAt: null },
                  });
                }}
              >
                <Shield className="mr-2 h-4 w-4" /> 永久 (不过期)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full">
                状态设置
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  batchUpdateMutation.mutate({
                    userIds: selectedUsers,
                    data: { isActive: 1 },
                  })
                }
              >
                <CheckCircle className="mr-2 h-4 w-4" /> 激活
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  batchUpdateMutation.mutate({
                    userIds: selectedUsers,
                    data: { isActive: 0 },
                  })
                }
                className="text-destructive focus:text-destructive"
              >
                <Ban className="mr-2 h-4 w-4" /> 封禁
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="destructive"
            size="sm"
            className="rounded-full whitespace-nowrap"
            onClick={() => {
              if (
                window.confirm(
                  "确定批量删除选中的用户吗？此操作不可逆，将删除其名下所有链接和数据！"
                )
              ) {
                batchDeleteMutation.mutate({ userIds: selectedUsers });
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> {t("common.delete")}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setSelectedUsers([])}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Password Reset Dialog */}
      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      >
        {/* ... existing password reset dialog content ... */}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.userMgmt.resetPassword")}</DialogTitle>
            <DialogDescription>
              {t("admin.userMgmt.resetPasswordDesc", {
                name: selectedUser?.username || selectedUser?.name,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label htmlFor="new-password">
              {t("admin.userMgmt.newPassword")}
            </Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder={t("admin.userMgmt.passwordPlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPasswordDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={passwordMutation.isPending || !newPassword}
            >
              {passwordMutation.isPending
                ? t("admin.userMgmt.resetting")
                : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.userMgmt.changeRole")}</DialogTitle>
            <DialogDescription>
              {t("admin.userMgmt.changeRoleDesc", {
                name: selectedUser?.username || selectedUser?.name,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>{t("admin.userMgmt.newRole")}</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    {t("admin.userMgmt.roleUser")}
                  </SelectItem>
                  <SelectItem value="admin">
                    {t("admin.userMgmt.roleAdmin")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRoleDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={roleMutation.isPending}
            >
              {roleMutation.isPending
                ? t("admin.userMgmt.updating")
                : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Add User Dialog */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.userMgmt.addUser")}</DialogTitle>
            <DialogDescription>
              {t("admin.userMgmt.addUserDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-username">{t("common.username")}</Label>
              <Input
                id="add-username"
                value={newUser.username}
                onChange={e =>
                  setNewUser({ ...newUser, username: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">{t("common.password")}</Label>
              <Input
                id="add-password"
                type="password"
                value={newUser.password}
                onChange={e =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-name">{t("login.displayName")}</Label>
              <Input
                id="add-name"
                value={newUser.name}
                onChange={e => setNewUser({ ...newUser, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.userMgmt.role")}</Label>
              <Select
                value={newUser.role}
                onValueChange={val => setNewUser({ ...newUser, role: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    {t("admin.userMgmt.roleUser")}
                  </SelectItem>
                  <SelectItem value="admin">
                    {t("admin.userMgmt.roleAdmin")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddUserDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => addUserMutation.mutate(newUser as any)}
              disabled={
                addUserMutation.isPending ||
                !newUser.username ||
                !newUser.password
              }
            >
              {addUserMutation.isPending
                ? t("common.processing")
                : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Authorization Management Dialog */}
      <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {t("admin.userMgmt.authManage", "授权管理")}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.username || selectedUser?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 基本信息 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                {t("admin.userMgmt.basicInfo", "基本信息")}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="auth-name">
                    {t("admin.userMgmt.displayName")}
                  </Label>
                  <Input
                    id="auth-name"
                    value={authForm.name}
                    onChange={e =>
                      setAuthForm(prev => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="auth-email">{t("common.email")}</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    value={authForm.email}
                    onChange={e =>
                      setAuthForm(prev => ({ ...prev, email: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* 角色与套餐 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                {t("admin.userMgmt.roleAndPlan", "角色与套餐")}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("admin.userMgmt.role")}</Label>
                  <Select
                    value={authForm.role}
                    onValueChange={val =>
                      setAuthForm(prev => ({
                        ...prev,
                        role: val as "user" | "admin",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">
                        {t("admin.userMgmt.roleUser")}
                      </SelectItem>
                      <SelectItem value="admin">
                        {t("admin.userMgmt.roleAdmin")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("admin.userMgmt.plan", "套餐")}</Label>
                  <Select
                    value={authForm.subscriptionTier}
                    onValueChange={val =>
                      setAuthForm(prev => ({
                        ...prev,
                        subscriptionTier: val as "free" | "pro" | "business",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 有效期管理 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                {t("admin.userMgmt.expiryManagement", "有效期管理")}
              </h4>
              <div className="space-y-2">
                <Label htmlFor="auth-expires">
                  {t("admin.userMgmt.expiresAt", "到期时间")}
                </Label>
                <Input
                  id="auth-expires"
                  type="date"
                  value={authForm.licenseExpiresAt}
                  onChange={e =>
                    setAuthForm(prev => ({
                      ...prev,
                      licenseExpiresAt: e.target.value,
                    }))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setExpiryQuick("30d")}
                  >
                    +30{t("admin.userMgmt.days", "天")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setExpiryQuick("1y")}
                  >
                    +1{t("admin.userMgmt.year", "年")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setExpiryQuick("permanent")}
                  >
                    {t("admin.userMgmt.permanent", "永久")}
                  </Button>
                </div>
              </div>
            </div>

            {/* 账号状态 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                {t("admin.userMgmt.accountStatus", "账号状态")}
              </h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {authForm.isActive ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Ban className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm">
                    {authForm.isActive
                      ? t("admin.userMgmt.active", "已激活")
                      : t("admin.userMgmt.banned", "已封禁")}
                  </span>
                </div>
                <Switch
                  checked={authForm.isActive}
                  onCheckedChange={checked =>
                    setAuthForm(prev => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAuthDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleAuthSave}
              disabled={authUpdateMutation.isPending}
            >
              {authUpdateMutation.isPending
                ? t("common.processing")
                : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
