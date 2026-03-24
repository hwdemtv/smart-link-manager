import { useState, useMemo } from "react";
import type { Link, StatusFilter } from "@/types/dashboard";

/**
 * useLinkFilters Hook
 * 管理搜索、标签、状态过滤逻辑
 */

interface UseLinkFiltersOptions {
  links: Link[] | undefined;
  selectedGroupId?: number | null | undefined;
}

interface UseLinkFiltersReturn {
  // State
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  tagFilter: string;
  setTagFilter: (tag: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (status: StatusFilter) => void;

  // Computed
  filteredLinks: Link[];
  uniqueTags: string[];

  // Actions
  resetFilters: () => void;
}

export function useLinkFilters(
  options: UseLinkFiltersOptions
): UseLinkFiltersReturn {
  const { links = [], selectedGroupId } = options;

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Computed: filtered links
  const filteredLinks = useMemo(() => {
    return links.filter(link => {
      // Search filter
      const matchesSearch =
        !searchQuery ||
        link.shortCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.originalUrl.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && link.isValid && link.isActive) ||
        (statusFilter === "invalid" && !link.isValid);

      // Tag filter
      const matchesTag =
        !tagFilter || (link.tags && link.tags.includes(tagFilter.trim()));

      // Group filter
      let matchesGroup = true;
      if (selectedGroupId === null) {
        // 未分组
        matchesGroup = !link.groupId;
      } else if (typeof selectedGroupId === "number") {
        // 特定分组
        matchesGroup = link.groupId === selectedGroupId;
      }
      // selectedGroupId === undefined 表示“全部链接”，不进行过滤

      return matchesSearch && matchesStatus && matchesTag && matchesGroup;
    });
  }, [links, searchQuery, statusFilter, tagFilter, selectedGroupId]);

  // Computed: unique tags
  const uniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    links.forEach(link => {
      link.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet);
  }, [links]);

  // Actions
  const resetFilters = () => {
    setSearchQuery("");
    setTagFilter("");
    setStatusFilter("all");
  };

  return {
    searchQuery,
    setSearchQuery,
    tagFilter,
    setTagFilter,
    statusFilter,
    setStatusFilter,
    filteredLinks,
    uniqueTags,
    resetFilters,
  };
}
