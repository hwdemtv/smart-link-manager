import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import type { ImportPreviewDialogProps } from "@/types/dashboard";

export function ImportPreviewDialog({
  open,
  onOpenChange,
  previewLinks,
  onConfirm,
  onBack,
  isImporting,
}: ImportPreviewDialogProps) {
  const { t } = useTranslation();

  const hasConflicts = previewLinks.some((l) => l.hasConflict);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("dashboard.importPreviewTitle")}</DialogTitle>
          <DialogDescription>
            {t("dashboard.importPreviewDesc", { count: previewLinks.length })}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 border rounded-md p-4 bg-muted/30">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">{t("dashboard.shortCode")}</TableHead>
                <TableHead>{t("dashboard.originalUrl")}</TableHead>
                <TableHead>{t("dashboard.tagsLabel")}</TableHead>
                <TableHead>{t("dashboard.expiresAt")}</TableHead>
                <TableHead>{t("dashboard.description")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewLinks.map((link, idx) => (
                <TableRow key={idx} className={link.hasConflict ? "bg-red-50/50 hover:bg-red-50/80" : ""}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-2">
                      {link.shortCode || "-"}
                      {link.hasConflict && (
                        <span
                          className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/10 cursor-help"
                          title={link.conflictReason}
                        >
                          {link.conflictReason}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate" title={link.originalUrl}>
                    <div className="flex items-center gap-2">
                      <span className="truncate">{link.originalUrl}</span>
                      {link.hasWarning && (
                        <span
                          className="shrink-0 inline-flex items-center rounded-md bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800 ring-1 ring-inset ring-yellow-600/20 cursor-help"
                          title={link.warningReason}
                        >
                          {t("dashboard.sourceOverlap")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={link.tags?.join(', ')}>
                    {link.tags?.join(', ') || "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {link.expiresAt || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{link.description || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <DialogFooter className="pt-4 mt-auto">
          <Button variant="outline" onClick={onBack}>
            {t("common.back")}
          </Button>
          <Button onClick={onConfirm} disabled={isImporting || hasConflicts}>
            {isImporting ? t("dashboard.importing") : t("dashboard.confirmImport")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
