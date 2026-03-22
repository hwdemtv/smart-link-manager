import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Shield, User, Key, Edit2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

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
};

export default function UserManagement() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 对话框状态
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<string>("");

  const { data, isLoading, refetch } = trpc.user.list.useQuery({
    limit: itemsPerPage,
    offset: (currentPage - 1) * itemsPerPage,
    search: searchQuery || undefined,
  });

  const roleMutation = trpc.user.update.useMutation({
    onSuccess: () => {
      toast.success(t("admin.userMgmt.roleUpdated"));
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / itemsPerPage);

  // 搜索变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      admin: "destructive",
      user: "secondary",
    };
    const icons: Record<string, React.ReactNode> = {
      admin: <Shield className="w-3 h-3" />,
      user: <User className="w-3 h-3" />,
    };
    const labels: Record<string, string> = {
      admin: t("admin.userMgmt.roleAdmin"),
      user: t("admin.userMgmt.roleUser"),
    };
    return (
      <Badge variant={variants[role] || "secondary"} className="gap-1">
        {icons[role]}
        {labels[role] || role}
      </Badge>
    );
  };

  const getTierBadge = (tier: string | null) => {
    const tierColors: Record<string, string> = {
      business: "bg-purple-500",
      pro: "bg-blue-500",
      free: "bg-gray-500",
    };
    return (
      <Badge className={tierColors[tier || 'free'] || "bg-gray-500"}>
        {tier || 'free'}
      </Badge>
    );
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return;
    await roleMutation.mutateAsync({ userId: selectedUser.id, role: newRole as any });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.userMgmt.title")}</CardTitle>
          <CardDescription>{t("admin.userMgmt.subtitle")}</CardDescription>

          {/* 搜索框 */}
          {total > 0 && (
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.userMgmt.searchPlaceholder")}
                value={searchQuery}
                onChange={(e: ChangeEventT<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">{t("common.loading")}</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t("admin.userMgmt.noUsers")}</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.userMgmt.username")}</TableHead>
                    <TableHead>{t("admin.userMgmt.displayName")}</TableHead>
                    <TableHead>{t("admin.userMgmt.email")}</TableHead>
                    <TableHead>{t("admin.userMgmt.role")}</TableHead>
                    <TableHead>{t("license.title")}</TableHead>
                    <TableHead>{t("admin.userMgmt.lastLogin")}</TableHead>
                    <TableHead>{t("admin.userMgmt.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user: UserType) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.username || "-"}
                      </TableCell>
                      <TableCell>{user.name || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.email || "-"}
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getTierBadge(user.subscriptionTier)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(user.lastSignedIn)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setNewRole(user.role);
                              setIsRoleDialogOpen(true);
                            }}
                            title={t("admin.userMgmt.changeRole")}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 分页控件 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    {t("admin.tenantMgmt.pagination.showing", {
                      from: (currentPage - 1) * itemsPerPage + 1,
                      to: Math.min(currentPage * itemsPerPage, total),
                      total
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      ← {t("admin.tenantMgmt.pagination.prev")}
                    </Button>
                    <div className="flex items-center justify-center text-sm font-medium px-2">
                      {currentPage} / {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      {t("admin.tenantMgmt.pagination.next")} →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Role Change Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.userMgmt.changeRole")}</DialogTitle>
            <DialogDescription>
              {t("admin.userMgmt.changeRoleDesc", { name: selectedUser?.username || selectedUser?.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label>{t("admin.userMgmt.newRole")}</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{t("admin.userMgmt.roleUser")}</SelectItem>
                <SelectItem value="admin">{t("admin.userMgmt.roleAdmin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleRoleChange} disabled={roleMutation.isPending}>
              {roleMutation.isPending ? t("admin.userMgmt.updating") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
