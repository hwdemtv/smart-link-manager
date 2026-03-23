import { useState, useMemo, useCallback } from "react";

/**
 * useLinkPagination Hook
 * 管理分页状态和逻辑
 */

interface UseLinkPaginationOptions {
  totalItems: number;
  itemsPerPage?: number;
}

interface UseLinkPaginationReturn {
  // State
  currentPage: number;
  setCurrentPage: (page: number) => void;

  // Computed
  totalPages: number;
  startIndex: number;
  endIndex: number;

  // Navigation
  goToFirst: () => void;
  goToLast: () => void;
  next: () => void;
  prev: () => void;

  // Data slicing
  paginate: <T>(items: T[]) => T[];
}

export function useLinkPagination(options: UseLinkPaginationOptions): UseLinkPaginationReturn {
  const { totalItems, itemsPerPage = 10 } = options;

  const [currentPage, setCurrentPage] = useState(1);

  // Computed
  const totalPages = useMemo(() => Math.ceil(totalItems / itemsPerPage), [totalItems, itemsPerPage]);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  // Navigation
  const goToFirst = useCallback(() => setCurrentPage(1), []);
  const goToLast = useCallback(() => setCurrentPage(totalPages), [totalPages]);
  const next = useCallback(() => setCurrentPage((p) => Math.min(p + 1, totalPages)), [totalPages]);
  const prev = useCallback(() => setCurrentPage((p) => Math.max(p - 1, 1)), []);

  // Data slicing
  const paginate = useCallback(
    <T>(items: T[]): T[] => {
      return items.slice(startIndex, endIndex);
    },
    [startIndex, endIndex]
  );

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    endIndex,
    goToFirst,
    goToLast,
    next,
    prev,
    paginate,
  };
}
