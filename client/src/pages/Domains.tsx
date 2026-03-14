import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Check, AlertCircle, Trash2 } from "lucide-react";

export default function Domains() {
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
      toast.error("Please enter a domain");
      return;
    }

    try {
      const result = await addDomainMutation.mutateAsync({
        domain,
        verificationMethod,
      });

      toast.success("Domain added! Please verify it using the instructions below.");
      setDomain("");
      setIsAddOpen(false);
      domainsQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to add domain");
    }
  };

  const handleVerifyDomain = async (domainId: number) => {
    try {
      await verifyDomainMutation.mutateAsync({ domainId });
      toast.success("Domain verified!");
      domainsQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to verify domain");
    }
  };

  const handleDeleteDomain = async (domainId: number) => {
    if (confirm("Are you sure you want to delete this domain?")) {
      try {
        await deleteDomainMutation.mutateAsync({ domainId });
        toast.success("Domain deleted!");
        domainsQuery.refetch();
      } catch (error: any) {
        toast.error(error.message || "Failed to delete domain");
      }
    }
  };

  const domains = domainsQuery.data || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Custom Domains</h1>
              <p className="mt-1 text-muted-foreground">Manage your short link domains</p>
            </div>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Domain
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Custom Domain</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddDomain} className="space-y-4">
                  <div>
                    <Label htmlFor="domain">Domain *</Label>
                    <Input
                      id="domain"
                      placeholder="s.yourdomain.com"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      required
                      pattern="^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
                      title="Valid domain name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="method">Verification Method</Label>
                    <select
                      id="method"
                      value={verificationMethod}
                      onChange={(e) => setVerificationMethod(e.target.value as any)}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                    >
                      <option value="cname">CNAME Record</option>
                      <option value="txt">TXT Record</option>
                      <option value="file">File Upload</option>
                    </select>
                  </div>
                  <Button type="submit" className="w-full" disabled={addDomainMutation.isPending}>
                    {addDomainMutation.isPending ? "Adding..." : "Add Domain"}
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
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : domains.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No domains yet. Add your first custom domain to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map((domain) => (
                <div key={domain.id} className="p-4 border border-border rounded-lg hover:bg-secondary/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{domain.domain}</h3>
                        {domain.isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded text-xs font-medium">
                            <Check className="w-3 h-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 rounded text-xs font-medium">
                            <AlertCircle className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </div>

                      {!domain.isVerified && (
                        <div className="mt-3 p-3 bg-secondary/50 rounded text-sm space-y-2">
                          <p className="font-semibold">Verification Instructions ({domain.verificationMethod})</p>
                          {domain.verificationMethod === "cname" && (
                            <div>
                              <p>Add this CNAME record to your DNS:</p>
                              <code className="block bg-background p-2 rounded mt-1 font-mono text-xs break-all">
                                s CNAME {window.location.hostname}
                              </code>
                            </div>
                          )}
                          {domain.verificationMethod === "txt" && (
                            <div>
                              <p>Add this TXT record to your DNS:</p>
                              <code className="block bg-background p-2 rounded mt-1 font-mono text-xs break-all">
                                v=verification {domain.verificationToken}
                              </code>
                            </div>
                          )}
                          {domain.verificationMethod === "file" && (
                            <div>
                              <p>Upload this file to your domain:</p>
                              <code className="block bg-background p-2 rounded mt-1 font-mono text-xs">
                                /.well-known/verification-{domain.verificationToken}
                              </code>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground mt-2">
                        Added on {new Date(domain.createdAt).toLocaleDateString()}
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
                          Verify
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteDomain(domain.id)}
                        disabled={deleteDomainMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
          <h2 className="text-lg font-semibold mb-4">How to Use Custom Domains</h2>
          <div className="space-y-3 text-sm">
            <p>
              Custom domains allow you to create short links with your own domain, such as <code className="bg-background px-2 py-1 rounded">https://s.yourdomain.com/abc123</code>
            </p>
            <p>
              After adding a domain, you'll need to verify it by adding DNS records or uploading a verification file. Once verified, you can use it when creating new short links.
            </p>
            <p>
              The same short code can be used with different domains, so you can have <code className="bg-background px-2 py-1 rounded">s1.domain.com/abc123</code> and <code className="bg-background px-2 py-1 rounded">s2.domain.com/abc123</code> pointing to different links.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
