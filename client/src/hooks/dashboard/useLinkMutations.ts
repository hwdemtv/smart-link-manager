import { trpc } from "@/lib/trpc";
import { copyToClipboard as copyText } from "@/lib/clipboard";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { handleTrpcError } from "@/lib/errorUtils";
import type {
  Link,
  CreateLinkInput,
  UpdateLinkInput,
  SeoResult,
} from "@/types/dashboard";

/**
 * useLinkMutations Hook
 * 封装所有链接相关的 tRPC mutations
 */

interface UseLinkMutationsOptions {
  onSuccess?: () => void;
}

export function useLinkMutations(options: UseLinkMutationsOptions = {}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // Mutations
  const createLinkMutation = trpc.links.create.useMutation({
    onSuccess: () => {
      toast.success(t("common.success"));
      utils.groups.list.invalidate();
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(handleTrpcError(t, error));
    },
  });

  const updateLinkMutation = trpc.links.update.useMutation({
    onSuccess: () => {
      toast.success(t("common.success"));
      utils.groups.list.invalidate();
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(handleTrpcError(t, error));
    },
  });

  const deleteLinkMutation = trpc.links.softDelete.useMutation({
    onSuccess: () => {
      toast.success(t("dashboard.movedToRecycleBin") || "已移至回收站");
      utils.groups.list.invalidate();
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(handleTrpcError(t, error));
    },
  });

  const batchDeleteMutation = trpc.links.batchDelete.useMutation({
    onSuccess: () => {
      toast.success(t("common.success"));
      utils.groups.list.invalidate();
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(handleTrpcError(t, error));
    },
  });

  const batchUpdateMutation = trpc.links.batchUpdate.useMutation({
    onSuccess: () => {
      toast.success(t("common.success"));
      utils.groups.list.invalidate();
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(handleTrpcError(t, error));
    },
  });

  const batchUpdateTagsMutation = trpc.links.batchUpdateTags.useMutation({
    onSuccess: () => {
      toast.success(t("common.success"));
      utils.groups.list.invalidate();
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(handleTrpcError(t, error));
    },
  });

  const batchImportMutation = trpc.links.batchImport.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      options.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(handleTrpcError(t, error));
    },
  });

  const generateSeoMutation = trpc.links.generateSeo.useMutation({
    onError: (error: any) => {
      toast.error(handleTrpcError(t, error));
    },
  });
  
  const checkValidityMutation = trpc.links.checkValidity.useMutation({
    onSuccess: (data: any) => {
      if (data.isValid) {
        toast.success(t("dashboard.linkValid") || "链接有效");
      } else {
        toast.error(t("dashboard.linkInvalid") || "链接已失效");
      }
      utils.links.invalidate();
    },
    onError: (error: any) => {
      toast.error(handleTrpcError(t, error));
    },
  });

  const batchCheckValidityMutation = trpc.links.batchCheckValidity.useMutation({
    onSuccess: () => {
      toast.success(t("dashboard.batchCheckSuccess") || "批量检查完成");
      utils.links.invalidate();
    },
    onError: (error: any) => {
      toast.error(handleTrpcError(t, error));
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
    if (
      !confirm(
        t("dashboard.confirmBatchDelete", { count: linkIds.length })
      )
    )
      return;
    await batchDeleteMutation.mutateAsync({ linkIds });
  };

  const batchToggleStatus = async (linkIds: number[], isActive: number) => {
    if (linkIds.length === 0) return;
    await batchUpdateMutation.mutateAsync({
      linkIds,
      data: { isActive },
    });
  };

  const batchUpdateTags = async (
    linkIds: number[],
    tags: string[],
    mode: "add" | "remove" | "set"
  ) => {
    if (linkIds.length === 0) return;
    await batchUpdateTagsMutation.mutateAsync({ linkIds, tags, mode });
  };

  const batchUpdateExpiry = async (
    linkIds: number[],
    expiresAt: string | null
  ) => {
    if (linkIds.length === 0) return;
    await batchUpdateMutation.mutateAsync({
      linkIds,
      data: { expiresAt },
    });
  };

  const batchMoveToGroup = async (
    linkIds: number[],
    groupId: number | null
  ) => {
    if (linkIds.length === 0) return;
    await batchUpdateMutation.mutateAsync({
      linkIds,
      data: { groupId },
    });
  };

  const batchGenerateSeo = async (linkIds: number[], links: Link[]) => {
    if (linkIds.length === 0) return;

    const total = linkIds.length;
    let processedCount = 0;
    let successCount = 0;

    const toastId = toast.loading(`正在分流处理 AI SEO (${processedCount}/${total})...`);

    const CONCURRENCY_LIMIT = 3;
    const queue = [...linkIds];

    const worker = async () => {
      while (queue.length > 0) {
        const id = queue.shift();
        if (id === undefined) break;

        const link = links.find(l => l.id === id);
        if (!link) {
          processedCount++;
          continue;
        }

        try {
          const seo = await generateSeoMutation.mutateAsync({
            url: link.originalUrl,
            description: link.description || undefined,
          });
          await updateLinkMutation.mutateAsync({
            linkId: id,
            seoTitle: seo.seoTitle,
            seoDescription: seo.seoDescription,
            originalUrl: link.originalUrl,
            shortCode: link.shortCode,
            tags: link.tags || [],
          });
          successCount++;
        } catch (e) {
          console.error(`Failed SEO for link ${id}`, e);
        } finally {
          processedCount++;
          toast.loading(`正在处理 AI SEO (${processedCount}/${total})...`, { id: toastId });
        }
      }
    };

    // 启动并发 Worker
    const workers = Array(Math.min(CONCURRENCY_LIMIT, total))
      .fill(null)
      .map(worker);
    await Promise.all(workers);

    toast.success(`批量 SEO 处理完成: 成功 ${successCount}/${total}`, { id: toastId });
    utils.groups.list.invalidate();
    options.onSuccess?.();
  };

  const batchExport = (linkIds: number[], links: Link[]) => {
    if (linkIds.length === 0) return;
    const selectedLinks = links.filter(l => linkIds.includes(l.id));

    // Generate CSV content
    const headers = [
      "Short Code",
      "Original URL",
      "Clicks",
      "Status",
      "Tags",
      "Expires At",
      "Created At",
      "Description",
    ];
    const rows = selectedLinks.map(l => [
      l.shortCode,
      l.originalUrl,
      l.clickCount,
      l.isActive ? "Active" : "Inactive",
      (l.tags || []).join("; "),
      l.expiresAt ? new Date(l.expiresAt).toLocaleString() : "",
      new Date(l.createdAt).toLocaleString(),
      l.description || "",
    ]);

    const csvContent = [headers, ...rows]
      .map(e =>
        e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `links_export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateSeo = async (
    url: string,
    description?: string
  ): Promise<SeoResult> => {
    const result = await generateSeoMutation.mutateAsync({ url, description });
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
    const CHUNK_SIZE = 1000;
    const toastId = toast.loading(t("dashboard.exporting"));

    try {
      let total = 0;
      let offset = 0;
      let hasMore = true;
      
      // 增量缓冲区
      let csvContent = "";
      let jsonContent: any[] = []; // JSON 仍然需要数组，但我们可以考虑每 5000 条输出一个文件或仅保持这一处

      // CSV Headers
      const headers = [
        "Short Code", "Original URL", "Clicks", "Status", "Tags", "Expires At", "Created At", "Description"
      ];
      if (format === "csv") {
        csvContent = "\ufeff" + headers.map(h => `"${h}"`).join(",") + "\n";
      }

      while (hasMore) {
        const result = await (utils.links.search as any).fetch({
          limit: CHUNK_SIZE,
          offset: offset,
          orderBy: "createdAt",
          order: "desc",
        });

        if (!result || !result.links || result.links.length === 0) break;

        total = result.total;
        offset += result.links.length;

        if (format === "csv") {
          const chunkRows = result.links.map((l: any) => [
            l.shortCode,
            l.originalUrl,
            l.clickCount,
            l.isActive ? "Active" : "Inactive",
            (l.tags || []).join("; "),
            l.expiresAt ? new Date(l.expiresAt).toLocaleString() : "",
            new Date(l.createdAt).toLocaleString(),
            l.description || "",
          ].map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
          
          csvContent += chunkRows + "\n";
        } else {
          jsonContent = jsonContent.concat(result.links);
        }

        // 更新进度
        toast.loading(`${t("dashboard.exporting")} (${offset}/${total})...`, {
          id: toastId,
        });

        if (offset >= total || result.links.length < CHUNK_SIZE) {
          hasMore = false;
        }
      }

      if (offset === 0) {
        toast.error(t("dashboard.noValidLinks"), { id: toastId });
        return;
      }

      const fileName = `links-export-${new Date().toISOString().split("T")[0]}.${format}`;
      const blob = format === "json" 
        ? new Blob([JSON.stringify(jsonContent, null, 2)], { type: "application/json" })
        : new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(t("dashboard.exportSuccess"), { id: toastId });
    } catch (error: any) {
      toast.error(handleTrpcError(t, error), { id: toastId });
    }
  };

  const checkLinkValidity = async (linkId: number) => {
    await checkValidityMutation.mutateAsync({ linkId });
  };

  const batchCheckLinkValidity = async (linkIds: number[]) => {
    if (linkIds.length === 0) return;
    const toastId = toast.loading(t("dashboard.checking") || "正在检查...");
    try {
      await batchCheckValidityMutation.mutateAsync({ linkIds });
      toast.dismiss(toastId);
    } catch (e) {
      toast.dismiss(toastId);
    }
  };

  const copyToClipboard = async (
    link: Pick<Link, "shortCode" | "customDomain">,
    defaultDomain?: string
  ) => {
    let baseDomain =
      link.customDomain || defaultDomain || window.location.origin;
    if (!baseDomain.startsWith("http")) {
      baseDomain = `${window.location.protocol}//${baseDomain}`;
    }
    // 防止出现 //s/xx 或者带多余斜杠
    const cleanBaseDomain = baseDomain.replace(/\/+$/, "");
    const fullUrl = `${cleanBaseDomain}/s/${link.shortCode}`;
    const success = await copyText(fullUrl);
    if (success) {
      toast.success(t("dashboard.copySuccess"));
    } else {
      toast.error(t("dashboard.copyFailed", "复制失败，请手动复制"));
    }
  };

  return {
    // Mutations (for pending state)
    createLinkMutation,
    updateLinkMutation,
    deleteLinkMutation,
    batchDeleteMutation,
    batchImportMutation,
    generateSeoMutation,
    checkValidityMutation,
    batchCheckValidityMutation,

    // Actions
    createLink,
    updateLink,
    deleteLink,
    batchDelete,
    batchToggleStatus,
    batchUpdateTags,
    batchUpdateExpiry,
    batchMoveToGroup,
    batchGenerateSeo,
    batchExport,
    generateSeo,
    exportLinks,
    copyToClipboard,
    checkLinkValidity,
    batchCheckLinkValidity,

    // Utils
    checkShortCodes: utils.links.checkShortCodes,
  };
}
