import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Upload, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ExportFormat } from "@/types/dashboard";

interface DashboardHeaderProps {
  onCreateClick: () => void;
  onImportClick: () => void;
  onExportClick: (format: ExportFormat) => void;
}

export function DashboardHeader({ onCreateClick, onImportClick, onExportClick }: DashboardHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="container py-6 border-b border-border/50 bg-card/10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">{t("common.links")}</h1>
          <p className="mt-1 text-muted-foreground">{t("dashboard.manageSubtitle")}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Import Button */}
          <Button variant="outline" size="lg" className="gap-2" onClick={onImportClick}>
            <Upload className="w-4 h-4" />
            {t("dashboard.import")}
          </Button>

          {/* Export Button */}
          <Button variant="outline" size="lg" className="gap-2" onClick={() => onExportClick("csv")}>
            <Download className="w-4 h-4" />
            {t("dashboard.export")}
          </Button>

          {/* Create Button */}
          <Button size="lg" className="gap-2" onClick={onCreateClick}>
            <Plus className="w-4 h-4" />
            {t("dashboard.createLink")}
          </Button>
        </div>
      </div>
    </div>
  );
}
