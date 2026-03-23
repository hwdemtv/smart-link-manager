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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface BatchTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (tags: string[], mode: 'add' | 'remove' | 'set') => Promise<void>;
  isSubmitting: boolean;
}

export function BatchTagsDialog({ open, onOpenChange, selectedCount, onConfirm, isSubmitting }: BatchTagsDialogProps) {
  const { t } = useTranslation();
  const [tagsString, setTagsString] = useState("");
  const [mode, setMode] = useState<'add' | 'remove' | 'set'>('add');

  useEffect(() => {
    if (!open) {
      setTagsString("");
      setMode('add');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tagsArray = tagsString.split(",").map(t => t.trim()).filter(Boolean);
    await onConfirm(tagsArray, mode);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dashboard.batchTagsTitle", { count: selectedCount })}</DialogTitle>
          <DialogDescription>
            {t("dashboard.batchTagsDesc", { count: selectedCount })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t("dashboard.actionMode")}</Label>
            <Select value={mode} onValueChange={(val: any) => setMode(val)}>
              <SelectTrigger>
                <SelectValue placeholder={t("dashboard.selectMode", { defaultValue: "选择操作模式" })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">{t("dashboard.modeAdd")}</SelectItem>
                <SelectItem value="set">{t("dashboard.modeSet")}</SelectItem>
                <SelectItem value="remove">{t("dashboard.modeRemove")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("dashboard.tagsLabel")}</Label>
            <Input
              placeholder={t("dashboard.tagsPlaceholder")}
              value={tagsString}
              onChange={(e) => setTagsString(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !tagsString.trim()}>
              {isSubmitting ? t("dashboard.processing") : t("dashboard.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
