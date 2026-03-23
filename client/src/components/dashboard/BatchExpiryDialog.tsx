import { useState, useEffect } from "react";
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

interface BatchExpiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (expiresAt: string | null) => Promise<void>;
  isSubmitting: boolean;
}

export function BatchExpiryDialog({ open, onOpenChange, selectedCount, onConfirm, isSubmitting }: BatchExpiryDialogProps) {
  const { t } = useTranslation();
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (!open) {
      setExpiresAt("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(expiresAt ? expiresAt : null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dashboard.batchExpiryTitle", { count: selectedCount })}</DialogTitle>
          <DialogDescription>
            {t("dashboard.batchExpiryDesc", { count: selectedCount })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t("dashboard.expiresAt")} ({t("dashboard.expiryPlaceholder")})</Label>
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("dashboard.processing") : t("dashboard.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
