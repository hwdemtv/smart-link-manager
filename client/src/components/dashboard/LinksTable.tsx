import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { LinkTableRow } from "./LinkTableRow";
import type { Link } from "@/types/dashboard";

// 虚拟滚动阈值：超过此数量时启用虚拟列表
const VIRTUAL_THRESHOLD = 50;
// 每行预估高度（像素）
const ESTIMATED_ROW_HEIGHT = 72;

interface LinksTableProps {
  links: Link[];
  isLoading: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onTogglePage: (checked: boolean) => void;
  onEdit: (link: Link) => void;
  onDelete: (link: Link) => void;
  onCopy: (link: Link) => void;
  onTagClick: (tag: string) => void;
  onQrCode: (shortCode: string) => void;
  onCreateClick: () => void;

  // Pagination
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  startIndex: number;
  endIndex: number;

  // Filter state for empty message
  hasFilters: boolean;
  onClearFilters: () => void;
}

export function LinksTable({
  links,
  isLoading,
  selectedIds,
  onToggleSelect,
  onTogglePage,
  onEdit,
  onDelete,
  onCopy,
  onTagClick,
  onQrCode,
  onCreateClick,
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  startIndex,
  endIndex,
  hasFilters,
  onClearFilters,
}: LinksTableProps) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  const isAllSelected =
    links.length > 0 && links.every(l => selectedIds.has(l.id));

  // 虚拟滚动：仅当链接数量超过阈值时启用
  const shouldVirtualize = links.length > VIRTUAL_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: links.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 5,
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-muted-foreground">
          {t("common.loading")}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">
        {t("dashboard.yourLinks")} ({totalItems})
      </h2>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-accent-blue focus:ring-accent-blue cursor-pointer"
                  checked={isAllSelected}
                  onChange={e => onTogglePage(e.target.checked)}
                />
              </TableHead>
              <TableHead>{t("dashboard.shortCode")}</TableHead>
              <TableHead>{t("dashboard.originalUrl")}</TableHead>
              <TableHead>{t("dashboard.totalClicks")}</TableHead>
              <TableHead>{t("dashboard.status")}</TableHead>
              <TableHead>{t("dashboard.expiresAt")}</TableHead>
              <TableHead>{t("dashboard.created")}</TableHead>
              <TableHead className="text-right">
                {t("dashboard.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="p-4 rounded-full bg-muted/50 text-muted-foreground">
                      <Link2 className="w-8 h-8 opacity-20" />
                    </div>
                    <div className="text-muted-foreground font-medium">
                      {hasFilters
                        ? t("dashboard.noLinksFound") || "没有找到匹配的链接"
                        : t("dashboard.noLinks") || "还没有创建任何链接"}
                    </div>
                    {hasFilters && (
                      <Button variant="link" size="sm" onClick={onClearFilters}>
                        {t("dashboard.clearFilters") || "重置所有筛选"}
                      </Button>
                    )}
                    {!hasFilters && (
                      <Button
                        size="sm"
                        onClick={onCreateClick}
                        className="mt-2"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t("dashboard.createFirstLink") || "立即创建第一个链接"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : shouldVirtualize ? (
              // 虚拟滚动渲染
              <div
                ref={parentRef}
                className="overflow-auto"
                style={{ maxHeight: "600px" }}
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map(virtualRow => {
                    const link = links[virtualRow.index];
                    return (
                      <div
                        key={link.id}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <TableRow
                          className="hover:bg-muted/50"
                          data-index={virtualRow.index}
                        >
                          <TableCell className="w-10">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-accent-blue focus:ring-accent-blue cursor-pointer"
                              checked={selectedIds.has(link.id)}
                              onChange={e => onToggleSelect(link.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            {link.shortCode}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            <a
                              href={link.originalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {link.originalUrl}
                            </a>
                          </TableCell>
                          <TableCell>{link.clickCount}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                link.isActive && link.isValid
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              }`}
                            >
                              {link.isActive && link.isValid
                                ? t("common.active")
                                : t("common.inactive")}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {link.expiresAt
                              ? new Date(link.expiresAt).toLocaleDateString()
                              : "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(link.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onCopy(link)}
                              >
                                {t("common.copy") || "复制"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit(link)}
                              >
                                {t("common.edit") || "编辑"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDelete(link)}
                                className="text-destructive"
                              >
                                {t("common.delete") || "删除"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // 传统渲染（数据量小时）
              links.map(link => (
                <LinkTableRow
                  key={link.id}
                  link={link}
                  isSelected={selectedIds.has(link.id)}
                  onSelect={checked => onTogglePage(checked)}
                  onEdit={() => onEdit(link)}
                  onDelete={() => onDelete(link)}
                  onCopy={() => onCopy(link)}
                  onTagClick={onTagClick}
                  onQrCode={() => onQrCode(link.shortCode)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {t("common.pagination.showing", {
              start: startIndex + 1,
              end: endIndex,
              total: totalItems,
            })}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              {t("common.pagination.prev")}
            </Button>
            <div className="flex items-center justify-center text-sm font-medium px-2">
              {currentPage} / {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              {t("common.pagination.next")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
