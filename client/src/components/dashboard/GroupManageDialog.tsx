import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

// 预设颜色
const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
];

interface GroupManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGroupId: number | null;
  groups: any[] | undefined;
}

export function GroupManageDialog({
  open,
  onOpenChange,
  editingGroupId,
  groups,
}: GroupManageDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const utils = trpc.useUtils();

  const editingGroup = groups?.find(g => g.id === editingGroupId);

  useEffect(() => {
    if (editingGroup) {
      setName(editingGroup.name);
      setColor(editingGroup.color);
    } else {
      setName("");
      setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    }
  }, [editingGroup, open]);

  // 创建分组
  const createMutation = trpc.groups.create.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      toast.success(t("groups.createSuccess"));
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || t("groups.createFailed"));
    },
  });

  // 更新分组
  const updateMutation = trpc.groups.update.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      toast.success(t("common.success"));
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || t("groups.updateFailed"));
    },
  });

  // 删除分组
  const deleteMutation = trpc.groups.delete.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
      toast.success(t("common.success"));
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || t("groups.deleteFailed"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingGroupId) {
      updateMutation.mutate({
        groupId: editingGroupId,
        name: name.trim(),
        color,
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        color,
      });
    }
  };

  const handleDelete = () => {
    if (!editingGroupId) return;
    if (confirm(t("groups.deleteConfirm"))) {
      deleteMutation.mutate({ groupId: editingGroupId });
    }
  };

  const isLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {editingGroupId ? t("groups.editGroup") : t("groups.createGroup")}
          </DialogTitle>
          <DialogDescription>
            {editingGroupId ? t("groups.editDescription") : t("groups.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("groups.name")}</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t("groups.namePlaceholder")}
              maxLength={64}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t("groups.color")}</Label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-primary scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer"
                title={t("groups.customColor")}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm">
              {name || t("groups.preview")}
            </span>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            {editingGroupId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={isLoading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t("groups.delete")}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isLoading || !name.trim()}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingGroupId ? (
                  t("common.save")
                ) : (
                  t("groups.create")
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
