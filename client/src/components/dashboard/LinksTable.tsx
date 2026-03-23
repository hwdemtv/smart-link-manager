import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LinkTableRow } from "./LinkTableRow";
import type { Link } from "@/types/dashboard";

interface LinksTableProps {
  links: Link[];
  isLoading: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onTogglePage: (checked: boolean) => void;
  onEdit: (link: Link) => void;
  onDelete: (link: Link) => void;
  onCopy: (shortCode: string) => void;
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

  const isAllSelected = links.length > 0 && links.every((l) => selectedIds.has(l.id));

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
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
                  onChange={(e) => onTogglePage(e.target.checked)}
                />
              </TableHead>
              <TableHead>{t("dashboard.shortCode")}</TableHead>
              <TableHead>{t("dashboard.originalUrl")}</TableHead>
              <TableHead>{t("dashboard.totalClicks")}</TableHead>
              <TableHead>{t("dashboard.status")}</TableHead>
              <TableHead>{t("dashboard.expiresAt")}</TableHead>
              <TableHead>{t("dashboard.created")}</TableHead>
              <TableHead className="text-right">{t("dashboard.actions")}</TableHead>
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
                      <Button size="sm" onClick={onCreateClick} className="mt-2">
                        <Plus className="w-4 h-4 mr-2" />
                        {t("dashboard.createFirstLink") || "立即创建第一个链接"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              links.map((link) => (
                <LinkTableRow
                  key={link.id}
                  link={link}
                  isSelected={selectedIds.has(link.id)}
                  onSelect={(checked) => onTogglePage(checked)}
                  onEdit={() => onEdit(link)}
                  onDelete={() => onDelete(link)}
                  onCopy={() => onCopy(link.shortCode)}
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
            {t("common.pagination.showing", { start: startIndex + 1, end: endIndex, total: totalItems })}
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
