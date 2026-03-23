import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import React, { useState, useEffect, useRef } from "react";
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

// Hooks
import { useLinkMutations, useLinkFilters, useBatchSelection, useLinkPagination } from "@/hooks/dashboard";

// Types
import type { Link, LinkFormData, ParsedImportLink, PreviewLink, StatusFilter, CreateLinkInput, UpdateLinkInput } from "@/types/dashboard";

export default function Dashboard() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Data queries
  const linksQuery = trpc.links.list.useQuery();
  const domainsQuery = trpc.domains.list.useQuery();
  const utils = (trpc as any).useUtils();

  // Custom hooks
  const mutations = useLinkMutations({
    onSuccess: () => linksQuery.refetch(),
  });

  const {
    searchQuery,
    setSearchQuery,
    tagFilter,
    setTagFilter,
    statusFilter,
    setStatusFilter,
    filteredLinks,
    resetFilters,
  } = useLinkFilters({ links: linksQuery.data });

  const {
    selectedIds,
    setSelectedIds,
    hasSelection,
    count: selectedCount,
    toggle,
    deselectAll,
    togglePage,
  } = useBatchSelection();

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    endIndex,
    paginate,
  } = useLinkPagination({ totalItems: filteredLinks.length });

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

  // Import states
  const [importText, setImportText] = useState("");
  const [previewLinks, setPreviewLinks] = useState<PreviewLink[]>([]);

  // Reset pagination and selection when filters change
  useEffect(() => {
    setCurrentPage(1);
    deselectAll();
  }, [searchQuery, statusFilter, tagFilter]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "n" && !isCreateOpen && !isEditOpen && !isImportOpen && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
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
      tags: formData.tagsString ? formData.tagsString.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      seoTitle: formData.seoTitle || undefined,
      seoDescription: formData.seoDescription || undefined,
      seoImage: formData.seoImage || undefined,
    };
    await mutations.createLink(input);
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
      tags: formData.tagsString ? formData.tagsString.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      seoTitle: formData.seoTitle || null,
      seoDescription: formData.seoDescription || null,
      seoImage: formData.seoImage || null,
    };
    await mutations.updateLink(input);
    setIsEditOpen(false);
    setSelectedLink(null);
  };

  const handleDeleteLink = async () => {
    if (!selectedLink) return;
    await mutations.deleteLink(selectedLink.id);
    setIsDeleteOpen(false);
    setSelectedLink(null);
  };

  const handleBatchTagsConfirm = async (tags: string[], mode: 'add' | 'remove' | 'set') => {
    await mutations.batchUpdateTags(Array.from(selectedIds), tags, mode);
    setIsBatchTagsOpen(false);
    deselectAll();
  };

  const handleBatchExpiryConfirm = async (expiresAt: string | null) => {
    await mutations.batchUpdateExpiry(Array.from(selectedIds), expiresAt);
    setIsBatchExpiryOpen(false);
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
        links = parsed.map((item) => ({
          originalUrl: (typeof item === "string" ? item : item.url || item.originalUrl) as string,
          shortCode: item.shortCode || item.code,
          description: item.description || item.desc,
          tags: Array.isArray(item.tags) ? item.tags : (item.tags ? item.tags.split(';').map((t: string) => t.trim()).filter(Boolean) : []),
          expiresAt: item.expiresAt,
        }));
      }
    } catch {
      // Simple CSV/Text parsing
      const lines = importText.split("\n").map(l => l.trim()).filter(Boolean);
      const isCsv = lines[0].toLowerCase().includes("url") || lines[0].includes(",");
      
      if (isCsv && lines.length > 1) {
        // Simple CSV parser (supports headers)
        const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, '').toLowerCase());
        const dataLines = lines.slice(1);
        
        links = dataLines.map(line => {
          // Simple split by comma, respecting quotes
          const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          const row: any = {};
          headers.forEach((h, i) => {
            if (h.includes("url")) row.originalUrl = cells[i];
            else if (h.includes("code")) row.shortCode = cells[i];
            else if (h.includes("desc")) row.description = cells[i];
            else if (h.includes("tag")) row.tags = cells[i]?.split(';').map(t => t.trim()).filter(Boolean);
            else if (h.includes("expire")) row.expiresAt = cells[i];
          });
          return row;
        }).filter(l => l.originalUrl);
      } else {
        // Plain text list of URLs
        links = lines
          .filter((line) => line.startsWith("http"))
          .map((line) => ({ originalUrl: line }));
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
        codeCountMap.set(link.shortCode, (codeCountMap.get(link.shortCode) || 0) + 1);
      }
      if (link.originalUrl) {
        if (!urlInternalMap.has(link.originalUrl)) urlInternalMap.set(link.originalUrl, []);
        urlInternalMap.get(link.originalUrl)!.push(idx + 1);
      }
    });

    const allExistingLinks = linksQuery.data || [];

    const linksWithInternalCheck: PreviewLink[] = links.map((link, idx) => {
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
        const otherRows = internalIndices.filter((i) => i !== idx + 1);
        warningReason = t("dashboard.sameTargetBatch", { rows: otherRows.join(", ") });
      } else {
        const existing = allExistingLinks.find((l: Link) => l.originalUrl === link.originalUrl);
        if (existing) {
          hasWarning = true;
          warningReason = t("dashboard.sameTargetSystem", { shortCode: existing.shortCode });
        }
      }

      return { ...link, hasConflict, conflictReason, hasWarning, warningReason };
    });

    // Cloud validation
    const codesToCheck = linksWithInternalCheck.filter((l) => l.shortCode && !l.hasConflict).map((l) => l.shortCode!);

    let finalLinks = linksWithInternalCheck;
    if (codesToCheck.length > 0) {
      try {
        const existingCodes = await utils.links.checkShortCodes.fetch({ shortCodes: codesToCheck });
        const existingSet = new Set(existingCodes);
        finalLinks = linksWithInternalCheck.map((link) => {
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
      const result = await mutations.batchImportMutation.mutateAsync({ links: previewLinks });
      toast.success(t("dashboard.importSuccess", { count: result.success.length }));
      setIsImportPreviewOpen(false);
      setPreviewLinks([]);
      setImportText("");
      linksQuery.refetch();
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
  const paginatedLinks = paginate(filteredLinks);
  const linkIds = paginatedLinks.map((l) => l.id);
  const hasFilters = Boolean(searchQuery || tagFilter || statusFilter !== "all");

  return (
    <div className="min-h-content bg-background">
      {/* Header */}
      <DashboardHeader
        onCreateClick={() => setIsCreateOpen(true)}
        onImportClick={() => setIsImportOpen(true)}
        onExportClick={(format) => mutations.exportLinks(format)}
      />

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
          links={paginatedLinks}
          isLoading={linksQuery.isLoading}
          selectedIds={selectedIds}
          onToggleSelect={toggle}
          onTogglePage={(checked) => togglePage(linkIds, checked)}
          onEdit={openEditDialog}
          onDelete={openDeleteDialog}
          onCopy={mutations.copyToClipboard}
          onTagClick={setTagFilter}
          onQrCode={(shortCode) => setLocation(`/qr/${shortCode}`)}
          onCreateClick={() => setIsCreateOpen(true)}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredLinks.length}
          startIndex={startIndex}
          endIndex={endIndex}
          hasFilters={hasFilters}
          onClearFilters={resetFilters}
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
          onGenerateSeo={() => mutations.batchGenerateSeo(Array.from(selectedIds), linksQuery.data || [])}
          onExport={() => mutations.batchExport(Array.from(selectedIds), linksQuery.data || [])}
          onDelete={() => mutations.batchDelete(Array.from(selectedIds))}
          onClear={deselectAll}
          onBatchTags={() => setIsBatchTagsOpen(true)}
          onBatchExpiry={() => setIsBatchExpiryOpen(true)}
        />
      )}

      {/* Create Dialog */}
      <LinkFormDialog
        mode="create"
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        domains={domainsQuery.data || []}
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
        isSubmitting={mutations.updateLinkMutation.isPending} /* We can just use the generic isPending or none */
      />

      <BatchExpiryDialog
        open={isBatchExpiryOpen}
        onOpenChange={setIsBatchExpiryOpen}
        selectedCount={selectedCount}
        onConfirm={handleBatchExpiryConfirm}
        isSubmitting={mutations.updateLinkMutation.isPending}
      />
    </div>
  );
}
