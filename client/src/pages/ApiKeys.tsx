import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import React, { useState } from "react";
import { toast } from "sonner";
import { Plus, Key, Copy, Trash2, Clock, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ApiKeys() {
  const { t } = useTranslation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<any>(null);

  const utils = trpc.useUtils();
  const keysQuery = (trpc.apiKeys.list as any).useQuery();
  const createKeyMutation = (trpc.apiKeys.create as any).useMutation();
  const revokeKeyMutation = (trpc.apiKeys.revoke as any).useMutation();

  const handleCreateKey = async (e: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!keyName) return;

    try {
      const result = await createKeyMutation.mutateAsync({ name: keyName });
      setNewKey(result);
      setKeyName("");
      setIsCreateOpen(false);
      (utils.apiKeys.list as any).invalidate();
    } catch (error: any) {
      toast.error(error.message || t("apiKeys.createFailed"));
    }
  };

  const handleRevokeKey = async (id: number) => {
    try {
      await revokeKeyMutation.mutateAsync({ id });
      toast.success(t("apiKeys.revokeSuccess"));
      (utils.apiKeys.list as any).invalidate();
    } catch (error: any) {
      toast.error(error.message || t("apiKeys.revokeFailed"));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("apiKeys.copySuccess"));
  };

  return (
    <div className="min-h-content bg-background">
      <div className="border-b border-border/50 bg-card/10">
        <div className="container py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t("apiKeys.title")}
              </h1>
              <p className="mt-1 text-muted-foreground">
                {t("apiKeys.subtitle")}
              </p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  {t("apiKeys.createKey")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("apiKeys.createTitle")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateKey} className="space-y-4">
                  <div>
                    <Label htmlFor="keyName">{t("apiKeys.keyName")}</Label>
                    <Input
                      id="keyName"
                      placeholder={t("apiKeys.keyNamePlaceholder")}
                      value={keyName}
                      onChange={e => setKeyName(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createKeyMutation.isPending}
                  >
                    {createKeyMutation.isPending
                      ? t("apiKeys.creating")
                      : t("apiKeys.createNow")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-6">
        {newKey && (
          <Card className="p-6 border-accent-blue bg-accent-blue/5 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3 mb-4 text-accent-blue">
              <Shield className="w-6 h-6" />
              <h3 className="text-lg font-bold">
                {t("apiKeys.successTitle", { name: newKey.name })}
              </h3>
            </div>
            <div className="bg-background border border-border rounded-md p-4 flex items-center justify-between mb-4">
              <code className="text-sm font-mono break-all">
                {newKey.rawKey}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(newKey.rawKey)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-900/50">
              {t("apiKeys.copyNotice")}
            </p>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => setNewKey(null)}
            >
              {t("apiKeys.closeNotice")}
            </Button>
          </Card>
        )}

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Key className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">
              {t("apiKeys.existingKeys")}
            </h2>
          </div>

          {keysQuery.isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              {t("apiKeys.loading")}
            </div>
          ) : (keysQuery.data as any)?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
              <Key className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>{t("apiKeys.noKeys")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(keysQuery.data as any)?.map((key: any) => (
                <div
                  key={key.id}
                  className="group p-4 border border-border rounded-xl hover:border-accent-blue/50 hover:bg-secondary/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">
                          {key.name}
                        </span>
                        {!key.isActive && (
                          <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
                            {t("apiKeys.revoked")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">
                          {key.prefix}...
                        </span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {t("apiKeys.lastUsed", {
                              time: key.lastUsedAt
                                ? new Date(key.lastUsedAt).toLocaleString()
                                : t("apiKeys.neverUsed"),
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!key.isActive}
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleRevokeKey(key.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("apiKeys.revoke")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Documentation Section */}
        <Card className="p-8 bg-card/50 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Shield className="w-32 h-32" />
          </div>
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-accent-blue rounded-full" />
            {t("apiKeys.guideTitle")}
          </h2>
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-medium text-foreground">
                {t("apiKeys.authTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("apiKeys.authDesc")}
              </p>
              <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-xs">
                Authorization: Bearer slm_your_api_key_here
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-medium text-foreground">
                  {t("apiKeys.createLink")}
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  POST /api/v1/links
                </p>
                <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-[10px] overflow-x-auto">
                  {`curl -X POST ${window.location.origin}/api/v1/links \\
  -H "Authorization: Bearer <Key>" \\
  -H "Content-Type: application/json" \\
  -d '{"originalUrl":"https://google.com","shortCode":"gg"}'`}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-medium text-foreground">
                  {t("apiKeys.queryLink")}
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  GET /api/v1/links
                </p>
                <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-[10px] overflow-x-auto">
                  {`curl ${window.location.origin}/api/v1/links \\
  -H "Authorization: Bearer <Key>"`}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
