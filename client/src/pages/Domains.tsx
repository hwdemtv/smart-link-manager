import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import React, { useState } from "react";
import { toast } from "sonner";
import { Plus, Check, AlertCircle, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DomainRecord {
  id: number;
  domain: string;
  isVerified: boolean;
  verificationMethod: string;
  verificationToken?: string;
  createdAt: Date | string;
}

export default function Domains() {
  const { t } = useTranslation();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<"cname" | "txt" | "file">("cname");

  const domainsQuery = trpc.domains.list.useQuery();
  const addDomainMutation = trpc.domains.add.useMutation();
  const verifyDomainMutation = trpc.domains.verify.useMutation();
  const deleteDomainMutation = trpc.domains.delete.useMutation();

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!domain) {
      toast.error(t("domains.enterDomain"));
      return;
    }

    try {
      await (addDomainMutation.mutateAsync as any)({
        domain,
        verificationMethod,
      });

      toast.success(t("domains.addSuccess"));
      setDomain("");
      setIsAddOpen(false);
      domainsQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || t("domains.failedToAdd"));
    }
  };

  const handleVerifyDomain = async (domainId: number) => {
    try {
      await (verifyDomainMutation.mutateAsync as any)({ domainId });
      toast.success(t("domains.verifiedSuccess"));
      domainsQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || t("domains.failedToVerify"));
    }
  };

  const handleDeleteDomain = async (domainId: number) => {
    try {
      await (deleteDomainMutation.mutateAsync as any)({ domainId });
      toast.success(t("domains.deleteSuccess"));
      domainsQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || t("domains.failedToDelete"));
    }
  };

  const domains = (domainsQuery.data as unknown as DomainRecord[]) || [];

  return (
    <div className="min-h-content bg-background">
      {/* Header (Simplified for Layout) */}
      <div className="border-b border-border/50 bg-card/10">
        <div className="container py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t("domains.title")}</h1>
              <p className="mt-1 text-muted-foreground">{t("domains.subtitle")}</p>
            </div>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t("domains.addDomain")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("domains.addDomainTitle")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddDomain} className="space-y-4">
                  <div>
                    <Label htmlFor="domain">{t("domains.domainLabel")} *</Label>
                    <Input
                      id="domain"
                      placeholder="s.yourdomain.com"
                      value={domain}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDomain(e.target.value)}
                      required
                      pattern="^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
                      title={t("domains.domainLabel")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="method">{t("domains.verificationMethod")}</Label>
                    <select
                      id="method"
                      value={verificationMethod}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVerificationMethod(e.target.value as any)}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    >
                      <option value="cname">{t("domains.cnameRecord")}</option>
                      <option value="txt">{t("domains.txtRecord")}</option>
                      <option value="file">{t("domains.fileUpload")}</option>
                    </select>
                  </div>
                  <Button type="submit" className="w-full" disabled={addDomainMutation.isPending}>
                    {addDomainMutation.isPending ? t("domains.adding") : t("domains.addDomain")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Domains List */}
      <div className="container py-8">
        <Card className="p-6">
          {domainsQuery.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
          ) : domains.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t("domains.noDomains")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map((domain: DomainRecord) => (
                <div key={domain.id} className="p-4 border border-border rounded-lg hover:bg-secondary/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{domain.domain}</h3>
                        {domain.isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded text-xs font-medium">
                            <Check className="w-3 h-3" />
                            {t("domains.verified")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 rounded text-xs font-medium">
                            <AlertCircle className="w-3 h-3" />
                            {t("domains.pending")}
                          </span>
                        )}
                      </div>

                      {!domain.isVerified && (
                        <div className="mt-3 p-3 bg-secondary/50 rounded text-sm space-y-2">
                          <p className="font-semibold">{t("domains.verificationInstructions", { method: domain.verificationMethod.toUpperCase() })}</p>
                          {domain.verificationMethod === "cname" && (
                            <div>
                              <p>{t("domains.addCnamePrompt")}</p>
                              <code className="block bg-background p-2 rounded mt-1 font-mono text-xs break-all">
                                s CNAME {window.location.hostname}
                              </code>
                            </div>
                          )}
                          {domain.verificationMethod === "txt" && (
                            <div>
                              <p>{t("domains.addTxtPrompt")}</p>
                              <code className="block bg-background p-2 rounded mt-1 font-mono text-xs break-all">
                                v=verification {domain.verificationToken}
                              </code>
                            </div>
                          )}
                          {domain.verificationMethod === "file" && (
                            <div>
                              <p>{t("domains.uploadFilePrompt")}</p>
                              <code className="block bg-background p-2 rounded mt-1 font-mono text-xs">
                                /.well-known/verification-{domain.verificationToken}
                              </code>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground mt-2">
                        {t("domains.addedOn", { date: new Date(domain.createdAt).toLocaleDateString() })}
                      </p>
                    </div>

                    <div className="flex gap-2 ml-4">
                      {!domain.isVerified && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVerifyDomain(domain.id)}
                          disabled={verifyDomainMutation.isPending}
                        >
                          {t("domains.verify")}
                        </Button>
                      )}
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={deleteDomainMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("domains.deleteConfirm")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("common.thisActionCannotBeUndone")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDomain(domain.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Info Section */}
      <div className="container py-8">
        <Card className="p-6 bg-secondary/50">
          <h2 className="text-lg font-semibold mb-4">{t("domains.howToUse")}</h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              {t("domains.howToUseDesc1")} <code className="bg-background px-2 py-1 rounded text-foreground">https://s.yourdomain.com/abc123</code>
            </p>
            <p>
              {t("domains.howToUseDesc2")}
            </p>
            <p>
              {t("domains.howToUseDesc3")}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
