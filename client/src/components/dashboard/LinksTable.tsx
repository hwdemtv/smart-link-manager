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
import { Skeleton } from "@/components/ui/skeleton";
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
  onCopy: (link: Link) => void;
  onTagClick: (tag: string) => void;
  onQrCode: (shortCode: string) => void;
  onShare: (link: Link) => void;
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
  onCheck: (id: number) => void;
  checkingLinkId?: number | null;
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
  onShare,
  onCreateClick,
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  startIndex,
  endIndex,
  hasFilters,
  onClearFilters,
  onCheck,
  checkingLinkId,
}: LinksTableProps) {
  const { t } = useTranslation();

  const isAllSelected =
    links.length > 0 && links.every(l => selectedIds.has(l.id));

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-10">
                  <Skeleton className="h-4 w-4" />
                </TableHead>
                <TableHead className="w-32"><Skeleton className="h-4 w-16" /></TableHead>
                <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                <TableHead className="w-32"><Skeleton className="h-4 w-24" /></TableHead>
                <TableHead className="w-24"><Skeleton className="h-4 w-12" /></TableHead>
                <TableHead className="w-24"><Skeleton className="h-4 w-12" /></TableHead>
                <TableHead className="w-32"><Skeleton className="h-4 w-20" /></TableHead>
                <TableHead className="w-32"><Skeleton className="h-4 w-20" /></TableHead>
                <TableHead className="text-right w-32"><Skeleton className="h-4 w-20 ml-auto" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array(5)
                .fill(null)
                .map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
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
              <TableHead>{t("dashboard.description")}</TableHead>
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
                <TableCell colSpan={9} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="p-4 rounded-full bg-muted/50 text-muted-foreground">
                      <Link2 className="w-8 h-8 opacity-20" />
                    </div>
                    <div className="text-muted-foreground font-medium">
                      {hasFilters
                        ? t("dashboard.noLinksFound")
                        : t("dashboard.noLinks")}
                    </div>
                    {hasFilters && (
                      <Button variant="link" size="sm" onClick={onClearFilters}>
                        {t("dashboard.clearFilters")}
                      </Button>
                    )}
                    {!hasFilters && (
                      <Button
                        size="sm"
                        onClick={onCreateClick}
                        className="mt-2"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t("dashboard.createFirstLink")}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // 统一使用 LinkTableRow 组件渲染（服务端分页后每页数据量可控）
              links.map(link => (
                <LinkTableRow
                  key={link.id}
                  link={link}
                  isSelected={selectedIds.has(link.id)}
                  onSelect={() => onToggleSelect(link.id)}
                  onEdit={() => onEdit(link)}
                  onDelete={() => onDelete(link)}
                  onCopy={() => onCopy(link)}
                  onTagClick={onTagClick}
                  onQrCode={() => onQrCode(link.shortCode)}
                  onShare={() => onShare(link)}
                  onCheck={() => onCheck(link.id)}
                  isChecking={checkingLinkId === link.id}
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
              from: startIndex + 1,
              to: endIndex,
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
