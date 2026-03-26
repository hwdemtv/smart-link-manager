import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";

interface RecycleBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored?: () => void;
}

export function RecycleBinDialog({
  open,
  onOpenChange,
  onRestored,
}: RecycleBinDialogProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "zh" ? zhCN : enUS;

  const [actioningId, setActioningId] = useState<number | null>(null);

  // 获取回收站链接
  const {
    data: deletedLinks,
    isLoading,
    refetch,
  } = trpc.links.getDeleted.useQuery(undefined, {
    enabled: open,
  });

  // 恢复链接
  const restoreMutation = trpc.links.restore.useMutation({
    onSuccess: () => {
      refetch();
      onRestored?.();
    },
    onSettled: () => setActioningId(null),
  });

  // 永久删除
  const permanentDeleteMutation = trpc.links.permanentDelete.useMutation({
    onSuccess: () => {
      refetch();
    },
    onSettled: () => setActioningId(null),
  });

  // 清空回收站
  const emptyBinMutation = trpc.links.emptyRecycleBin.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleRestore = (linkId: number) => {
    setActioningId(linkId);
    restoreMutation.mutate({ linkId });
  };

  const handlePermanentDelete = (linkId: number) => {
    if (confirm(t("recycleBin.permanentDeleteConfirm"))) {
      setActioningId(linkId);
      permanentDeleteMutation.mutate({ linkId });
    }
  };

  const handleEmptyBin = () => {
    if (confirm(t("recycleBin.emptyBinConfirm"))) {
      emptyBinMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            {t("recycleBin.title")}
          </DialogTitle>
          <DialogDescription>
            {t("recycleBin.description")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[50vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !deletedLinks || deletedLinks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("recycleBin.empty")}
            </div>
          ) : (
            <div className="space-y-2">
              {deletedLinks.map((link: any) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {link.originalShortCode}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("recycleBin.deleted")}{" "}
                        {formatDistanceToNow(new Date(link.deletedAt), {
                          addSuffix: true,
                          locale,
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-1">
                      {link.originalUrl}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(link.id)}
                      disabled={actioningId !== null}
                    >
                      {actioningId === link.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      <span className="ml-1 hidden sm:inline">
                        {t("recycleBin.restore")}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePermanentDelete(link.id)}
                      disabled={actioningId !== null}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {t("recycleBin.permanentDelete")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEmptyBin}
            disabled={
              !deletedLinks ||
              deletedLinks.length === 0 ||
              emptyBinMutation.isPending
            }
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {t("recycleBin.emptyBin")}
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
