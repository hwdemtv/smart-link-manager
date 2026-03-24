import { useState, useCallback } from "react";

/**
 * useBatchSelection Hook
 * 管理批量选择状态和操作
 */

interface UseBatchSelectionReturn {
  // State
  selectedIds: Set<number>;
  setSelectedIds: (ids: Set<number>) => void;

  // Computed
  hasSelection: boolean;
  count: number;

  // Actions
  toggle: (id: number) => void;
  selectAll: (ids: number[]) => void;
  deselectAll: () => void;
  togglePage: (ids: number[], checked: boolean) => void;
}

export function useBatchSelection(): UseBatchSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Computed
  const hasSelection = selectedIds.size > 0;
  const count = selectedIds.size;

  // Actions
  const toggle = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const togglePage = useCallback((ids: number[], checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        ids.forEach(id => next.add(id));
      } else {
        ids.forEach(id => next.delete(id));
      }
      return next;
    });
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    hasSelection,
    count,
    toggle,
    selectAll,
    deselectAll,
    togglePage,
  };
}
