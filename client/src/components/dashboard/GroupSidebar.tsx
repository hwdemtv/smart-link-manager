import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Folder,
  Plus,
  Settings,
  Loader2,
  Link2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { GroupManageDialog } from "./GroupManageDialog";

const GROUP_SEARCH_THRESHOLD = 10;
const SIDEBAR_COLLAPSED_KEY = "slm_sidebar_collapsed";
const RECENT_GROUPS_KEY = "slm_recent_groups";
const MAX_RECENT_GROUPS = 3;

interface GroupSidebarProps {
  selectedGroupId: number | null | undefined;
  onGroupSelect: (groupId: number | null | undefined) => void;
}

/**
 * 侧边栏项类型定义
 */
type SidebarItem = 
  | { type: "action"; id: "all" | "ungrouped" }
  | { type: "header"; label: string }
  | { type: "divider"; id: string }
  | { type: "group"; group: any };

export function GroupSidebar({
  selectedGroupId,
  onGroupSelect,
}: GroupSidebarProps) {
  const { t } = useTranslation();
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });
  const [recentGroupIds, setRecentGroupIds] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(RECENT_GROUPS_KEY);
      return stored ? JSON.parse(stored).map(Number) : [];
    } catch {
      return [];
    }
  });

  const parentRef = useRef<HTMLDivElement>(null);

  // 获取分组列表
  const { data: groups, isLoading: groupsLoading } = trpc.groups.list.useQuery();
  // 获取全量链接计数
  const { data: countData, isLoading: countLoading } = trpc.links.count.useQuery();

  const isLoading = groupsLoading || countLoading;
  const totalCount = typeof countData === "number" ? countData : countData?.total || 0;
  const groupedLinksCount = groups?.reduce((sum: number, g: any) => sum + (g.linkCount || 0), 0) || 0;
  const ungroupedCount = Math.max(0, totalCount - groupedLinksCount);

  // 是否显示搜索栏
  const showSearch = (groups?.length || 0) > GROUP_SEARCH_THRESHOLD;

  // 1. 数据平坦化与去重逻辑
  const sidebarItems = useMemo(() => {
    if (isLoading || !groups) return [];

    const items: SidebarItem[] = [
      { type: "action", id: "all" },
      { type: "action", id: "ungrouped" },
    ];

    const query = groupSearchQuery.toLowerCase().trim();
    const seenIds = new Set<number>();
    
    // 如果没有搜索，显示“最近使用”
    if (!query) {
      const recent = recentGroupIds
        .map(id => groups.find((g: any) => Number(g.id) === id))
        .filter(Boolean);

      if (recent.length > 0) {
        items.push({ type: "divider", id: "d1" });
        items.push({ type: "header", label: t("groups.recent") });
        recent.forEach(g => {
          const gid = Number(g.id);
          if (!seenIds.has(gid)) {
            items.push({ type: "group", group: g });
            seenIds.add(gid);
          }
        });
      }
    }

    // 显示所有分组（或过滤后的）
    const filtered = query 
      ? groups.filter((g: any) => g.name.toLowerCase().includes(query))
      : groups;

    if (filtered.length > 0) {
      items.push({ type: "divider", id: "d2" });
      // 如果没有搜索，则在“所有分组”中排除掉已在“最近使用”中显示的
      const displayGroups = query 
        ? filtered 
        : filtered.filter((g: any) => !recentGroupIds.includes(Number(g.id)));
      
      displayGroups.forEach((g: any) => {
        const gid = Number(g.id);
        if (!seenIds.has(gid)) {
          items.push({ type: "group", group: g });
          seenIds.add(gid);
        }
      });
    } else if (query) {
      // 搜索无结果占位项 (虚拟滚动不适合放纯文本，但我们可以由于项数少而忽略)
    }

    return items;
  }, [groups, groupSearchQuery, recentGroupIds, isLoading, t]);

  // 2. 虚拟滚动配置
  const rowVirtualizer = useVirtualizer({
    count: sidebarItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 38, // 每一项的大致高度
    overscan: 10,
  });

  // 记录最近使用
  useEffect(() => {
    if (selectedGroupId !== null && selectedGroupId !== undefined) {
      setRecentGroupIds(prev => {
        const id = Number(selectedGroupId);
        const filtered = prev.filter(p => p !== id);
        const updated = [id, ...filtered].slice(0, MAX_RECENT_GROUPS);
        localStorage.setItem(RECENT_GROUPS_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  }, [selectedGroupId]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const handleEditGroup = (groupId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroupId(groupId);
    setManageDialogOpen(true);
  };

  const handleToggleCollapse = () => setIsCollapsed(!isCollapsed);

  // 折叠状态逻辑
  if (isCollapsed) {
    return (
      <div className="w-12 border-r bg-muted/20 flex flex-col items-center py-4 h-full overflow-hidden shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 mb-4" onClick={handleToggleCollapse}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="flex flex-col items-center gap-2 flex-1 overflow-y-auto w-full px-1 custom-scrollbar">
          <button onClick={() => onGroupSelect(undefined)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${selectedGroupId === undefined ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-primary/5 text-slate-500"}`}>
            <Link2 className="w-4 h-4" />
          </button>
          <button onClick={() => onGroupSelect(null)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${selectedGroupId === null ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-primary/5 text-slate-500"}`}>
            <div className="w-3 h-3 rounded-full border-2 border-dashed border-current opacity-60" />
          </button>
          <div className="w-6 h-px bg-border my-2 opacity-50" />
          {groups?.slice(0, 15).map((group: any) => (
            <button key={group.id} onClick={() => onGroupSelect(group.id)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${selectedGroupId === group.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-primary/5 text-slate-500"}`} title={group.name}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 mt-2 text-slate-400" onClick={() => { setEditingGroupId(null); setManageDialogOpen(true); }}>
          <Plus className="w-4 h-4" />
        </Button>
        <GroupManageDialog open={manageDialogOpen} onOpenChange={setManageDialogOpen} editingGroupId={editingGroupId} groups={groups} />
      </div>
    );
  }

  return (
    <div className="w-60 border-r bg-white flex flex-col h-full shrink-0 shadow-[1px_0_0_0_rgba(0,0,0,0.02)]">
      <div className="p-5 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2.5">
          <Folder className="w-4 h-4 text-[#009688]" />
          {t("groups.title")}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" onClick={handleToggleCollapse}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-[#009688] hover:bg-[#009688]/10" onClick={() => { setEditingGroupId(null); setManageDialogOpen(true); }}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {showSearch && (
        <div className="px-5 pb-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-[#009688] transition-colors" />
            <Input
              value={groupSearchQuery}
              onChange={e => setGroupSearchQuery(e.target.value)}
              placeholder={t("groups.searchPlaceholder")}
              className="h-9 pl-9 pr-8 text-xs rounded-xl border-slate-100 bg-slate-50/50 focus-visible:bg-white focus-visible:ring-[#009688]/10 transition-all"
            />
            {groupSearchQuery && (
              <button onClick={() => setGroupSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 虚拟滚动区域 */}
      <div className="flex-1 min-h-0 overflow-hidden px-3 pb-4">
        <div ref={parentRef} className="h-full overflow-y-auto pr-1 custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-[#009688]/40" />
            </div>
          ) : sidebarItems.length === 0 && groupSearchQuery ? (
            <div className="text-center py-10">
               <p className="text-xs text-slate-400 font-medium">{t("groups.noResults")}</p>
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = sidebarItems[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex flex-col justify-center"
                  >
                    {item.type === "action" && (
                      <button
                        onClick={() => onGroupSelect(item.id === "all" ? undefined : null)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13.5px] font-medium transition-all ${
                          (item.id === "all" && selectedGroupId === undefined) || (item.id === "ungrouped" && selectedGroupId === null)
                            ? "bg-primary text-white shadow-md shadow-primary/10"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          {item.id === "all" ? (
                            <Link2 className="w-4 h-4 opacity-70" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-current opacity-40 ml-0.5" />
                          )}
                          {item.id === "all" ? t("groups.allLinks") : t("groups.ungrouped")}
                        </span>
                        <span className={`text-[11px] font-bold ${ (item.id === "all" && selectedGroupId === undefined) || (item.id === "ungrouped" && selectedGroupId === null) ? "opacity-90" : "text-slate-400"}`}>
                          {item.id === "all" ? totalCount : ungroupedCount}
                        </span>
                      </button>
                    )}

                    {item.type === "header" && (
                      <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {item.label}
                      </div>
                    )}

                    {item.type === "divider" && (
                      <div className="px-1 py-2">
                        <div className="h-[1px] bg-slate-100 w-full" />
                      </div>
                    )}

                    {item.type === "group" && (
                      <button
                        onClick={() => onGroupSelect(item.group.id)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all group ${
                          selectedGroupId === item.group.id
                            ? "bg-primary text-white shadow-md shadow-primary/10"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-inner" style={{ backgroundColor: item.group.color }} />
                          <span className="truncate">{item.group.name}</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-bold ${selectedGroupId === item.group.id ? "opacity-90" : "text-slate-300"}`}>
                            {item.group.linkCount || 0}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-6 w-6 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${selectedGroupId === item.group.id ? "hover:bg-white/20 text-white" : "text-slate-400 hover:bg-slate-200"}`}
                            onClick={e => handleEditGroup(item.group.id, e)}
                          >
                            <Settings className="w-3 h-3" />
                          </Button>
                        </div>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <GroupManageDialog
        open={manageDialogOpen}
        onOpenChange={setManageDialogOpen}
        editingGroupId={editingGroupId}
        groups={groups}
      />
    </div>
  );
}
