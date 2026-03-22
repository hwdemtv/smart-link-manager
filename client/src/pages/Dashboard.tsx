import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import React, { useState, useMemo, useRef, useEffect } from "react";
// 紧急规避 React 19 类型在当前环境下的解析异常
type ChangeEvent<T = any> = any;
type FormEvent<T = any> = any;
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Search,
  Plus,
  QrCode,
  Copy,
  Edit,
  Trash2,
  ExternalLink,
  Link2,
  X,
  Upload,
  Download,
  Calendar,
  Filter,
  ArrowUpDown,
  ChevronDown,
  Check,
  MoreVertical,
  Lock,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Link, Domain } from "../../../drizzle/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState(null as any);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [importText, setImportText] = useState("");
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [previewLinks, setPreviewLinks] = useState([] as any[]);
  const fileInputRef = useRef(null as HTMLInputElement | null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const initialSelectedIds: Set<number> = new Set();
  const [selectedIds, setSelectedIds] = React.useState(initialSelectedIds);
  
  const [formData, setFormData] = useState({
    originalUrl: "",
    shortCode: "",
    customDomain: "",
    description: "",
    expiresAt: "",
    password: "",
    tagsString: "",
    seoTitle: "",
    seoDescription: "",
    seoImage: "",
  });

  const linksQuery = trpc.links.list.useQuery();
  const domainsQuery = trpc.domains.list.useQuery();
  const createLinkMutation = trpc.links.create.useMutation();
  const updateLinkMutation = trpc.links.update.useMutation();
  const deleteLinkMutation = trpc.links.delete.useMutation();
  const batchDeleteMutation = trpc.links.batchDelete.useMutation();
  const batchUpdateMutation = trpc.links.batchUpdate.useMutation();
  const batchUpdateTagsMutation = trpc.links.batchUpdateTags.useMutation();
  const batchImportMutation = trpc.links.batchImport.useMutation();
  const generateSeoMutation = trpc.links.generateSeo.useMutation();
  const utils = (trpc as any).useUtils();

  // Filter links locally
  const filteredLinks = useMemo(() => {
    const links = linksQuery.data || [];
    return links.filter((link: Link) => {
      const matchesSearch = !searchQuery || 
        link.shortCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.originalUrl.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && link.isValid && link.isActive) ||
        (statusFilter === "invalid" && !link.isValid);
      const matchesTag = !tagFilter || (link.tags && link.tags.includes(tagFilter.trim()));
      return matchesSearch && matchesStatus && matchesTag;
    });
  }, [linksQuery.data, searchQuery, statusFilter, tagFilter]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [searchQuery, statusFilter, tagFilter]);

  const totalPages = Math.ceil(filteredLinks.length / itemsPerPage);
  const paginatedLinks = filteredLinks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleCreateLink = async (e: any) => {
    e.preventDefault();

    if (!formData.originalUrl || !formData.shortCode) {
      toast.error(t("dashboard.requiredFields"));
      return;
    }

    try {
      await createLinkMutation.mutateAsync({
        originalUrl: formData.originalUrl,
        shortCode: formData.shortCode,
        customDomain: formData.customDomain || undefined,
        description: formData.description,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined,
        password: formData.password || undefined,
        tags: formData.tagsString ? formData.tagsString.split(",").map((tag: string) => tag.trim()).filter(Boolean) : [],
        seoTitle: formData.seoTitle || undefined,
        seoDescription: formData.seoDescription || undefined,
        seoImage: formData.seoImage || undefined,
      });

      toast.success(t("common.success"));
      setFormData({ originalUrl: "", shortCode: "", customDomain: "", description: "", expiresAt: "", password: "", tagsString: "", seoTitle: "", seoDescription: "", seoImage: "" });
      setIsCreateOpen(false);
      linksQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || t("dashboard.failedToCreate"));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(t("dashboard.confirmBatchDelete") || `确定删除选中的 ${selectedIds.size} 项吗？`)) return;

    try {
      await batchDeleteMutation.mutateAsync({ linkIds: Array.from(selectedIds) });
      toast.success(t("common.success"));
      setSelectedIds(new Set<number>());
      linksQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "批量删除失败");
    }
  };

  const handleBatchToggleStatus = async (isActive: number) => {
    if (selectedIds.size === 0) return;
    try {
      await batchUpdateMutation.mutateAsync({
        linkIds: Array.from(selectedIds),
        data: { isActive }
      });
      toast.success(t("common.success"));
      linksQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "批量操作失败");
    }
  };

  const handleBatchGenerateSeo = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    toast.info(`开始分批处理 ${ids.length} 项 AI SEO 生成...`);
    
    let successCount = 0;
    for (const id of ids) {
      const link = linksQuery.data?.find((l: any) => l.id === id);
      if (!link) continue;
      
      try {
        const seo = await generateSeoMutation.mutateAsync({ url: link.originalUrl });
        await updateLinkMutation.mutateAsync({
          linkId: id as any,
          seoTitle: (seo as any).seoTitle,
          seoDescription: (seo as any).seoDescription,
        });
        successCount++;
      } catch (e) {
        console.error(`Failed SEO for link ${id}`, e);
      }
    }
    
    toast.success(`批量 SEO 处理完成: 成功 ${successCount}/${ids.length}`);
    linksQuery.refetch();
  };

  const handleBatchExport = () => {
    if (selectedIds.size === 0) return;
    const selectedLinks = linksQuery.data?.filter((l: any) => selectedIds.has(l.id)) || [];
    
    // 生成 CSV 内容
    const headers = ["Short Code", "Original URL", "Clicks", "Status", "Created At", "Description"];
    const rows = selectedLinks.map((l: any) => [
      l.shortCode,
      l.originalUrl,
      l.clickCount,
      l.isActive ? "Active" : "Inactive",
      new Date(l.createdAt).toLocaleString(),
      l.description || ""
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `links_export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateSeo = async (e: any) => {
    e.preventDefault();
    if (!formData.originalUrl) {
      toast.error(t("dashboard.urlRequiredForSeo"));
      return;
    }

    try {
      const result = await generateSeoMutation.mutateAsync({
        url: formData.originalUrl,
      });

      if (result.success) {
        setFormData((prev: typeof formData) => ({
          ...prev,
          seoTitle: result.seoTitle || prev.seoTitle,
          seoDescription: result.seoDescription || prev.seoDescription,
        }));
        toast.success(t("dashboard.seoGenerated"));
      }
    } catch (error: any) {
      toast.error(error.message || t("dashboard.seoGenerateFailed"));
    }
  };

  const handleEditLink = async (e: any) => {
    e.preventDefault();
    if (!selectedLink) return;

    try {
      await updateLinkMutation.mutateAsync({
        linkId: selectedLink.id,
        originalUrl: formData.originalUrl,
        shortCode: formData.shortCode,
        description: formData.description || null,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : null,
        password: formData.password || null,
        tags: formData.tagsString ? formData.tagsString.split(",").map((tag: string) => tag.trim()).filter(Boolean) : [],
        seoTitle: formData.seoTitle || null,
        seoDescription: formData.seoDescription || null,
        seoImage: formData.seoImage || null,
      });

      toast.success(t("common.success"));
      setIsEditOpen(false);
      setSelectedLink(null);
      linksQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || t("dashboard.failedToUpdate"));
    }
  };

  const handleDeleteLink = async () => {
    if (!selectedLink) return;

    try {
      await deleteLinkMutation.mutateAsync({ linkId: selectedLink.id });
      toast.success(t("common.success"));
      setIsDeleteOpen(false);
      setSelectedLink(null);
      linksQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || t("dashboard.failedToDelete"));
    }
  };

  const handleBatchImport = async () => {
    if (!importText.trim()) {
      toast.error(t("dashboard.importDescription"));
      return;
    }

    // Parse input (支持 JSON 数组或每行一个 URL)
    let links: { originalUrl: string; shortCode?: string; description?: string }[] = [];
    
    try {
      // 尝试解析为 JSON 数组
      const parsed = JSON.parse(importText);
      if (Array.isArray(parsed)) {
        links = parsed.map((item: { url?: string; originalUrl?: string; shortCode?: string; code?: string; description?: string; desc?: string }) => ({
          originalUrl: (typeof item === "string" ? item : item.url || item.originalUrl) as string,
          shortCode: item.shortCode || item.code,
          description: item.description || item.desc,
        }));
      }
    } catch {
      // 解析为每行一个 URL
      links = importText
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line && line.startsWith("http"))
        .map((line: string) => ({ originalUrl: line }));
    }

    if (links.length === 0) {
      toast.error(t("dashboard.noValidLinks"));
      return;
    }

    // 1. 内部去重验证
    const codeCountMap = new Map<string, number>();
    const urlInternalMap = new Map<string, number[]>();

    links.forEach((link, idx) => {
      if (link.shortCode) {
        codeCountMap.set(link.shortCode, (codeCountMap.get(link.shortCode) || 0) + 1);
      }
      if (link.originalUrl) {
        if (!urlInternalMap.has(link.originalUrl)) urlInternalMap.set(link.originalUrl, []);
        urlInternalMap.get(link.originalUrl)!.push(idx + 1);
      }
    });

    const allExistingLinks = linksQuery.data || [];

    const linksWithInternalCheck = links.map((link, idx) => {
      let hasConflict = false;
      let conflictReason = "";
      let hasWarning = false;
      let warningReason = "";

      if (link.shortCode && codeCountMap.get(link.shortCode)! > 1) {
        hasConflict = true;
        conflictReason = t("dashboard.duplicateEntry");
      }

      const internalIndices = urlInternalMap.get(link.originalUrl);
      if (internalIndices && internalIndices.length > 1) {
        hasWarning = true;
        const otherRows = internalIndices.filter(i => i !== idx + 1);
        warningReason = t("dashboard.sameTargetBatch", { rows: otherRows.join(', ') });
      } else {
        const existing = allExistingLinks.find((l: any) => l.originalUrl === link.originalUrl);
        if (existing) {
          hasWarning = true;
          warningReason = t("dashboard.sameTargetSystem", { shortCode: existing.shortCode });
        }
      }

      return { ...link, hasConflict, conflictReason, hasWarning, warningReason };
    });

    // 2. 云端存在性验证
    const codesToCheck = linksWithInternalCheck
      .filter(l => l.shortCode && !l.hasConflict)
      .map(l => l.shortCode!);
      
    let finalLinks = linksWithInternalCheck;
    if (codesToCheck.length > 0) {
       try {
         const existingCodes = await utils.links.checkShortCodes.fetch({ shortCodes: codesToCheck });
         const existingSet = new Set(existingCodes);
         finalLinks = linksWithInternalCheck.map(link => {
            if (link.shortCode && existingSet.has(link.shortCode)) {
               return { ...link, hasConflict: true, conflictReason: t("dashboard.shortCodeTaken") };
            }
            return link;
         });
       } catch (error) {
         console.error("Failed to check existing short codes:", error);
       }
    }

    setPreviewLinks(finalLinks);
    setIsImportOpen(false);
    setIsImportPreviewOpen(true);
  };

  const handleConfirmImport = async () => {
    try {
      const result = await batchImportMutation.mutateAsync({ links: previewLinks });
      toast.success(t("dashboard.importSuccess", { count: result.success.length }));
      setIsImportPreviewOpen(false);
      setPreviewLinks([]);
      setImportText("");
      linksQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || t("dashboard.failedToImport"));
    }
  };

  const handleExport = async (format: "json" | "csv") => {
    try {
      const result = await utils.links.export.fetch({ format, includeStats: true });
      if (!result) return;
      
      if (format === "json") {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `links-export-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([result.data as unknown as string], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `links-export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      toast.success(t("dashboard.exportSuccess"));
    } catch (error: any) {
      toast.error(error.message || t("dashboard.failedToExport"));
    }
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportText(content);
    };
    reader.readAsText(file);
  };

  const openEditDialog = (link: any) => {
    setSelectedLink(link);
    setFormData({
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      customDomain: link.customDomain || "",
      description: link.description || "",
      expiresAt: link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 16) : "",
      password: "", // 密码不回显
      tagsString: link.tags ? link.tags.join(", ") : "",
      seoTitle: link.seoTitle || "",
      seoDescription: link.seoDescription || "",
      seoImage: link.seoImage || "",
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (link: any) => {
    setSelectedLink(link);
    setIsDeleteOpen(true);
  };

  const copyToClipboard = (text: string) => {
    const fullUrl = `${window.location.origin}/s/${text}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success(t("dashboard.copySuccess"));
  };

  const links = linksQuery.data || [];
  const totalClicks = links.reduce((sum: number, link: any) => sum + (link.clickCount || 0), 0);
  const invalidLinks = links.filter((link: any) => !link.isValid).length;

  return (
    <div className="min-h-content bg-background">
      {/* Header (Simplified for Layout) */}
      <div className="container py-6 border-b border-border/50 bg-card/10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">{t("common.links")}</h1>
            <p className="mt-1 text-muted-foreground">{t("dashboard.manageSubtitle")}</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="lg" className="gap-2">
                    <Upload className="w-4 h-4" />
                    {t("dashboard.import")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{t("dashboard.batchImport")}</DialogTitle>
                    <DialogDescription>
                      {t("dashboard.importDescription")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {t("dashboard.uploadFile")}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.json,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                    <textarea
                      placeholder={t("dashboard.importPlaceholder")}
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      className="w-full h-48 p-3 border border-border rounded-md bg-background text-foreground text-sm font-mono resize-none"
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                        {t("common.cancel")}
                      </Button>
                      <Button onClick={handleBatchImport} disabled={batchImportMutation.isPending}>
                        {batchImportMutation.isPending ? t("dashboard.importing") : t("dashboard.import")}
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isImportPreviewOpen} onOpenChange={setIsImportPreviewOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>{t("dashboard.importPreviewTitle")}</DialogTitle>
                    <DialogDescription>
                      {t("dashboard.importPreviewDesc", { count: previewLinks.length })}
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="flex-1 border rounded-md p-4 bg-muted/30">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">{t("dashboard.shortCode")}</TableHead>
                          <TableHead>{t("dashboard.originalUrl")}</TableHead>
                          <TableHead>{t("dashboard.description")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewLinks.map((link: any, idx: number) => (
                          <TableRow key={idx} className={link.hasConflict ? "bg-red-50/50 hover:bg-red-50/80" : ""}>
                            <TableCell className="font-mono text-xs">
                               <div className="flex items-center gap-2">
                                  {link.shortCode || "-"}
                                  {link.hasConflict && (
                                     <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/10 cursor-help" title={link.conflictReason}>
                                       {link.conflictReason}
                                     </span>
                                  )}
                               </div>
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate" title={link.originalUrl}>
                              <div className="flex items-center gap-2">
                                <span className="truncate">{link.originalUrl}</span>
                                {link.hasWarning && (
                                   <span className="shrink-0 inline-flex items-center rounded-md bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800 ring-1 ring-inset ring-yellow-600/20 cursor-help" title={link.warningReason}>
                                     {t("dashboard.sourceOverlap")}
                                   </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{link.description || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <DialogFooter className="pt-4 mt-auto">
                    <Button variant="outline" onClick={() => {
                        setIsImportPreviewOpen(false);
                        setIsImportOpen(true);
                    }}>
                      {t("common.back")}
                    </Button>
                    <Button 
                      onClick={handleConfirmImport} 
                      disabled={batchImportMutation.isPending || previewLinks.some((l: any) => l.hasConflict)}
                    >
                      {batchImportMutation.isPending ? t("dashboard.importing") : t("dashboard.confirmImport")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="lg" className="gap-2" onClick={() => handleExport("csv")}>
                <Download className="w-4 h-4" />
                {t("dashboard.export")}
              </Button>

              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="gap-2">
                    <Plus className="w-4 h-4" />
                    {t("dashboard.createLink")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t("dashboard.createLink")}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateLink} className="space-y-4">
                    <div>
                      <Label htmlFor="originalUrl">{t("dashboard.originalUrl")} *</Label>
                      <Input
                        id="originalUrl"
                        type="url"
                        placeholder={t("dashboard.urlPlaceholder")}
                        value={formData.originalUrl}
                        onChange={(e: any) =>
                          setFormData({ ...formData, originalUrl: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="shortCode">{t("dashboard.shortCode")} *</Label>
                      <Input
                        id="shortCode"
                        placeholder={t("dashboard.shortCodePlaceholder")}
                        value={formData.shortCode}
                        onChange={(e: any) =>
                          setFormData({ ...formData, shortCode: e.target.value })
                        }
                        required
                        pattern="^[a-zA-Z0-9_-]{3,20}$"
                        title={t("dashboard.shortCodePatternTip")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="customDomain">{t("dashboard.customDomain")} ({t("common.optional")})</Label>
                      <select
                        id="customDomain"
                        value={formData.customDomain}
                        onChange={(e: any) =>
                          setFormData({ ...formData, customDomain: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                      >
                        <option value="">{t("dashboard.selectDomain")}</option>
                        {(domainsQuery.data || []).map((domain: any) => (
                          <option key={domain.id} value={domain.domain}>
                            {domain.domain} {domain.isVerified ? "✓" : t("dashboard.pending")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="description">{t("dashboard.description")} ({t("common.optional")})</Label>
                      <Input
                        id="description"
                        placeholder={t("dashboard.addNote")}
                        value={formData.description}
                        onChange={(e: any) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="expiresAt">{t("dashboard.expiresAt")} ({t("common.optional")})</Label>
                      <Input
                        id="expiresAt"
                        type="datetime-local"
                        value={formData.expiresAt}
                        onChange={(e: any) =>
                          setFormData({ ...formData, expiresAt: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">{t("dashboard.linkPassword")} ({t("common.optional")})</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder={t("dashboard.passwordPlaceholder")}
                        value={formData.password}
                        onChange={(e: any) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Input
                        id="tags"
                        placeholder={t("dashboard.tagsPlaceholder")}
                        value={formData.tagsString}
                        onChange={(e: any) =>
                          setFormData({ ...formData, tagsString: e.target.value })
                        }
                      />
                    </div>
                    {/* SEO Settings */}
                    <div className="pt-2 border-t border-border mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium">{t("dashboard.seoSection")}</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateSeo}
                          disabled={generateSeoMutation.isPending || !formData.originalUrl}
                          className="h-7 text-xs flex items-center gap-1 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary transition-all duration-300"
                        >
                          <Sparkles className={`w-3 h-3 ${generateSeoMutation.isPending ? 'animate-pulse' : ''}`} />
                          {generateSeoMutation.isPending ? t("common.loading") : t("dashboard.aiGenerateSeo")}
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="seoTitle" className="text-xs">{t("dashboard.seoTitle")}</Label>
                          <Input
                            id="seoTitle"
                            placeholder={t("dashboard.seoTitlePlaceholder")}
                            value={formData.seoTitle}
                            onChange={(e: any) => setFormData({ ...formData, seoTitle: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label htmlFor="seoDescription" className="text-xs">{t("dashboard.seoDescription")}</Label>
                          <Input
                            id="seoDescription"
                            placeholder={t("dashboard.seoDescriptionPlaceholder")}
                            value={formData.seoDescription}
                            onChange={(e: any) => setFormData({ ...formData, seoDescription: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label htmlFor="seoImage" className="text-xs">{t("dashboard.seoImage")}</Label>
                          <Input
                            id="seoImage"
                            placeholder={t("dashboard.seoImagePlaceholder")}
                            value={formData.seoImage}
                            onChange={(e: any) => setFormData({ ...formData, seoImage: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
          </div>
        </div>
      </div>

      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-card border border-border/50 shadow-2xl rounded-full px-4 py-2 flex items-center gap-3 backdrop-blur-md bg-opacity-90">
            <div className="flex items-center gap-2 px-3 border-r border-border pr-4 mr-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-blue text-[10px] font-bold text-white">
                {selectedIds.size}
              </span>
              <span className="text-sm font-medium">{t("dashboard.selected") || "已选中"}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-3 rounded-full gap-2 hover:bg-green-500/10 hover:text-green-500"
                onClick={() => handleBatchToggleStatus(1)}
              >
                <Check className="w-4 h-4" />
                <span className="hidden sm:inline">启用</span>
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-3 rounded-full gap-2 hover:bg-yellow-500/10 hover:text-yellow-500"
                onClick={() => handleBatchToggleStatus(0)}
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">禁用</span>
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-3 rounded-full gap-2 hover:bg-accent-blue/10 hover:text-accent-blue"
                onClick={handleBatchGenerateSeo}
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">AI SEO</span>
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-3 rounded-full gap-2 hover:bg-accent-blue/10 hover:text-accent-blue"
                onClick={handleBatchExport}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">导出</span>
              </Button>

              <div className="w-px h-4 bg-border mx-1" />

              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-3 rounded-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleBatchDelete}
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">删除</span>
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 w-9 p-0 rounded-full ml-1"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="container pb-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("dashboard.searchPlaceholder")}
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="pl-10"
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
          <Input
            placeholder={t("dashboard.filterByTag")}
            value={tagFilter}
            onChange={(e: any) => setTagFilter(e.target.value)}
            className="w-full sm:w-48"
          />
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-border rounded-md bg-background text-foreground"
          >
            <option value="all">{t("dashboard.allStatus")}</option>
            <option value="active">{t("dashboard.activeOnly")}</option>
            <option value="invalid">{t("dashboard.invalidOnly")}</option>
          </select>
        </div>
      </div>

      {/* Links Table */}
      <div className="container pb-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">{t("dashboard.yourLinks")} ({filteredLinks.length})</h2>

          {linksQuery.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
          ) : filteredLinks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{searchQuery || statusFilter !== "all" ? t("dashboard.noLinksMatch") : t("dashboard.noLinksFirst")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-accent-blue focus:ring-accent-blue cursor-pointer"
                        checked={paginatedLinks.length > 0 && paginatedLinks.every((l: any) => selectedIds.has(l.id))}
                        onChange={(e) => {
                          const newSelected = new Set(selectedIds);
                          if (e.target.checked) {
                            paginatedLinks.forEach((l: any) => newSelected.add(l.id));
                          } else {
                            paginatedLinks.forEach((l: any) => newSelected.delete(l.id));
                          }
                          setSelectedIds(newSelected);
                        }}
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">{t("dashboard.shortCode")}</th>
                    <th className="text-left py-3 px-4 font-semibold">{t("dashboard.originalUrl")}</th>
                    <th className="text-left py-3 px-4 font-semibold">{t("dashboard.totalClicks")}</th>
                    <th className="text-left py-3 px-4 font-semibold">{t("dashboard.status")}</th>
                    <th className="text-left py-3 px-4 font-semibold">{t("dashboard.expiresAt")}</th>
                    <th className="text-left py-3 px-4 font-semibold">{t("dashboard.created")}</th>
                    <th className="text-left py-3 px-4 font-semibold">{t("dashboard.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLinks.map((link: any) => (
                    <tr key={link.id} className={`border-b border-border hover:bg-secondary/50 ${selectedIds.has(link.id) ? 'bg-secondary/30' : ''}`}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-accent-blue focus:ring-accent-blue cursor-pointer"
                          checked={selectedIds.has(link.id)}
                          onChange={() => {
                            const newSelected = new Set(selectedIds);
                            if (newSelected.has(link.id)) {
                              newSelected.delete(link.id);
                            } else {
                              newSelected.add(link.id);
                            }
                            setSelectedIds(newSelected);
                          }}
                        />
                      </td>
                      <td className="py-3 px-4 font-mono text-accent-blue font-semibold">
                        <div className="text-sm">{link.shortCode}</div>
                        {link.customDomain && <div className="text-xs text-muted-foreground">{link.customDomain}</div>}
                      </td>
                      <td className="py-3 px-4 truncate text-muted-foreground text-xs max-w-xs">
                        <a href={link.originalUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent-blue flex items-center gap-1 mb-1">
                          {link.originalUrl.length > 40 ? link.originalUrl.slice(0, 40) + "..." : link.originalUrl}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                        {link.tags && link.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1.5">
                            {link.tags.map((tag: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-[10px] cursor-pointer hover:bg-muted font-medium border border-border/50" onClick={() => setTagFilter(tag)} title={`Filter by ${tag}`}>#{tag}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">{link.clickCount || 0}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            link.isValid
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                          }`}
                        >
                          {link.isValid ? t("dashboard.valid") : t("dashboard.invalid")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {link.expiresAt ? (
                          new Date(link.expiresAt) < new Date() ? (
                            <span className="text-red-500">{t("dashboard.expired")}</span>
                          ) : (
                            new Date(link.expiresAt).toLocaleDateString()
                          )
                        ) : (
                          <span className="text-muted-foreground">{t("dashboard.never")}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {new Date(link.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        {link.passwordHash && (
                          <span title={t("dashboard.passwordProtected")}>
                            <Lock className="w-3 h-3 text-amber-500" />
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => copyToClipboard(link.shortCode)}
                            title={t("dashboard.copyLink")}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setLocation(`/qr/${link.shortCode}`)}
                            title={t("dashboard.qrCode")}
                          >
                            <QrCode className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openEditDialog(link)}
                            title={t("dashboard.editLinkTitle")}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(link)}
                            title={t("dashboard.deleteLinkTitle")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Shows {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredLinks.length)} of {filteredLinks.length}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      ← Prev
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
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dashboard.editLink")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditLink} className="space-y-4">
            <div>
              <Label htmlFor="edit-originalUrl">{t("dashboard.originalUrl")}</Label>
              <Input
                id="edit-originalUrl"
                type="url"
                value={formData.originalUrl}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, originalUrl: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-shortCode">{t("dashboard.shortCode")}</Label>
              <Input
                id="edit-shortCode"
                value={formData.shortCode}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, shortCode: e.target.value })}
                required
                pattern="^[a-zA-Z0-9_-]{3,20}$"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">{t("dashboard.description")}</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-expiresAt">{t("dashboard.expiresAt")}</Label>
              <Input
                id="edit-expiresAt"
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e: any) => setFormData({ ...formData, expiresAt: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-password">{t("dashboard.linkPassword")} ({t("common.optional")})</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder={t("dashboard.passwordEditPlaceholder")}
                value={formData.password}
                onChange={(e: any) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-tags">{t("dashboard.tagsLabel")} ({t("common.optional")})</Label>
              <Input
                id="edit-tags"
                placeholder={t("dashboard.tagsPlaceholder")}
                value={formData.tagsString}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="hidden"
              />
              <Input
                id="edit-tags-visible"
                placeholder={t("dashboard.tagsPlaceholder")}
                value={formData.tagsString}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, tagsString: e.target.value })}
              />
            </div>
            {/* SEO Settings */}
            <div className="pt-2 border-t border-border mt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">{t("dashboard.seoSection")}</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateSeo}
                  disabled={generateSeoMutation.isPending || !formData.originalUrl}
                  className="h-7 text-xs flex items-center gap-1 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary transition-all duration-300"
                >
                  <Sparkles className={`w-3 h-3 ${generateSeoMutation.isPending ? 'animate-pulse' : ''}`} />
                  {generateSeoMutation.isPending ? t("common.loading") : t("dashboard.aiGenerateSeo")}
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="edit-seoTitle" className="text-xs">{t("dashboard.seoTitle")}</Label>
                  <Input
                    id="edit-seoTitle"
                    placeholder={t("dashboard.seoTitlePlaceholder")}
                    value={formData.seoTitle}
                    onChange={(e: any) => setFormData({ ...formData, seoTitle: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-seoDescription" className="text-xs">{t("dashboard.seoDescription")}</Label>
                  <Input
                    id="edit-seoDescription"
                    placeholder={t("dashboard.seoDescriptionPlaceholder")}
                    value={formData.seoDescription}
                    onChange={(e: any) => setFormData({ ...formData, seoDescription: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-seoImage" className="text-xs">{t("dashboard.seoImage")}</Label>
                  <Input
                    id="edit-seoImage"
                    placeholder={t("dashboard.seoImagePlaceholder")}
                    value={formData.seoImage}
                    onChange={(e: any) => setFormData({ ...formData, seoImage: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={updateLinkMutation.isPending}>
                {updateLinkMutation.isPending ? t("dashboard.saving") : t("common.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("dashboard.deleteLink")}</DialogTitle>
            <DialogDescription>
              {t("dashboard.deleteConfirm")} <strong className="text-foreground">{selectedLink?.shortCode}</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteLink} disabled={deleteLinkMutation.isPending}>
              {deleteLinkMutation.isPending ? t("dashboard.deleting") : t("dashboard.deleteLink")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
