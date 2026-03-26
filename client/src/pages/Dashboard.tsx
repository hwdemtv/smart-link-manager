import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { toast } from "sonner";

// Components
import {
  DashboardHeader,
  SearchFilterBar,
  LinksTable,
  BatchActionBar,
  LinkFormDialog,
  ImportLinksDialog,
  ImportPreviewDialog,
  DeleteConfirmDialog,
  BatchTagsDialog,
  BatchExpiryDialog,
} from "@/components/dashboard";
import { RecycleBinDialog } from "@/components/dashboard/RecycleBinDialog";
import { MoveToGroupDialog } from "@/components/dashboard/MoveToGroupDialog";
import { GroupSidebar } from "@/components/dashboard/GroupSidebar";
import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard";

// Hooks
import {
  useLinkMutations,
  useBatchSelection,
} from "@/hooks/dashboard";

// Types
import type {
  Link,
  LinkFormData,
  ParsedImportLink,
  PreviewLink,
  StatusFilter,
  CreateLinkInput,
  UpdateLinkInput,
} from "@/types/dashboard";

// Constants
const PAGE_SIZE = 15;

export default function Dashboard() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Filter states (now used for API params)
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null | undefined>(undefined);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [tagFilter, statusFilter, selectedGroupId]);

  // Data queries - Server-side pagination
  const linksQuery = trpc.links.search.useQuery({
    query: debouncedSearchQuery || undefined,
    tag: tagFilter || undefined,
    status: statusFilter,
    groupId: selectedGroupId,
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
  });

  const domainsQuery = trpc.domains.list.useQuery();
  const groupsQuery = trpc.groups.list.useQuery();
  const systemConfigQuery = trpc.configs.getConfig.useQuery();

  // Computed values from server response
  const links = linksQuery.data?.links ?? [];
  const totalItems = linksQuery.data?.total ?? 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(currentPage * PAGE_SIZE, totalItems);

  // Custom hooks
  const mutations = useLinkMutations({
    onSuccess: () => {
      utils.links.search.invalidate();
      utils.links.count.invalidate();
    },
  });

  const {
    selectedIds,
    setSelectedIds,
    hasSelection,
    count: selectedCount,
    toggle,
    deselectAll,
    togglePage,
  } = useBatchSelection();

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<Link | null>(null);

  // Batch action states
  const [isBatchTagsOpen, setIsBatchTagsOpen] = useState(false);
  const [isBatchExpiryOpen, setIsBatchExpiryOpen] = useState(false);
  const [isMoveToGroupOpen, setIsMoveToGroupOpen] = useState(false);

  // Recycle bin state
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);

  // Import states
  const [importText, setImportText] = useState("");
  const [previewLinks, setPreviewLinks] = useState<PreviewLink[]>([]);

  // Reset selection when page changes
  useEffect(() => {
    deselectAll();
  }, [currentPage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (
        e.key === "n" &&
        !isCreateOpen &&
        !isEditOpen &&
        !isImportOpen &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        setIsCreateOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreateOpen, isEditOpen, isImportOpen]);

  // Handlers
  const handleCreateLink = async (formData: LinkFormData) => {
    if (!formData.originalUrl || !formData.shortCode) {
      toast.error(t("dashboard.requiredFields"));
      return;
    }
    const input: CreateLinkInput = {
      originalUrl: formData.originalUrl,
      shortCode: formData.shortCode,
      customDomain: formData.customDomain || undefined,
      description: formData.description,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined,
      password: formData.password || undefined,
      tags: formData.tagsString
        ? formData.tagsString
            .split(",")
            .map(tag => tag.trim())
            .filter(Boolean)
        : [],
      seoTitle: formData.seoTitle || undefined,
      seoDescription: formData.seoDescription || undefined,
      seoImage: formData.seoImage || undefined,
      abTestEnabled: formData.abTestEnabled,
      abTestUrl: formData.abTestUrl || undefined,
      abTestRatio: formData.abTestRatio,
      groupId: formData.groupId,
    };
    await mutations.createLink(input);
    utils.groups.list.invalidate();
    setIsCreateOpen(false);
  };

  const handleEditLink = async (formData: LinkFormData) => {
    if (!selectedLink) return;
    const input: UpdateLinkInput = {
      linkId: selectedLink.id,
      originalUrl: formData.originalUrl,
      shortCode: formData.shortCode,
      description: formData.description || null,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : null,
      password: formData.password || null,
      tags: formData.tagsString
        ? formData.tagsString
            .split(",")
            .map(tag => tag.trim())
            .filter(Boolean)
        : [],
      seoTitle: formData.seoTitle || null,
      seoDescription: formData.seoDescription || null,
      seoImage: formData.seoImage || null,
      abTestEnabled: formData.abTestEnabled,
      abTestUrl: formData.abTestUrl || null,
      abTestRatio: formData.abTestRatio,
      groupId: formData.groupId,
    };
    await mutations.updateLink(input);
    utils.groups.list.invalidate();
    setIsEditOpen(false);
    setSelectedLink(null);
  };

  const handleDeleteLink = async () => {
    if (!selectedLink) return;
    await mutations.deleteLink(selectedLink.id);
    setIsDeleteOpen(false);
    setSelectedLink(null);
  };

  const handleBatchTagsConfirm = async (
    tags: string[],
    mode: "add" | "remove" | "set"
  ) => {
    await mutations.batchUpdateTags(Array.from(selectedIds), tags, mode);
    setIsBatchTagsOpen(false);
    deselectAll();
  };

  const handleBatchExpiryConfirm = async (expiresAt: string | null) => {
    await mutations.batchUpdateExpiry(Array.from(selectedIds), expiresAt);
    setIsBatchExpiryOpen(false);
    deselectAll();
  };

  const handleMoveToGroupConfirm = async (groupId: number | null) => {
    await mutations.batchMoveToGroup(Array.from(selectedIds), groupId);
    // 刷新分组列表以更新链接计数
    utils.groups.list.invalidate();
    setIsMoveToGroupOpen(false);
    deselectAll();
  };

  const handleBatchImport = async () => {
    if (!importText.trim()) {
      toast.error(t("dashboard.importDescription"));
      return;
    }

    let links: ParsedImportLink[] = [];

    try {
      const parsed = JSON.parse(importText);
      if (Array.isArray(parsed)) {
        links = parsed.map(item => ({
          originalUrl: (typeof item === "string"
            ? item
            : item.url || item.originalUrl) as string,
          shortCode: item.shortCode || item.code,
          description: item.description || item.desc,
          tags: Array.isArray(item.tags)
            ? item.tags
            : item.tags
              ? item.tags
                  .split(";")
                  .map((t: string) => t.trim())
                  .filter(Boolean)
              : [],
          expiresAt: item.expiresAt,
        }));
      }
    } catch {
      // Simple CSV/Text parsing
      const lines = importText
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);
      const isCsv =
        lines[0].toLowerCase().includes("url") || lines[0].includes(",");

      if (isCsv && lines.length > 1) {
        // Simple CSV parser (supports headers)
        const headers = lines[0]
          .split(",")
          .map(h => h.trim().replace(/"/g, "").toLowerCase());
        const dataLines = lines.slice(1);

        links = dataLines
          .map(line => {
            // Simple split by comma, respecting quotes
            const cells = line
              .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
              .map(c => c.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
            const row: any = {};
            headers.forEach((h, i) => {
              if (h.includes("url")) row.originalUrl = cells[i];
              else if (h.includes("code")) row.shortCode = cells[i];
              else if (h.includes("desc")) row.description = cells[i];
              else if (h.includes("tag"))
                row.tags = cells[i]
                  ?.split(";")
                  .map(t => t.trim())
                  .filter(Boolean);
              else if (h.includes("expire")) row.expiresAt = cells[i];
            });
            return row;
          })
          .filter(l => l.originalUrl);
      } else {
        // Plain text list of URLs
        links = lines
          .filter(line => line.startsWith("http"))
          .map(line => ({ originalUrl: line }));
      }
    }

    if (links.length === 0) {
      toast.error(t("dashboard.noValidLinks"));
      return;
    }

    // Internal validation
    const codeCountMap = new Map<string, number>();
    const urlInternalMap = new Map<string, number[]>();

    links.forEach((link, idx) => {
      if (link.shortCode) {
        codeCountMap.set(
          link.shortCode,
          (codeCountMap.get(link.shortCode) || 0) + 1
        );
      }
      if (link.originalUrl) {
        if (!urlInternalMap.has(link.originalUrl))
          urlInternalMap.set(link.originalUrl, []);
        urlInternalMap.get(link.originalUrl)!.push(idx + 1);
      }
    });

    // Batch validation: check short codes and URLs against database
    const codesToCheck = links
      .filter(l => l.shortCode && !(codeCountMap.get(l.shortCode!)! > 1))
      .map(l => l.shortCode!)
      .filter((c): c is string => Boolean(c));

    // Cloud validation for short codes
    let existingCodesSet = new Set<string>();
    if (codesToCheck.length > 0) {
      try {
        const existingCodes = await utils.links.checkShortCodes.fetch({
          shortCodes: codesToCheck,
        });
        existingCodesSet = new Set(existingCodes);
      } catch (error) {
        console.error("Failed to check existing short codes:", error);
      }
    }

    const linksWithValidation: PreviewLink[] = links.map((link, idx) => {
      let hasConflict = false;
      let conflictReason = "";
      let hasWarning = false;
      let warningReason = "";

      // Check for duplicate short codes in batch
      if (link.shortCode && codeCountMap.get(link.shortCode)! > 1) {
        hasConflict = true;
        conflictReason = t("dashboard.duplicateEntry");
      }
      // Check if short code already exists in database
      else if (link.shortCode && existingCodesSet.has(link.shortCode)) {
        hasConflict = true;
        conflictReason = t("dashboard.shortCodeTaken");
      }

      // Check for duplicate URLs in batch
      const internalIndices = urlInternalMap.get(link.originalUrl);
      if (internalIndices && internalIndices.length > 1) {
        hasWarning = true;
        const otherRows = internalIndices.filter(i => i !== idx + 1);
        warningReason = t("dashboard.sameTargetBatch", {
          rows: otherRows.join(", "),
        });
      }

      return {
        ...link,
        hasConflict,
        conflictReason,
        hasWarning,
        warningReason,
      };
    });

    setPreviewLinks(linksWithValidation);
    setIsImportOpen(false);
    setIsImportPreviewOpen(true);
  };

  const handleConfirmImport = async () => {
    try {
      const result = await mutations.batchImportMutation.mutateAsync({
        links: previewLinks,
      });
      toast.success(
        t("dashboard.importSuccess", { count: result.success.length })
      );
      setIsImportPreviewOpen(false);
      setPreviewLinks([]);
      setImportText("");
      utils.links.search.invalidate();
      utils.links.count.invalidate();
      utils.groups.list.invalidate();
    } catch (error: any) {
      toast.error(error.message || t("dashboard.failedToImport"));
    }
  };

  const openEditDialog = (link: Link) => {
    setSelectedLink(link);
    setIsEditOpen(true);
  };

  const openDeleteDialog = (link: Link) => {
    setSelectedLink(link);
    setIsDeleteOpen(true);
  };

  // Computed
  const linkIds = links.map((l: Link) => l.id);
  const hasFilters = Boolean(
    searchQuery || tagFilter || statusFilter !== "all"
  );

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setTagFilter("");
    setStatusFilter("all");
    setSelectedGroupId(undefined);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <DashboardHeader
        onCreateClick={() => setIsCreateOpen(true)}
        onImportClick={() => setIsImportOpen(true)}
        onExportClick={format => mutations.exportLinks(format)}
        onRecycleBinClick={() => setIsRecycleBinOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Group Sidebar */}
        <GroupSidebar
          selectedGroupId={selectedGroupId}
          onGroupSelect={setSelectedGroupId}
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Search & Filter */}
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            tagFilter={tagFilter}
            onTagChange={setTagFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            searchInputRef={searchInputRef}
          />

          {/* Links Table */}
          <div className="container pb-8">
            <LinksTable
              links={links}
              isLoading={linksQuery.isLoading}
              selectedIds={selectedIds}
              onToggleSelect={toggle}
              onTogglePage={checked => togglePage(linkIds, checked)}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
              onCopy={(link: Link) =>
                mutations.copyToClipboard(
                  link,
                  systemConfigQuery.data?.defaultDomain
                )
              }
              onTagClick={setTagFilter}
              onQrCode={shortCode => setLocation(`/qr/${shortCode}`)}
              onCreateClick={() => setIsCreateOpen(true)}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalItems}
              startIndex={startIndex}
              endIndex={endIndex}
              hasFilters={hasFilters}
              onClearFilters={resetFilters}
              onCheck={mutations.checkLinkValidity}
              checkingLinkId={mutations.checkValidityMutation.isPending ? mutations.checkValidityMutation.variables?.linkId : null}
            />
          </div>

          {/* Batch Action Bar */}
          {hasSelection && (
            <BatchActionBar
              selectedCount={selectedCount}
              onEnable={() => {
                mutations.batchToggleStatus(Array.from(selectedIds), 1);
                deselectAll();
              }}
              onDisable={() => {
                mutations.batchToggleStatus(Array.from(selectedIds), 0);
                deselectAll();
              }}
              onGenerateSeo={() =>
                mutations.batchGenerateSeo(
                  Array.from(selectedIds),
                  links
                )
              }
              onExport={() =>
                mutations.batchExport(
                  Array.from(selectedIds),
                  links
                )
              }
              onDelete={() => mutations.batchDelete(Array.from(selectedIds))}
              onClear={deselectAll}
              onBatchTags={() => setIsBatchTagsOpen(true)}
              onBatchExpiry={() => setIsBatchExpiryOpen(true)}
              onMoveToGroup={() => setIsMoveToGroupOpen(true)}
              onCheck={() => {
                mutations.batchCheckLinkValidity(Array.from(selectedIds));
                deselectAll();
              }}
              isChecking={mutations.batchCheckValidityMutation.isPending}
            />
          )}

          {/* Create Dialog */}
          <LinkFormDialog
            mode="create"
            open={isCreateOpen}
            onOpenChange={setIsCreateOpen}
            domains={domainsQuery.data || []}
            groups={groupsQuery.data || []}
            onSubmit={handleCreateLink}
            isSubmitting={mutations.createLinkMutation.isPending}
            onGenerateSeo={mutations.generateSeo}
            isGeneratingSeo={mutations.generateSeoMutation.isPending}
          />

          {/* Edit Dialog */}
          <LinkFormDialog
            mode="edit"
            open={isEditOpen}
            onOpenChange={setIsEditOpen}
            initialData={selectedLink || undefined}
            domains={domainsQuery.data || []}
            groups={groupsQuery.data || []}
            onSubmit={handleEditLink}
            isSubmitting={mutations.updateLinkMutation.isPending}
            onGenerateSeo={mutations.generateSeo}
            isGeneratingSeo={mutations.generateSeoMutation.isPending}
          />

          {/* Delete Dialog */}
          <DeleteConfirmDialog
            open={isDeleteOpen}
            onOpenChange={setIsDeleteOpen}
            onConfirm={handleDeleteLink}
            shortCode={selectedLink?.shortCode}
            isDeleting={mutations.deleteLinkMutation.isPending}
          />

          {/* Import Dialog */}
          <ImportLinksDialog
            open={isImportOpen}
            onOpenChange={setIsImportOpen}
            importText={importText}
            onImportTextChange={setImportText}
            onPreview={handleBatchImport}
            isImporting={mutations.batchImportMutation.isPending}
          />

          {/* Import Preview Dialog */}
          <ImportPreviewDialog
            open={isImportPreviewOpen}
            onOpenChange={setIsImportPreviewOpen}
            previewLinks={previewLinks}
            onConfirm={handleConfirmImport}
            onBack={() => {
              setIsImportPreviewOpen(false);
              setIsImportOpen(true);
            }}
            isImporting={mutations.batchImportMutation.isPending}
          />

          {/* Batch Dialogs */}
          <BatchTagsDialog
            open={isBatchTagsOpen}
            onOpenChange={setIsBatchTagsOpen}
            selectedCount={selectedCount}
            onConfirm={handleBatchTagsConfirm}
            isSubmitting={
              mutations.updateLinkMutation.isPending
            } /* We can just use the generic isPending or none */
          />

          <BatchExpiryDialog
            open={isBatchExpiryOpen}
            onOpenChange={setIsBatchExpiryOpen}
            selectedCount={selectedCount}
            onConfirm={handleBatchExpiryConfirm}
            isSubmitting={mutations.updateLinkMutation.isPending}
          />

          <MoveToGroupDialog
            open={isMoveToGroupOpen}
            onOpenChange={setIsMoveToGroupOpen}
            selectedCount={selectedCount}
            groups={groupsQuery.data || []}
            onConfirm={handleMoveToGroupConfirm}
            isSubmitting={mutations.batchDeleteMutation.isPending}
          />

          {/* Recycle Bin Dialog */}
          <RecycleBinDialog
            open={isRecycleBinOpen}
            onOpenChange={setIsRecycleBinOpen}
            onRestored={() => {
              utils.links.search.invalidate();
              utils.links.count.invalidate();
            }}
          />
        </div>
      </div>
    </div>
  );
}
