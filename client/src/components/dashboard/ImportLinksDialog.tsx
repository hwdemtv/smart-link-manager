import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Upload, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ImportLinksDialogProps } from "@/types/dashboard";

export function ImportLinksDialog({
  open,
  onOpenChange,
  importText,
  onImportTextChange,
  onPreview,
  isImporting,
}: ImportLinksDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onImportTextChange(content);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const headers = ["Original URL", "Short Code", "Description", "Tags", "Expires At"];
    const example = ["https://example.com", "example", "Sample link", "tag1; tag2", "2026-12-31 23:59:59"];
    const csvContent = [headers, example].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dashboard.batchImport")}</DialogTitle>
          <DialogDescription>
            {t("dashboard.importDescription")}
            <div className="text-xs text-muted-foreground mt-1 opacity-80">{t("dashboard.importTagsNotice")}</div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              {t("dashboard.uploadFile")}
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-accent-blue">
              <Download className="w-4 h-4 mr-2" />
              {t("dashboard.downloadTemplate")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.json,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          <textarea
            placeholder={t("dashboard.importPlaceholder")}
            value={importText}
            onChange={(e) => onImportTextChange(e.target.value)}
            className="w-full h-48 p-3 border border-border rounded-md bg-background text-foreground text-sm font-mono resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onPreview} disabled={isImporting}>
              {isImporting ? t("dashboard.importing") : t("dashboard.import")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
