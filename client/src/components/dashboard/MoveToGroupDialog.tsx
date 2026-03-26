import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderMinus, Search, X, Clock } from "lucide-react";

// 使用特殊标识表示"移出分组"
const UNGROUPED_VALUE = "ungrouped";
const RECENT_GROUPS_KEY = "slm_recent_groups";
const MAX_RECENT_GROUPS = 3;
const GROUP_SEARCH_THRESHOLD = 10;

interface MoveToGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  groups: Array<{ id: number; name: string; color: string }>;
  onConfirm: (groupId: number | null) => Promise<void>;
  isSubmitting: boolean;
}

export function MoveToGroupDialog({
  open,
  onOpenChange,
  selectedCount,
  groups,
  onConfirm,
  isSubmitting,
}: MoveToGroupDialogProps) {
  const { t } = useTranslation();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // 获取最近使用的分组
  const recentGroupIds = useMemo(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(RECENT_GROUPS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, [open]);

  // 最近使用的分组
  const recentGroups = useMemo(() => {
    if (!groups || recentGroupIds.length === 0) return [];
    return recentGroupIds
      .map((id: number) => groups.find(g => g.id === id))
      .filter(Boolean);
  }, [groups, recentGroupIds]);

  // 过滤分组
  const filteredGroups = useMemo(() => {
    if (!groups || !searchQuery.trim()) return groups;
    const query = searchQuery.toLowerCase();
    return groups.filter(g => g.name.toLowerCase().includes(query));
  }, [groups, searchQuery]);

  // 是否显示搜索栏
  const showSearch = (groups?.length || 0) > GROUP_SEARCH_THRESHOLD;

  useEffect(() => {
    if (!open) {
      setSelectedGroupId("");
      setSearchQuery("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const groupId = selectedGroupId === UNGROUPED_VALUE ? null : Number(selectedGroupId);
    await onConfirm(groupId);
  };

  const handleSelectGroup = (value: string) => {
    setSelectedGroupId(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("dashboard.moveToGroupTitle", { count: selectedCount })}
          </DialogTitle>
          <DialogDescription>
            {t("dashboard.moveToGroupDesc")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* 搜索栏 */}
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t("groups.searchPlaceholder")}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("dashboard.targetGroup")}</Label>
            <ScrollArea className="h-[280px] border rounded-md">
              <div className="p-2 space-y-1">
                {/* 移出分组选项 */}
                <button
                  type="button"
                  onClick={() => handleSelectGroup(UNGROUPED_VALUE)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                    selectedGroupId === UNGROUPED_VALUE
                      ? "bg-primary/10 text-primary ring-1 ring-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <FolderMinus className="w-4 h-4 text-muted-foreground" />
                  <span>{t("dashboard.removeGroup")}</span>
                </button>

                {/* 最近使用的分组 */}
                {!searchQuery && recentGroups.length > 0 && (
                  <>
                    <div className="h-px bg-border my-2" />
                    <div className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t("groups.recent")}
                    </div>
                    {recentGroups.map((group: { id: number; name: string; color: string }) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => handleSelectGroup(String(group.id))}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors ${
                          selectedGroupId === String(group.id)
                            ? "bg-primary/10 text-primary ring-1 ring-primary"
                            : "hover:bg-muted"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: group.color }}
                          />
                          <span>{group.name}</span>
                        </span>
                      </button>
                    ))}
                  </>
                )}

                {/* 所有分组 */}
                {filteredGroups && filteredGroups.length > 0 && (
                  <>
                    <div className="h-px bg-border my-2" />
                    {!searchQuery && (
                      <div className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                        {t("groups.allGroups")}
                      </div>
                    )}
                    {filteredGroups.map((group: { id: number; name: string; color: string }) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => handleSelectGroup(String(group.id))}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors ${
                          selectedGroupId === String(group.id)
                            ? "bg-primary/10 text-primary ring-1 ring-primary"
                            : "hover:bg-muted"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: group.color }}
                          />
                          <span>{group.name}</span>
                        </span>
                      </button>
                    ))}
                  </>
                )}

                {/* 搜索无结果 */}
                {searchQuery && filteredGroups?.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    {t("groups.noResults")}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedGroupId}>
              {isSubmitting ? t("common.processing") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
