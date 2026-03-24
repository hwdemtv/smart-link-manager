import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import type { DeleteConfirmDialogProps } from "@/types/dashboard";

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  shortCode,
  isDeleting,
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("dashboard.moveToRecycleBin") || "移至回收站"}
          </DialogTitle>
          <DialogDescription>
            {t("dashboard.moveToRecycleBinConfirm") ||
              "链接将被移至回收站，您可以在 30 天内恢复。确定要移除"}{" "}
            <strong className="text-foreground">{shortCode}</strong> {"吗？"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting
              ? t("dashboard.deleting")
              : t("dashboard.moveToRecycleBin") || "移至回收站"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
