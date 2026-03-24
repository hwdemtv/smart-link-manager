import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Folder, Plus, Settings, Loader2, Link2 } from "lucide-react";
import { GroupManageDialog } from "./GroupManageDialog";

interface GroupSidebarProps {
  selectedGroupId: number | null | undefined;
  onGroupSelect: (groupId: number | null | undefined) => void;
}

export function GroupSidebar({
  selectedGroupId,
  onGroupSelect,
}: GroupSidebarProps) {
  const { t } = useTranslation();
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);

  // 获取分组列表
  const { data: groups, isLoading } = trpc.groups.list.useQuery();

  // 计算总链接数
  const totalLinks =
    groups?.reduce((sum: number, g: any) => sum + (g.linkCount || 0), 0) || 0;

  const handleEditGroup = (groupId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroupId(groupId);
    setManageDialogOpen(true);
  };

  return (
    <>
      <div className="w-56 border-r bg-muted/20 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Folder className="w-4 h-4" />
            {t("groups.title") || "分组"}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setEditingGroupId(null);
              setManageDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {/* 全部链接 */}
              <button
                onClick={() => onGroupSelect(undefined)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedGroupId === undefined
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  {t("groups.allLinks") || "全部链接"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {totalLinks}
                </span>
              </button>

              {/* 未分组 */}
              <button
                onClick={() => onGroupSelect(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedGroupId === null
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-dashed border-muted-foreground" />
                  {t("groups.ungrouped") || "未分组"}
                </span>
              </button>

              {/* 分割线 */}
              {groups && groups.length > 0 && (
                <div className="h-px bg-border my-2" />
              )}

              {/* 各分组 */}
              {groups?.map((group: any) => (
                <button
                  key={group.id}
                  onClick={() => onGroupSelect(group.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors group ${
                    selectedGroupId === group.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="truncate">{group.name}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {group.linkCount || 0}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => handleEditGroup(group.id, e)}
                    >
                      <Settings className="w-3 h-3" />
                    </Button>
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <GroupManageDialog
        open={manageDialogOpen}
        onOpenChange={setManageDialogOpen}
        editingGroupId={editingGroupId}
        groups={groups}
      />
    </>
  );
}
