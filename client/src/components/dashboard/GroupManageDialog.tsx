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
      onOpenChange(false);
    },
  });

  // 更新分组
  const updateMutation = trpc.groups.update.useMutation({
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  // 删除分组
  const deleteMutation = trpc.groups.delete.useMutation({
    onSuccess: () => {
      onOpenChange(false);
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
    if (
      confirm(
        t("groups.deleteConfirm") ||
          "确定要删除此分组吗？分组内的链接不会被删除。"
      )
    ) {
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
            {editingGroupId
              ? t("groups.editGroup") || "编辑分组"
              : t("groups.createGroup") || "创建分组"}
          </DialogTitle>
          <DialogDescription>
            {editingGroupId
              ? t("groups.editDescription") || "修改分组名称和颜色"
              : t("groups.createDescription") || "创建新分组来整理您的链接"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("groups.name") || "分组名称"}</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t("groups.namePlaceholder") || "输入分组名称"}
              maxLength={64}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t("groups.color") || "颜色"}</Label>
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
                title={t("groups.customColor") || "自定义颜色"}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm">
              {name || t("groups.preview") || "分组预览"}
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
                {t("groups.delete") || "删除"}
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
                {t("common.cancel") || "取消"}
              </Button>
              <Button type="submit" disabled={isLoading || !name.trim()}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingGroupId ? (
                  t("common.save") || "保存"
                ) : (
                  t("groups.create") || "创建"
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
