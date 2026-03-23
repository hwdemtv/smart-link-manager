import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Trash2, ExternalLink, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LinkType | null>(null);

  const { data, isLoading, refetch } = trpc.user.getAllLinks.useQuery({
    search: searchQuery || undefined,
    isActive: statusFilter === "all" ? undefined : statusFilter === "active" ? 1 : 0,
    isValid: validFilter === "all" ? undefined : validFilter === "valid" ? 1 : 0,
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
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toggleStatusMutation = trpc.user.adminToggleLinkStatus.useMutation({
    onSuccess: () => {
      toast.success(t("admin.linkMgmt.statusUpdated"));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // 搜索或筛选变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, validFilter]);

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

  const links = data?.links || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.linkMgmt.title")}</CardTitle>
          <CardDescription>{t("admin.linkMgmt.subtitle")}</CardDescription>

          {/* 搜索和筛选 */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.linkMgmt.searchPlaceholder")}
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

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t("admin.linkMgmt.filterStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.linkMgmt.allStatus")}</SelectItem>
                <SelectItem value="active">{t("admin.linkMgmt.statusActive")}</SelectItem>
                <SelectItem value="inactive">{t("admin.linkMgmt.statusInactive")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={validFilter} onValueChange={setValidFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t("admin.linkMgmt.filterValid")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.linkMgmt.allValid")}</SelectItem>
                <SelectItem value="valid">{t("admin.linkMgmt.validValid")}</SelectItem>
                <SelectItem value="invalid">{t("admin.linkMgmt.validInvalid")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">{t("common.loading")}</div>
          ) : links.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t("admin.linkMgmt.noLinks")}</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.linkMgmt.shortCode")}</TableHead>
                      <TableHead>{t("admin.linkMgmt.originalUrl")}</TableHead>
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
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            {link.customDomain && (
                              <span className="text-muted-foreground">{link.customDomain}/</span>
                            )}
                            {link.shortCode}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 max-w-[200px]">
                            <span className="truncate text-sm text-muted-foreground" title={link.originalUrl}>
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
                        <TableCell className="text-sm">
                          {link.userUsername || link.userName || "-"}
                        </TableCell>
                        <TableCell className="text-sm">{link.clickCount}</TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleStatus(link)}
                            className={`flex items-center gap-1 ${link.isActive === 1 ? "text-green-600" : "text-red-600"} hover:opacity-80 transition-opacity`}
                            title={link.isActive === 1 ? t("admin.linkMgmt.deactivate") : t("admin.linkMgmt.activate")}
                          >
                            {link.isActive === 1 ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-xs">{t("admin.linkMgmt.statusActive")}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4" />
                                <span className="text-xs">{t("admin.linkMgmt.statusInactive")}</span>
                              </>
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={link.isValid === 1 ? "default" : "destructive"}>
                            {link.isValid === 1 ? t("admin.linkMgmt.validValid") : t("admin.linkMgmt.validInvalid")}
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
                    {t("admin.pagination.showing", {
                      from: (currentPage - 1) * pageSize + 1,
                      to: Math.min(currentPage * pageSize, total),
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
                      ← {t("admin.pagination.prev")}
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
                      {t("admin.pagination.next")} →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t("admin.linkMgmt.deleteLink")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.linkMgmt.deleteConfirm", { shortCode: selectedLink?.shortCode })}
            </DialogDescription>
          </DialogHeader>

          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive font-medium">
              {t("admin.linkMgmt.deleteWarning")}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("admin.linkMgmt.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
