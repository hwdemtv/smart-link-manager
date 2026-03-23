import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Copy, QrCode, Edit, Trash2, ExternalLink, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Link } from "@/types/dashboard";

interface LinkTableRowProps {
  link: Link;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onTagClick: (tag: string) => void;
  onQrCode: () => void;
}

export function LinkTableRow({
  link,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onCopy,
  onTagClick,
  onQrCode,
}: LinkTableRowProps) {
  const { t } = useTranslation();

  const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();

  return (
    <TableRow
      className={`group transition-colors hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""}`}
    >
      {/* Checkbox */}
      <TableCell>
        <input
          type="checkbox"
          className="rounded border-gray-300 text-accent-blue focus:ring-accent-blue cursor-pointer"
          checked={isSelected}
          onChange={(e) => onSelect(e.target.checked)}
        />
      </TableCell>

      {/* Short Code */}
      <TableCell className="font-mono text-accent-blue font-semibold">
        <div className="text-sm">{link.shortCode}</div>
        {link.customDomain && (
          <div className="text-xs text-muted-foreground">{link.customDomain}</div>
        )}
      </TableCell>

      {/* Original URL */}
      <TableCell className="max-w-[200px] lg:max-w-md">
        <div className="flex flex-col space-y-1">
          <a
            href={link.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent-blue flex items-center gap-1 font-medium transition-colors truncate"
            title={link.originalUrl}
          >
            {link.originalUrl}
            <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          {link.tags && link.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {link.tags.map((tag: string, i: number) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-[10px] cursor-pointer hover:bg-muted font-medium border border-border/50"
                  onClick={() => onTagClick(tag)}
                  title={`Filter by ${tag}`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </TableCell>

      {/* Click Count */}
      <TableCell className="font-medium">{link.clickCount || 0}</TableCell>

      {/* Status */}
      <TableCell>
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
            link.isValid
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {link.isValid ? t("dashboard.valid") : t("dashboard.invalid")}
        </span>
      </TableCell>

      {/* Expires At */}
      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
        {link.expiresAt ? (
          isExpired ? (
            <span className="text-destructive font-medium">{t("dashboard.expired")}</span>
          ) : (
            new Date(link.expiresAt).toLocaleDateString()
          )
        ) : (
          <span>{t("dashboard.never")}</span>
        )}
      </TableCell>

      {/* Created At */}
      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
        {new Date(link.createdAt).toLocaleDateString()}
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {link.passwordHash && (
            <div className="mr-1" title={t("dashboard.passwordProtected")}>
              <Lock className="w-3.5 h-3.5 text-amber-500" />
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
            onClick={onCopy}
            title={t("dashboard.copyLink")}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
            onClick={onQrCode}
            title={t("dashboard.qrCode")}
          >
            <QrCode className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
            onClick={onEdit}
            title={t("dashboard.editLinkTitle")}
          >
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            title={t("dashboard.deleteLinkTitle")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
