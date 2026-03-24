import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SearchFilterBarProps } from "@/types/dashboard";

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  tagFilter,
  onTagChange,
  statusFilter,
  onStatusChange,
  searchInputRef,
}: SearchFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className="container pb-4">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search Input */}
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            ref={searchInputRef}
            placeholder={
              t("dashboard.searchPlaceholder") || "搜索链接、短码..."
            }
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-10 pr-10 border-border/60 focus-visible:ring-primary/20"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
              title={t("common.clear") || "清空"}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {!searchQuery && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block">
              <kbd className="h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 flex">
                /
              </kbd>
            </div>
          )}
        </div>

        {/* Tag Filter */}
        <Input
          placeholder={t("dashboard.filterByTag")}
          value={tagFilter}
          onChange={e => onTagChange(e.target.value)}
          className="w-full sm:w-48"
        />

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={e => onStatusChange(e.target.value as any)}
          className="px-4 py-2 border border-border rounded-md bg-background text-foreground"
        >
          <option value="all">{t("dashboard.allStatus")}</option>
          <option value="active">{t("dashboard.activeOnly")}</option>
          <option value="invalid">{t("dashboard.invalidOnly")}</option>
        </select>
      </div>
    </div>
  );
}
