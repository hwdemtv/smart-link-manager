import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Eye, Clock, User, Globe, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";

type AuditLogItem = {
  id: number;
  userId: number | null;
  action: string;
  targetType: string | null;
  targetId: number | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  userName: string | null;
  userUsername: string | null;
};

export default function AuditLogManagement() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const itemsPerPage = 20;

  const { data: actions } = trpc.user.getAuditLogActions.useQuery();

  const { data: auditLogs, isLoading } = trpc.user.getAuditLogs.useQuery({
    action: selectedAction !== "all" ? selectedAction : undefined,
    limit: itemsPerPage,
    offset: (currentPage - 1) * itemsPerPage,
  });

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  const getActionLabel = (action: string) => {
    const label = t(`admin.auditLog.actionLabels.${action}`, {
      defaultValue: action,
    });
    return label;
  };

  const getTargetTypeLabel = (targetType: string | null) => {
    if (!targetType) return "-";
    return t(`admin.auditLog.targetTypes.${targetType}`, {
      defaultValue: targetType,
    });
  };

  const getActionBadgeVariant = (
    action: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    if (action.includes(".delete") || action.includes("_deleted"))
      return "destructive";
    if (action.includes(".create") || action.includes("_activated"))
      return "default";
    if (
      action.includes(".update") ||
      action.includes(".change") ||
      action.includes("_updated")
    )
      return "secondary";
    return "outline";
  };

  const handleViewDetails = (log: AuditLogItem) => {
    setSelectedLog(log);
    setDetailsDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t("admin.auditLog.title")}
              </CardTitle>
              <CardDescription>{t("admin.auditLog.subtitle")}</CardDescription>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t("admin.auditLog.filterAction")}:
              </span>
              <Select
                value={selectedAction}
                onValueChange={(value: string) => {
                  setSelectedAction(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t("admin.auditLog.allActions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("admin.auditLog.allActions")}
                  </SelectItem>
                  {actions?.map(action => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">{t("common.loading")}</div>
          ) : !auditLogs?.logs || auditLogs.logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("admin.auditLog.noLogs")}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.auditLog.time")}</TableHead>
                    <TableHead>{t("admin.auditLog.user")}</TableHead>
                    <TableHead>{t("admin.auditLog.action")}</TableHead>
                    <TableHead>{t("admin.auditLog.target")}</TableHead>
                    <TableHead>{t("admin.auditLog.ipAddress")}</TableHead>
                    <TableHead>{t("admin.auditLog.details")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.logs.map((log: AuditLogItem) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {formatDate(log.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {log.userName ||
                                log.userUsername ||
                                t("admin.auditLog.noUser")}
                            </div>
                            {log.userUsername && log.userName && (
                              <div className="text-xs text-muted-foreground">
                                @{log.userUsername}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {getActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.targetType && (
                          <div className="text-sm">
                            <div className="text-muted-foreground">
                              {getTargetTypeLabel(log.targetType)}
                            </div>
                            {log.targetId && (
                              <div className="font-mono text-xs">
                                #{log.targetId}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.ipAddress && (
                          <div className="flex items-center gap-1 text-sm font-mono">
                            <Globe className="w-3 h-3 text-muted-foreground" />
                            {log.ipAddress}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(log)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          {t("admin.auditLog.viewDetails")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {auditLogs.totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    {t("common.pagination.showing", {
                      from: (currentPage - 1) * itemsPerPage + 1,
                      to: Math.min(currentPage * itemsPerPage, auditLogs.total),
                      total: auditLogs.total,
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p: number) => Math.max(1, p - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      ← {t("common.pagination.prev")}
                    </Button>
                    <div className="flex items-center justify-center text-sm font-medium px-2">
                      {currentPage} / {auditLogs.totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p: number) =>
                          Math.min(auditLogs.totalPages, p + 1)
                        )
                      }
                      disabled={currentPage === auditLogs.totalPages}
                    >
                      {t("common.pagination.next")} →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              {t("admin.auditLog.viewDetails")}
            </DialogTitle>
            <DialogDescription>
              {selectedLog && (
                <span>
                  {getActionLabel(selectedLog.action)} -{" "}
                  {formatDate(selectedLog.createdAt)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("admin.auditLog.time")}
                    </label>
                    <p className="text-sm">
                      {formatDate(selectedLog.createdAt)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("admin.auditLog.action")}
                    </label>
                    <p className="text-sm">
                      <Badge
                        variant={getActionBadgeVariant(selectedLog.action)}
                      >
                        {getActionLabel(selectedLog.action)}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("admin.auditLog.user")}
                    </label>
                    <p className="text-sm">
                      {selectedLog.userName ||
                        selectedLog.userUsername ||
                        t("admin.auditLog.noUser")}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("admin.auditLog.ipAddress")}
                    </label>
                    <p className="text-sm font-mono">
                      {selectedLog.ipAddress || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("admin.auditLog.target")}
                    </label>
                    <p className="text-sm">
                      {selectedLog.targetType &&
                        getTargetTypeLabel(selectedLog.targetType)}
                      {selectedLog.targetId && ` #${selectedLog.targetId}`}
                    </p>
                  </div>
                </div>

                {/* User Agent */}
                {selectedLog.userAgent && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("admin.auditLog.userAgent")}
                    </label>
                    <p className="text-sm break-all">{selectedLog.userAgent}</p>
                  </div>
                )}

                {/* Details JSON */}
                {selectedLog.details &&
                  Object.keys(selectedLog.details).length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        {t("admin.auditLog.details")}
                      </label>
                      <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto">
                        {JSON.stringify(selectedLog.details, null, 2)}
                      </pre>
                    </div>
                  )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
