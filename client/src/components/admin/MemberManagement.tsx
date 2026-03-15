import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Key, AlertTriangle, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// 紧急规避 React 19 类型在当前环境下的解析异常
type ChangeEventT<T = Element> = any;

type Member = {
  id: number;
  username: string | null;
  name: string | null;
  email: string | null;
  role: string;
  lastSignedIn: Date | null;
  createdAt: Date;
};

export default function MemberManagement() {
  const { t } = useTranslation();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const [inviteData, setInviteData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    role: "user" as "user" | "tenant_admin",
  });

  const [editData, setEditData] = useState({
    name: "",
    email: "",
    role: "user" as "user" | "tenant_admin",
  });

  const [newPassword, setNewPassword] = useState("");

  const { data: members, isLoading, refetch } = trpc.tenant.getMembers.useQuery();

  const inviteMutation = trpc.tenant.inviteMember.useMutation({
    onSuccess: () => {
      toast.success(t("admin.memberMgmt.inviteSuccess"));
      setInviteData({ username: "", password: "", name: "", email: "", role: "user" });
      setIsInviteOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.tenant.updateMember.useMutation({
    onSuccess: () => {
      toast.success(t("admin.memberMgmt.updateSuccess"));
      setIsEditOpen(false);
      setSelectedMember(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.tenant.deleteMember.useMutation({
    onSuccess: () => {
      toast.success(t("admin.memberMgmt.deleteSuccess"));
      setIsDeleteOpen(false);
      setSelectedMember(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetPasswordMutation = trpc.tenant.resetMemberPassword.useMutation({
    onSuccess: () => {
      toast.success(t("admin.memberMgmt.resetPasswordSuccess"));
      setIsResetPasswordOpen(false);
      setSelectedMember(null);
      setNewPassword("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleInvite = async () => {
    if (!inviteData.username || !inviteData.password) {
      toast.error(t("admin.memberMgmt.requiredFields"));
      return;
    }
    if (inviteData.username.length < 3) {
      toast.error(t("admin.memberMgmt.usernameMinLength"));
      return;
    }
    if (inviteData.password.length < 6) {
      toast.error(t("admin.memberMgmt.passwordMinLength"));
      return;
    }
    await inviteMutation.mutateAsync(inviteData);
  };

  const handleEdit = async () => {
    if (!selectedMember) return;
    await updateMutation.mutateAsync({
      userId: selectedMember.id,
      ...editData,
    });
  };

  const handleDelete = async () => {
    if (!selectedMember) return;
    await deleteMutation.mutateAsync({ userId: selectedMember.id });
  };

  const handleResetPassword = async () => {
    if (!selectedMember || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error(t("admin.memberMgmt.passwordMinLength"));
      return;
    }
    await resetPasswordMutation.mutateAsync({
      userId: selectedMember.id,
      newPassword,
    });
  };

  const openEditDialog = (member: Member) => {
    setSelectedMember(member);
    setEditData({
      name: member.name || "",
      email: member.email || "",
      role: member.role as "user" | "tenant_admin",
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (member: Member) => {
    setSelectedMember(member);
    setIsDeleteOpen(true);
  };

  const openResetPasswordDialog = (member: Member) => {
    setSelectedMember(member);
    setNewPassword("");
    setIsResetPasswordOpen(true);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      tenant_admin: "default",
      user: "secondary",
    };
    const labels: Record<string, string> = {
      tenant_admin: t("admin.memberMgmt.roleAdmin"),
      user: t("admin.memberMgmt.roleUser"),
    };
    return (
      <Badge variant={variants[role] || "secondary"}>
        {labels[role] || role}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t("admin.memberMgmt.title")}
            </CardTitle>
            <CardDescription>{t("admin.memberMgmt.subtitle")}</CardDescription>
          </div>
          <Dialog open={isInviteOpen} onOpenChange={(open: boolean) => {
            setIsInviteOpen(open);
            if (!open) setInviteData({ username: "", password: "", name: "", email: "", role: "user" });
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {t("admin.memberMgmt.invite")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("admin.memberMgmt.inviteMember")}</DialogTitle>
                <DialogDescription>{t("admin.memberMgmt.inviteDesc")}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="username">{t("admin.memberMgmt.username")} *</Label>
                  <Input
                    id="username"
                    placeholder={t("admin.memberMgmt.usernamePlaceholder")}
                    value={inviteData.username}
                    onChange={(e: ChangeEventT<HTMLInputElement>) => setInviteData({ ...inviteData, username: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="password">{t("admin.memberMgmt.password")} *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t("admin.memberMgmt.passwordPlaceholder")}
                    value={inviteData.password}
                    onChange={(e: ChangeEventT<HTMLInputElement>) => setInviteData({ ...inviteData, password: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="name">{t("admin.memberMgmt.displayName")}</Label>
                  <Input
                    id="name"
                    placeholder={t("admin.memberMgmt.displayNamePlaceholder")}
                    value={inviteData.name}
                    onChange={(e: ChangeEventT<HTMLInputElement>) => setInviteData({ ...inviteData, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="email">{t("admin.memberMgmt.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("admin.memberMgmt.emailPlaceholder")}
                    value={inviteData.email}
                    onChange={(e: ChangeEventT<HTMLInputElement>) => setInviteData({ ...inviteData, email: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="role">{t("admin.memberMgmt.role")}</Label>
                  <select
                    id="role"
                    value={inviteData.role}
                    onChange={(e) => setInviteData({ ...inviteData, role: e.target.value as "user" | "tenant_admin" })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  >
                    <option value="user">{t("admin.memberMgmt.roleUser")}</option>
                    <option value="tenant_admin">{t("admin.memberMgmt.roleAdmin")}</option>
                  </select>
                </div>

                <Button onClick={handleInvite} disabled={inviteMutation.isPending} className="w-full">
                  {inviteMutation.isPending ? t("admin.memberMgmt.inviting") : t("admin.memberMgmt.invite")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">{t("common.loading")}</div>
        ) : !members || members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t("admin.memberMgmt.noMembers")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.memberMgmt.username")}</TableHead>
                <TableHead>{t("admin.memberMgmt.displayName")}</TableHead>
                <TableHead>{t("admin.memberMgmt.role")}</TableHead>
                <TableHead>{t("admin.memberMgmt.lastLogin")}</TableHead>
                <TableHead>{t("admin.memberMgmt.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member: Member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.username || "-"}</TableCell>
                  <TableCell>{member.name || "-"}</TableCell>
                  <TableCell>{getRoleBadge(member.role)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(member.lastSignedIn)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(member)}
                        title={t("admin.memberMgmt.editMember")}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openResetPasswordDialog(member)}
                        title={t("admin.memberMgmt.resetPassword")}
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(member)}
                        className="text-destructive hover:text-destructive"
                        title={t("admin.memberMgmt.deleteMember")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.memberMgmt.editMember")}</DialogTitle>
            <DialogDescription>{t("admin.memberMgmt.editDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">{t("admin.memberMgmt.displayName")}</Label>
              <Input
                id="edit-name"
                value={editData.name}
                onChange={(e: ChangeEventT<HTMLInputElement>) => setEditData({ ...editData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-email">{t("admin.memberMgmt.email")}</Label>
              <Input
                id="edit-email"
                type="email"
                value={editData.email}
                onChange={(e: ChangeEventT<HTMLInputElement>) => setEditData({ ...editData, email: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-role">{t("admin.memberMgmt.role")}</Label>
              <select
                id="edit-role"
                value={editData.role}
                onChange={(e) => setEditData({ ...editData, role: e.target.value as "user" | "tenant_admin" })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
              >
                <option value="user">{t("admin.memberMgmt.roleUser")}</option>
                <option value="tenant_admin">{t("admin.memberMgmt.roleAdmin")}</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t("admin.memberMgmt.updating") : t("common.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.memberMgmt.resetPassword")}</DialogTitle>
            <DialogDescription>
              {t("admin.memberMgmt.resetPasswordDesc", { name: selectedMember?.name || selectedMember?.username })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password">{t("admin.memberMgmt.newPassword")} *</Label>
              <Input
                id="new-password"
                type="password"
                placeholder={t("admin.memberMgmt.passwordPlaceholder")}
                value={newPassword}
                onChange={(e: ChangeEventT<HTMLInputElement>) => setNewPassword(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPasswordOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleResetPassword} disabled={resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending ? t("admin.memberMgmt.resetting") : t("admin.memberMgmt.resetPassword")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t("admin.memberMgmt.deleteMember")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.memberMgmt.deleteConfirm", { name: selectedMember?.name || selectedMember?.username })}
            </DialogDescription>
          </DialogHeader>

          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive font-medium">
              {t("admin.memberMgmt.deleteWarning")}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("admin.memberMgmt.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
