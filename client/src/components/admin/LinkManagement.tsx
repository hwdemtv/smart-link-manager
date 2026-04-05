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
  Trash2,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Globe,
  Download,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

type ChangeEventT<T = Element> = any;

type LinkType = {
  id: number;
  shortCode: string;
  originalUrl: string;
  customDomain: string | null;
  description: string | null;
  isActive: number;
  isValid: number;
  clickCount: number;
  createdAt: Date;
  userId: number;
  userName: string | null;
  userUsername: string | null;
};

export default function LinkManagement() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [validFilter, setValidFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState("");
  const [expiresSoonFilter, setExpiresSoonFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LinkType | null>(null);
  const [selectedLinks, setSelectedLinks] = useState<number[]>([]);

  // 获取所有用户用于筛选
  const { data: userData } = trpc.user.list.useQuery({ limit: 100 });
  const users = userData?.users || [];

  const { data, isLoading, refetch } = trpc.user.getAllLinks.useQuery({
    search: searchQuery || undefined,
    isActive:
      statusFilter === "all" ? undefined : statusFilter === "active" ? 1 : 0,
    isValid:
      validFilter === "all" ? undefined : validFilter === "valid" ? 1 : 0,
    userId: ownerFilter === "all" ? undefined : Number(ownerFilter),
    domain: domainFilter || undefined,
    expiresSoon: expiresSoonFilter || undefined,
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  });

  const deleteMutation = trpc.user.adminDeleteLink.useMutation({
    onSuccess: () => {
      toast.success(t("admin.linkMgmt.deleteSuccess"));
      setIsDeleteDialogOpen(false);
      setSelectedLink(null);
      refetch();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const exportMutation = trpc.user.exportLinksCSV.useMutation({
    onSuccess: (csv: string) => {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const date = new Date().toISOString().split("T")[0];
      link.setAttribute("download", `links-export-${date}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(t("admin.linkMgmt.exportSuccess"));
    },
    onError: (err: any) => {
      toast.error(err.message || t("dashboard.failedToExport"));
    },
  });

  const handleExport = async () => {
    exportMutation.mutate({
      search: searchQuery || undefined,
      isActive:
        statusFilter === "all" ? undefined : statusFilter === "active" ? 1 : 0,
      isValid:
        validFilter === "all" ? undefined : validFilter === "valid" ? 1 : 0,
      userId: ownerFilter === "all" ? undefined : Number(ownerFilter),
      domain: domainFilter || undefined,
      expiresSoon: expiresSoonFilter || undefined,
    });
  };

  const toggleStatusMutation = trpc.user.adminToggleLinkStatus.useMutation({
    onSuccess: () => {
      toast.success(t("admin.linkMgmt.statusUpdated"));
      refetch();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const batchDeleteMutation = trpc.user.adminBatchDeleteLinks.useMutation({
    onSuccess: () => {
      toast.success(t("admin.linkMgmt.deleteSuccess"));
      setSelectedLinks([]);
      refetch();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const batchToggleStatusMutation =
    trpc.user.adminBatchToggleLinkStatus.useMutation({
      onSuccess: () => {
        toast.success(t("admin.linkMgmt.statusUpdated"));
        setSelectedLinks([]);
        refetch();
      },
      onError: error => {
        toast.error(error.message);
      },
    });

  // 搜索或筛选变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
    setSelectedLinks([]);
  }, [
    searchQuery,
    statusFilter,
    validFilter,
    ownerFilter,
    domainFilter,
    expiresSoonFilter,
  ]);

  const links = data?.links || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLinks(links.map((l: LinkType) => l.id));
    } else {
      setSelectedLinks([]);
    }
  };

  const handleSelectOne = (linkId: number, checked: boolean) => {
    if (checked) {
      setSelectedLinks(prev => [...prev, linkId]);
    } else {
      setSelectedLinks(prev => prev.filter(id => id !== linkId));
    }
  };

  const isAllSelected =
    links.length > 0 && selectedLinks.length === links.length;

  const truncateUrl = (url: string, maxLength: number = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + "...";
  };

  const handleDelete = async () => {
    if (!selectedLink) return;
    await deleteMutation.mutateAsync({ linkId: selectedLink.id });
  };

  const handleToggleStatus = async (link: LinkType) => {
    await toggleStatusMutation.mutateAsync({
      linkId: link.id,
      isActive: link.isActive === 1 ? 0 : 1,
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.linkMgmt.title")}</CardTitle>
          <CardDescription>{t("admin.linkMgmt.subtitle")}</CardDescription>

          {/* 搜索和筛选 */}
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.linkMgmt.searchPlaceholder")}
                value={searchQuery}
                onChange={(e: ChangeEventT<HTMLInputElement>) =>
                  setSearchQuery(e.target.value)
                }
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

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t("admin.linkMgmt.filterStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("admin.linkMgmt.allStatus")}
                </SelectItem>
                <SelectItem value="active">
                  {t("admin.linkMgmt.statusActive")}
                </SelectItem>
                <SelectItem value="inactive">
                  {t("admin.linkMgmt.statusInactive")}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={validFilter} onValueChange={setValidFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t("admin.linkMgmt.filterValid")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("admin.linkMgmt.allValid")}
                </SelectItem>
                <SelectItem value="valid">
                  {t("admin.linkMgmt.validValid")}
                </SelectItem>
                <SelectItem value="invalid">
                  {t("admin.linkMgmt.validInvalid")}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue
                  placeholder={t("admin.linkMgmt.filterOwner")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("admin.linkMgmt.allOwners")}
                </SelectItem>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.username || u.name || `User ${u.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 域名筛选 */}
            <div className="relative w-[140px] shrink-0 border rounded-md">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.linkMgmt.specifyDomain")}
                value={domainFilter}
                onChange={e => setDomainFilter(e.target.value)}
                className="pl-9 pr-8 border-0 shadow-none focus-visible:ring-0"
              />
              {domainFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setDomainFilter("")}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* 即将到期筛选 */}
            <div className="flex items-center space-x-2 shrink-0 border rounded-md px-3 h-10 w-[140px]">
              <Checkbox
                id="expiresSoon"
                checked={expiresSoonFilter}
                onCheckedChange={checked =>
                  setExpiresSoonFilter(checked as boolean)
                }
              />
              <label
                htmlFor="expiresSoon"
                className="text-sm font-medium cursor-pointer text-orange-600 dark:text-orange-400"
              >
                {t("admin.linkMgmt.expiresIn7Days")}
              </label>
            </div>

            <Button
              variant="outline"
              className="flex items-center gap-2 h-10 px-4"
              onClick={handleExport}
              disabled={exportMutation.isPending}
            >
              <Download className="h-4 w-4" />
              {exportMutation.isPending
                ? t("admin.linkMgmt.exporting")
                : t("admin.linkMgmt.export")}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">{t("common.loading")}</div>
          ) : links.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("admin.linkMgmt.noLinks")}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all links"
                        />
                      </TableHead>
                      <TableHead>{t("admin.linkMgmt.shortCode")}</TableHead>
                      <TableHead>{t("admin.linkMgmt.originalUrl")}</TableHead>
                      <TableHead>{t("dashboard.description")}</TableHead>
                      <TableHead>{t("admin.linkMgmt.owner")}</TableHead>
                      <TableHead>{t("admin.linkMgmt.clicks")}</TableHead>
                      <TableHead>{t("admin.linkMgmt.status")}</TableHead>
                      <TableHead>{t("admin.linkMgmt.valid")}</TableHead>
                      <TableHead>{t("admin.linkMgmt.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((link: LinkType) => (
                      <TableRow key={link.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLinks.includes(link.id)}
                            onCheckedChange={checked =>
                              handleSelectOne(link.id, checked as boolean)
                            }
                            aria-label={`Select link ${link.shortCode}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            {link.customDomain && (
                              <span className="text-muted-foreground">
                                {link.customDomain}/
                              </span>
                            )}
                            {link.shortCode}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 max-w-[200px]">
                            <span
                              className="truncate text-sm text-muted-foreground"
                              title={link.originalUrl}
                            >
                              {truncateUrl(link.originalUrl)}
                            </span>
                            <a
                              href={link.originalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div
                            className="max-w-[150px] truncate text-sm text-muted-foreground"
                            title={link.description || ""}
                          >
                            {link.description || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <button
                            className="text-blue-600 hover:underline dark:text-blue-400 font-medium"
                            onClick={() => {
                              setOwnerFilter(link.userId.toString());
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            title={t("admin.linkMgmt.filterByUserTitle")}
                          >
                            {link.userUsername || link.userName || "-"}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm">
                          {link.clickCount}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleStatus(link)}
                            className={`flex items-center gap-1 ${link.isActive === 1 ? "text-green-600" : "text-red-600"} hover:opacity-80 transition-opacity`}
                            title={
                              link.isActive === 1
                                ? t("admin.linkMgmt.deactivate")
                                : t("admin.linkMgmt.activate")
                            }
                          >
                            {link.isActive === 1 ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-xs">
                                  {t("admin.linkMgmt.statusActive")}
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4" />
                                <span className="text-xs">
                                  {t("admin.linkMgmt.statusInactive")}
                                </span>
                              </>
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              link.isValid === 1 ? "default" : "destructive"
                            }
                          >
                            {link.isValid === 1
                              ? t("admin.linkMgmt.validValid")
                              : t("admin.linkMgmt.validInvalid")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLink(link);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="text-destructive hover:text-destructive"
                            title={t("admin.linkMgmt.deleteLink")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分页控件 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-4 border-t border-border mt-4">
                  <div className="text-sm text-muted-foreground">
                    {t("common.pagination.showing", {
                      from: (currentPage - 1) * pageSize + 1,
                      to: Math.min(currentPage * pageSize, total),
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
      {selectedLinks.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-popover border border-border shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
          <span className="text-sm font-medium whitespace-nowrap">
            {t("admin.linkMgmt.selectedCount", { count: selectedLinks.length })}
          </span>
          <div className="h-4 w-px bg-border"></div>

          <Button
            variant="outline"
            size="sm"
            className="rounded-full flex items-center gap-1"
            onClick={() =>
              batchToggleStatusMutation.mutate({
                linkIds: selectedLinks,
                isActive: 1,
              })
            }
          >
            <CheckCircle className="w-4 h-4 text-green-600" /> {t("admin.linkMgmt.activate")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="rounded-full flex items-center gap-1 text-destructive hover:text-destructive"
            onClick={() =>
              batchToggleStatusMutation.mutate({
                linkIds: selectedLinks,
                isActive: 0,
              })
            }
          >
            <XCircle className="w-4 h-4" /> {t("admin.linkMgmt.deactivate")}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            className="rounded-full whitespace-nowrap"
            onClick={() => {
              if (
                window.confirm(
                  t("admin.linkMgmt.batchDeleteConfirm")
                )
              ) {
                batchDeleteMutation.mutate({ linkIds: selectedLinks });
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> {t("common.delete")}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setSelectedLinks([])}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t("admin.linkMgmt.deleteLink")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.linkMgmt.deleteConfirm", {
                shortCode: selectedLink?.shortCode,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive font-medium">
              {t("admin.linkMgmt.deleteWarning")}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? t("admin.linkMgmt.deleting")
                : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
