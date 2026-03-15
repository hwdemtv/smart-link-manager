import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Trash2, Check, X, AlertTriangle, UserPlus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// 紧急规避 React 19 类型在当前环境下的解析异常
type ChangeEventT<T = Element> = any;

type Tenant = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  primaryColor: string | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

export default function TenantManagement() {
  const { t } = useTranslation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    primaryColor: "#6366f1",
  });
  const [adminData, setAdminData] = useState({
    username: "",
    password: "",
    name: "",
  });
  const [createAdmin, setCreateAdmin] = useState(false);

  const { data: tenants, isLoading, refetch } = trpc.tenant.list.useQuery();

  const createMutation = trpc.tenant.create.useMutation({
    onSuccess: () => {
      toast.success(t("common.success"));
      setFormData({ name: "", slug: "", description: "", primaryColor: "#6366f1" });
      setIsCreateOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.tenant.update.useMutation({
    onSuccess: () => {
      toast.success(t("admin.tenantMgmt.updateSuccess"));
      setIsEditOpen(false);
      setSelectedTenant(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.tenant.delete.useMutation({
    onSuccess: () => {
      toast.success(t("admin.tenantMgmt.deleteSuccess"));
      setIsDeleteOpen(false);
      setSelectedTenant(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreate = async () => {
    if (!formData.name || !formData.slug) {
      toast.error(t("admin.tenantMgmt.requiredFields"));
      return;
    }

    // If creating admin, validate admin fields
    if (createAdmin) {
      if (!adminData.username || !adminData.password) {
        toast.error(t("admin.tenantMgmt.adminRequiredFields"));
        return;
      }
      if (adminData.username.length < 3) {
        toast.error(t("admin.tenantMgmt.usernameMinLength"));
        return;
      }
      if (adminData.password.length < 6) {
        toast.error(t("admin.tenantMgmt.passwordMinLength"));
        return;
      }
    }

    const result = await createMutation.mutateAsync({
      name: formData.name,
      slug: formData.slug,
      description: formData.description || undefined,
      primaryColor: formData.primaryColor,
      adminUsername: createAdmin ? adminData.username : undefined,
      adminPassword: createAdmin ? adminData.password : undefined,
      adminName: createAdmin ? adminData.name || undefined : undefined,
    });

    if (result.adminUser) {
      toast.success(t("admin.tenantMgmt.createWithAdminSuccess", { username: result.adminUser.username }));
    }
  };

  const handleEdit = async () => {
    if (!selectedTenant || !formData.name) {
      toast.error(t("admin.tenantMgmt.requiredFields"));
      return;
    }

    await updateMutation.mutateAsync({
      tenantId: selectedTenant.id,
      name: formData.name,
      description: formData.description || undefined,
      primaryColor: formData.primaryColor,
    });
  };

  const handleDelete = async () => {
    if (!selectedTenant) return;
    await deleteMutation.mutateAsync({ tenantId: selectedTenant.id });
  };

  const handleToggleStatus = async (tenant: Tenant) => {
    await updateMutation.mutateAsync({
      tenantId: tenant.id,
      isActive: tenant.isActive === 1 ? 0 : 1,
    });
  };

  const openEditDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description || "",
      primaryColor: tenant.primaryColor || "#6366f1",
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: "", slug: "", description: "", primaryColor: "#6366f1" });
    setAdminData({ username: "", password: "", name: "" });
    setCreateAdmin(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("admin.tenantMgmt.title")}</CardTitle>
            <CardDescription>{t("admin.tenantMgmt.subtitle")}</CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open: boolean) => {
            setIsCreateOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {t("admin.tenantMgmt.create")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t("admin.tenantMgmt.createNew")}</DialogTitle>
                <DialogDescription>{t("admin.tenantMgmt.addDesc")}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">{t("admin.tenantMgmt.name")} *</Label>
                  <Input
                    id="name"
                    placeholder={t("admin.tenantMgmt.namePlaceholder")}
                    value={formData.name}
                    onChange={(e: ChangeEventT<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="slug">{t("admin.tenantMgmt.slug")} *</Label>
                  <Input
                    id="slug"
                    placeholder={t("admin.tenantMgmt.slugPlaceholder")}
                    value={formData.slug}
                    onChange={(e: ChangeEventT<HTMLInputElement>) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                  />
                </div>

                <div>
                  <Label htmlFor="description">{t("admin.tenantMgmt.description")}</Label>
                  <Input
                    id="description"
                    placeholder={t("admin.tenantMgmt.descPlaceholder")}
                    value={formData.description}
                    onChange={(e: ChangeEventT<HTMLInputElement>) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="color">{t("admin.tenantMgmt.primaryColor")}</Label>
                  <div className="flex gap-2">
                    <input
                      id="color"
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e: ChangeEventT<HTMLInputElement>) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-12 h-10 rounded border"
                    />
                    <Input
                      value={formData.primaryColor}
                      onChange={(e: ChangeEventT<HTMLInputElement>) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Admin Account Section */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="createAdmin"
                      checked={createAdmin}
                      onChange={(e) => setCreateAdmin(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="createAdmin" className="flex items-center gap-2 cursor-pointer">
                      <UserPlus className="w-4 h-4" />
                      {t("admin.tenantMgmt.createAdminAccount")}
                    </Label>
                  </div>

                  {createAdmin && (
                    <div className="space-y-3 pl-6 border-l-2 border-primary/20 ml-1">
                      <div>
                        <Label htmlFor="adminUsername">{t("admin.tenantMgmt.adminUsername")} *</Label>
                        <Input
                          id="adminUsername"
                          placeholder={t("admin.tenantMgmt.adminUsernamePlaceholder")}
                          value={adminData.username}
                          onChange={(e: ChangeEventT<HTMLInputElement>) => setAdminData({ ...adminData, username: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="adminPassword">{t("admin.tenantMgmt.adminPassword")} *</Label>
                        <Input
                          id="adminPassword"
                          type="password"
                          placeholder={t("admin.tenantMgmt.adminPasswordPlaceholder")}
                          value={adminData.password}
                          onChange={(e: ChangeEventT<HTMLInputElement>) => setAdminData({ ...adminData, password: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="adminName">{t("admin.tenantMgmt.adminDisplayName")}</Label>
                        <Input
                          id="adminName"
                          placeholder={t("admin.tenantMgmt.adminDisplayNamePlaceholder")}
                          value={adminData.name}
                          onChange={(e: ChangeEventT<HTMLInputElement>) => setAdminData({ ...adminData, name: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? t("admin.tenantMgmt.creating") : t("admin.tenantMgmt.create")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">{t("admin.tenantMgmt.loading")}</div>
        ) : !tenants || tenants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t("admin.tenantMgmt.noTenants")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.tenantMgmt.table.name")}</TableHead>
                <TableHead>{t("admin.tenantMgmt.table.slug")}</TableHead>
                <TableHead>{t("admin.tenantMgmt.table.description")}</TableHead>
                <TableHead>{t("admin.tenantMgmt.table.status")}</TableHead>
                <TableHead>{t("admin.tenantMgmt.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant: Tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tenant.primaryColor || "#6366f1" }}
                      />
                      {tenant.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{tenant.slug}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{tenant.description || "-"}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggleStatus(tenant)}
                      className={`flex items-center gap-1 ${tenant.isActive === 1 ? "text-green-600" : "text-red-600"} hover:opacity-80 transition-opacity`}
                      title={t("admin.tenantMgmt.toggleStatus")}
                    >
                      {tenant.isActive === 1 ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span className="text-sm">{t("admin.tenantMgmt.table.active")}</span>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4" />
                          <span className="text-sm">{t("admin.tenantMgmt.table.inactive")}</span>
                        </>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(tenant)}
                        title={t("admin.tenantMgmt.editTenant")}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(tenant)}
                        className="text-destructive hover:text-destructive"
                        title={t("admin.tenantMgmt.deleteTenant")}
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
            <DialogTitle>{t("admin.tenantMgmt.editTenant")}</DialogTitle>
            <DialogDescription>{t("admin.tenantMgmt.editDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">{t("admin.tenantMgmt.name")} *</Label>
              <Input
                id="edit-name"
                placeholder={t("admin.tenantMgmt.namePlaceholder")}
                value={formData.name}
                onChange={(e: ChangeEventT<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-slug">{t("admin.tenantMgmt.slug")}</Label>
              <Input
                id="edit-slug"
                value={formData.slug}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("admin.tenantMgmt.slug")} {t("common.optional").toLowerCase()}
              </p>
            </div>

            <div>
              <Label htmlFor="edit-description">{t("admin.tenantMgmt.description")}</Label>
              <Input
                id="edit-description"
                placeholder={t("admin.tenantMgmt.descPlaceholder")}
                value={formData.description}
                onChange={(e: ChangeEventT<HTMLInputElement>) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="edit-color">{t("admin.tenantMgmt.primaryColor")}</Label>
              <div className="flex gap-2">
                <input
                  id="edit-color"
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e: ChangeEventT<HTMLInputElement>) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="w-12 h-10 rounded border"
                />
                <Input
                  value={formData.primaryColor}
                  onChange={(e: ChangeEventT<HTMLInputElement>) => setFormData({ ...formData, primaryColor: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t("admin.tenantMgmt.updating") : t("common.submit")}
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
              {t("admin.tenantMgmt.deleteTenant")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.tenantMgmt.deleteConfirm", { name: selectedTenant?.name })}
            </DialogDescription>
          </DialogHeader>

          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive font-medium">
              {t("admin.tenantMgmt.deleteWarning")}
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
              {deleteMutation.isPending ? t("admin.tenantMgmt.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
