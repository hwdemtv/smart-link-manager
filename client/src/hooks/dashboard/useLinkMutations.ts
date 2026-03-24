import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Link, CreateLinkInput, UpdateLinkInput, SeoResult } from "@/types/dashboard";

/**
 * useLinkMutations Hook
 * 封装所有链接相关的 tRPC mutations
 */

interface UseLinkMutationsOptions {
  onSuccess?: () => void;
}

export function useLinkMutations(options: UseLinkMutationsOptions = {}) {
  const { t } = useTranslation();
  const utils = (trpc as any).useUtils();

  // Mutations
  const createLinkMutation = trpc.links.create.useMutation({
    onSuccess: () => {
      toast.success(t("common.success"));
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || t("dashboard.failedToCreate"));
    },
  });

  const updateLinkMutation = trpc.links.update.useMutation({
    onSuccess: () => {
      toast.success(t("common.success"));
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || t("dashboard.failedToUpdate"));
    },
  });

  const deleteLinkMutation = trpc.links.delete.useMutation({
    onSuccess: () => {
      toast.success(t("common.success"));
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || t("dashboard.failedToDelete"));
    },
  });

  const batchDeleteMutation = trpc.links.batchDelete.useMutation({
    onSuccess: () => {
      toast.success(t("common.success"));
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "批量删除失败");
    },
  });

  const batchUpdateMutation = trpc.links.batchUpdate.useMutation({
    onSuccess: () => {
      toast.success(t("common.success"));
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "批量操作失败");
    },
  });

  const batchUpdateTagsMutation = trpc.links.batchUpdateTags.useMutation({
    onSuccess: () => {
      toast.success(t("common.success"));
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "批量标签操作失败");
    },
  });

  const batchImportMutation = trpc.links.batchImport.useMutation({
    onSuccess: () => {
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || t("dashboard.failedToImport"));
    },
  });

  const generateSeoMutation = trpc.links.generateSeo.useMutation({
    onError: (error: any) => {
      toast.error(error.message || t("dashboard.seoGenerateFailed"));
    },
  });

  // Actions
  const createLink = async (data: CreateLinkInput) => {
    await createLinkMutation.mutateAsync(data);
  };

  const updateLink = async (data: UpdateLinkInput) => {
    await updateLinkMutation.mutateAsync(data);
  };

  const deleteLink = async (linkId: number) => {
    await deleteLinkMutation.mutateAsync({ linkId });
  };

  const batchDelete = async (linkIds: number[]) => {
    if (linkIds.length === 0) return;
    if (!confirm(t("dashboard.confirmBatchDelete") || `确定删除选中的 ${linkIds.length} 项吗？`)) return;
    await batchDeleteMutation.mutateAsync({ linkIds });
  };

  const batchToggleStatus = async (linkIds: number[], isActive: number) => {
    if (linkIds.length === 0) return;
    await batchUpdateMutation.mutateAsync({
      linkIds,
      data: { isActive },
    });
  };

  const batchUpdateTags = async (linkIds: number[], tags: string[], mode: 'add' | 'remove' | 'set') => {
    if (linkIds.length === 0) return;
    await batchUpdateTagsMutation.mutateAsync({ linkIds, tags, mode });
  };

  const batchUpdateExpiry = async (linkIds: number[], expiresAt: string | null) => {
    if (linkIds.length === 0) return;
    await batchUpdateMutation.mutateAsync({
      linkIds,
      data: { expiresAt },
    });
  };

  const batchGenerateSeo = async (linkIds: number[], links: Link[]) => {
    if (linkIds.length === 0) return;
    toast.info(`开始分批处理 ${linkIds.length} 项 AI SEO 生成...`);

    let successCount = 0;
    for (const id of linkIds) {
      const link = links.find((l) => l.id === id);
      if (!link) continue;

      try {
        const seo = await generateSeoMutation.mutateAsync({ url: link.originalUrl });
        await updateLinkMutation.mutateAsync({
          linkId: id,
          seoTitle: (seo as any).seoTitle,
          seoDescription: (seo as any).seoDescription,
          originalUrl: link.originalUrl,
          shortCode: link.shortCode,
          tags: link.tags || [],
        });
        successCount++;
      } catch (e) {
        console.error(`Failed SEO for link ${id}`, e);
      }
    }

    toast.success(`批量 SEO 处理完成: 成功 ${successCount}/${linkIds.length}`);
    options.onSuccess?.();
  };

  const batchExport = (linkIds: number[], links: Link[]) => {
    if (linkIds.length === 0) return;
    const selectedLinks = links.filter((l) => linkIds.includes(l.id));

    // Generate CSV content
    const headers = ["Short Code", "Original URL", "Clicks", "Status", "Tags", "Expires At", "Created At", "Description"];
    const rows = selectedLinks.map((l) => [
      l.shortCode,
      l.originalUrl,
      l.clickCount,
      l.isActive ? "Active" : "Inactive",
      (l.tags || []).join("; "),
      l.expiresAt ? new Date(l.expiresAt).toLocaleString() : "",
      new Date(l.createdAt).toLocaleString(),
      l.description || "",
    ]);

    const csvContent = [headers, ...rows].map((e) => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `links_export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateSeo = async (url: string): Promise<SeoResult> => {
    const result = await generateSeoMutation.mutateAsync({ url });
    if ((result as any).success) {
      toast.success(t("dashboard.seoGenerated"));
    }
    return {
      success: (result as any).success,
      seoTitle: (result as any).seoTitle,
      seoDescription: (result as any).seoDescription,
    };
  };

  const exportLinks = async (format: "json" | "csv") => {
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

  const copyToClipboard = (link: Pick<Link, 'shortCode' | 'customDomain'>, defaultDomain?: string) => {
    let baseDomain = link.customDomain || defaultDomain || window.location.origin;
    if (!baseDomain.startsWith("http")) {
      baseDomain = `${window.location.protocol}//${baseDomain}`;
    }
    // 防止出现 //s/xx 或者带多余斜杠
    const cleanBaseDomain = baseDomain.replace(/\/+$/, "");
    const fullUrl = `${cleanBaseDomain}/s/${link.shortCode}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success(t("dashboard.copySuccess"));
  };

  return {
    // Mutations (for pending state)
    createLinkMutation,
    updateLinkMutation,
    deleteLinkMutation,
    batchDeleteMutation,
    batchImportMutation,
    generateSeoMutation,

    // Actions
    createLink,
    updateLink,
    deleteLink,
    batchDelete,
    batchToggleStatus,
    batchUpdateTags,
    batchUpdateExpiry,
    batchGenerateSeo,
    batchExport,
    generateSeo,
    exportLinks,
    copyToClipboard,

    // Utils
    checkShortCodes: utils.links.checkShortCodes,
  };
}
