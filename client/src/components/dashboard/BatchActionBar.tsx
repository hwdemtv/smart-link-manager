import { Button } from "@/components/ui/button";
import {
  Check,
  X,
  Sparkles,
  Download,
  Trash2,
  Tag,
  CalendarClock,
  FolderInput,
  RefreshCcw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BatchActionBarProps } from "@/types/dashboard";

export function BatchActionBar({
  selectedCount,
  onEnable,
  onDisable,
  onGenerateSeo,
  onExport,
  onDelete,
  onClear,
  onBatchTags,
  onBatchExpiry,
  onMoveToGroup,
  onCheck,
  isChecking,
}: BatchActionBarProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border/50 shadow-2xl rounded-full px-4 py-2 flex items-center gap-3 backdrop-blur-md bg-opacity-90">
        <div className="flex items-center gap-2 px-3 border-r border-border pr-4 mr-1">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-blue text-[10px] font-bold text-white">
            {selectedCount}
          </span>
          <span className="text-sm font-medium">
            {t("dashboard.selected")}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-full gap-2 hover:bg-green-500/10 hover:text-green-500"
            onClick={onEnable}
          >
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline">{t("common.enable")}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-full gap-2 hover:bg-yellow-500/10 hover:text-yellow-500"
            onClick={onDisable}
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">{t("common.disable")}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-full gap-2 hover:bg-accent-blue/10 hover:text-accent-blue"
            onClick={onGenerateSeo}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">{t("dashboard.aiGenerateSeo")}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-full gap-2 hover:bg-accent-blue/10 hover:text-accent-blue"
            onClick={onExport}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t("common.export")}</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-full gap-2 hover:bg-accent-blue/10 hover:text-accent-blue"
            onClick={onCheck}
            disabled={isChecking}
          >
            <RefreshCcw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t("dashboard.batchCheck")}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-full gap-2 hover:bg-purple-500/10 hover:text-purple-500"
            onClick={onBatchTags}
          >
            <Tag className="w-4 h-4" />
            <span className="hidden sm:inline">{t("dashboard.tagsLabel")}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-full gap-2 hover:bg-orange-500/10 hover:text-orange-500"
            onClick={onBatchExpiry}
          >
            <CalendarClock className="w-4 h-4" />
            <span className="hidden sm:inline">{t("dashboard.expiresAt")}</span>
          </Button>

          {onMoveToGroup && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 rounded-full gap-2 hover:bg-cyan-500/10 hover:text-cyan-500"
              onClick={onMoveToGroup}
            >
              <FolderInput className="w-4 h-4" />
              <span className="hidden sm:inline">{t("dashboard.moveToGroup")}</span>
            </Button>
          )}

          <div className="w-px h-4 bg-border mx-1" />

          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 rounded-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">{t("common.delete")}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-full ml-1"
            onClick={onClear}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
