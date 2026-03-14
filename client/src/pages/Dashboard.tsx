import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Plus, Link2, TrendingUp, AlertCircle, Copy, Trash2, Edit, Search, ExternalLink, X, Upload, Download, Calendar } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "invalid">("all");
  const [importText, setImportText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    originalUrl: "",
    shortCode: "",
    customDomain: "",
    description: "",
    expiresAt: "",
  });

  const linksQuery = trpc.links.list.useQuery();
  const domainsQuery = trpc.domains.list.useQuery();
  const createLinkMutation = trpc.links.create.useMutation();
  const updateLinkMutation = trpc.links.update.useMutation();
  const deleteLinkMutation = trpc.links.delete.useMutation();
  const batchImportMutation = trpc.links.batchImport.useMutation();
  const exportQuery = trpc.links.export.useQuery;

  // Filter links locally
  const filteredLinks = useMemo(() => {
    const links = linksQuery.data || [];
    return links.filter(link => {
      const matchesSearch = !searchQuery || 
        link.shortCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.originalUrl.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && link.isValid && link.isActive) ||
        (statusFilter === "invalid" && !link.isValid);
      return matchesSearch && matchesStatus;
    });
  }, [linksQuery.data, searchQuery, statusFilter]);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.originalUrl || !formData.shortCode) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await createLinkMutation.mutateAsync({
        originalUrl: formData.originalUrl,
        shortCode: formData.shortCode,
        customDomain: formData.customDomain || undefined,
        description: formData.description,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined,
      });

      toast.success("Short link created successfully!");
      setFormData({ originalUrl: "", shortCode: "", customDomain: "", description: "", expiresAt: "" });
      setIsCreateOpen(false);
      linksQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to create link");
    }
  };

  const handleEditLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLink) return;

    try {
      await updateLinkMutation.mutateAsync({
        linkId: selectedLink.id,
        originalUrl: formData.originalUrl,
        shortCode: formData.shortCode,
        description: formData.description || null,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : null,
      });

      toast.success("Link updated successfully!");
      setIsEditOpen(false);
      setSelectedLink(null);
      linksQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to update link");
    }
  };

  const handleDeleteLink = async () => {
    if (!selectedLink) return;

    try {
      await deleteLinkMutation.mutateAsync({ linkId: selectedLink.id });
      toast.success("Link deleted successfully!");
      setIsDeleteOpen(false);
      setSelectedLink(null);
      linksQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete link");
    }
  };

  const handleBatchImport = async () => {
    if (!importText.trim()) {
      toast.error("Please enter links to import");
      return;
    }

    // Parse input (支持 JSON 数组或每行一个 URL)
    let links: { originalUrl: string; shortCode?: string; description?: string }[] = [];
    
    try {
      // 尝试解析为 JSON 数组
      const parsed = JSON.parse(importText);
      if (Array.isArray(parsed)) {
        links = parsed.map((item: any) => ({
          originalUrl: typeof item === "string" ? item : item.url || item.originalUrl,
          shortCode: item.shortCode || item.code,
          description: item.description || item.desc,
        }));
      }
    } catch {
      // 解析为每行一个 URL
      links = importText
        .split("\n")
        .map(line => line.trim())
        .filter(line => line && line.startsWith("http"))
        .map(line => ({ originalUrl: line }));
    }

    if (links.length === 0) {
      toast.error("No valid links found");
      return;
    }

    try {
      const result = await batchImportMutation.mutateAsync({ links });
      toast.success(`Imported ${result.success.length} links${result.failed.length > 0 ? `, ${result.failed.length} failed` : ""}`);
      setIsImportOpen(false);
      setImportText("");
      linksQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to import links");
    }
  };

  const handleExport = async (format: "json" | "csv") => {
    try {
      const result = await exportQuery({ format, includeStats: true });
      
      if (format === "json") {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `links-export-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([result.data as string], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `links-export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      toast.success("Export completed!");
    } catch (error: any) {
      toast.error(error.message || "Failed to export links");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportText(content);
    };
    reader.readAsText(file);
  };

  const openEditDialog = (link: any) => {
    setSelectedLink(link);
    setFormData({
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      customDomain: link.customDomain || "",
      description: link.description || "",
      expiresAt: link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 16) : "",
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (link: any) => {
    setSelectedLink(link);
    setIsDeleteOpen(true);
  };

  const copyToClipboard = (text: string) => {
    const fullUrl = `${window.location.origin}/s/${text}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success("Link copied to clipboard!");
  };

  const links = linksQuery.data || [];
  const totalClicks = links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
  const invalidLinks = links.filter(link => !link.isValid).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Smart Link Manager</h1>
              <p className="mt-1 text-muted-foreground">Manage your short links and track analytics</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="lg" className="gap-2">
                    <Upload className="w-4 h-4" />
                    Import
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Batch Import Links</DialogTitle>
                    <DialogDescription>
                      Paste URLs (one per line) or JSON array format
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload File
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
                      placeholder="https://example.com/1&#10;https://example.com/2&#10;&#10;Or JSON:&#10;[{&quot;originalUrl&quot;: &quot;https://...&quot;, &quot;shortCode&quot;: &quot;abc&quot;}]"
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      className="w-full h-48 p-3 border border-border rounded-md bg-background text-foreground text-sm font-mono resize-none"
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleBatchImport} disabled={batchImportMutation.isPending}>
                        {batchImportMutation.isPending ? "Importing..." : "Import"}
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="lg" className="gap-2" onClick={() => handleExport("csv")}>
                <Download className="w-4 h-4" />
                Export
              </Button>

              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create Link
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Short Link</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateLink} className="space-y-4">
                    <div>
                      <Label htmlFor="originalUrl">Original URL *</Label>
                      <Input
                        id="originalUrl"
                        type="url"
                        placeholder="https://example.com/very/long/url"
                        value={formData.originalUrl}
                        onChange={(e) =>
                          setFormData({ ...formData, originalUrl: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="shortCode">Short Code *</Label>
                      <Input
                        id="shortCode"
                        placeholder="mylink"
                        value={formData.shortCode}
                        onChange={(e) =>
                          setFormData({ ...formData, shortCode: e.target.value })
                        }
                        required
                        pattern="^[a-zA-Z0-9_-]{3,20}$"
                        title="3-20 characters, alphanumeric, dash, or underscore"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customDomain">Custom Domain (Optional)</Label>
                      <select
                        id="customDomain"
                        value={formData.customDomain}
                        onChange={(e) =>
                          setFormData({ ...formData, customDomain: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                      >
                        <option value="">Select a domain...</option>
                        {(domainsQuery.data || []).map(domain => (
                          <option key={domain.id} value={domain.domain}>
                            {domain.domain} {domain.isVerified ? "✓" : "(pending)"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Input
                        id="description"
                        placeholder="Add a note about this link"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="expiresAt">Expires At (Optional)</Label>
                      <Input
                        id="expiresAt"
                        type="datetime-local"
                        value={formData.expiresAt}
                        onChange={(e) =>
                          setFormData({ ...formData, expiresAt: e.target.value })
                        }
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={createLinkMutation.isPending}>
                      {createLinkMutation.isPending ? "Creating..." : "Create Link"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Links</p>
                <p className="text-3xl font-bold mt-2">{links.length}</p>
              </div>
              <Link2 className="w-8 h-8 text-accent opacity-50" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Clicks</p>
                <p className="text-3xl font-bold mt-2">{totalClicks}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-accent opacity-50" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Invalid Links</p>
                <p className="text-3xl font-bold mt-2 text-destructive">{invalidLinks}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-destructive opacity-50" />
            </div>
          </Card>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="container pb-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by short code or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-border rounded-md bg-background text-foreground"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="invalid">Invalid Only</option>
          </select>
        </div>
      </div>

      {/* Links Table */}
      <div className="container pb-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Your Links ({filteredLinks.length})</h2>

          {linksQuery.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredLinks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{searchQuery || statusFilter !== "all" ? "No links match your filters" : "No links yet. Create your first short link to get started!"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold">Short Code</th>
                    <th className="text-left py-3 px-4 font-semibold">Original URL</th>
                    <th className="text-left py-3 px-4 font-semibold">Clicks</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold">Expires</th>
                    <th className="text-left py-3 px-4 font-semibold">Created</th>
                    <th className="text-left py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLinks.map((link) => (
                    <tr key={link.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="py-3 px-4 font-mono text-accent-blue font-semibold">
                        <div className="text-sm">{link.shortCode}</div>
                        {link.customDomain && <div className="text-xs text-muted-foreground">{link.customDomain}</div>}
                      </td>
                      <td className="py-3 px-4 truncate text-muted-foreground text-xs max-w-xs">
                        <a href={link.originalUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent-blue flex items-center gap-1">
                          {link.originalUrl.length > 40 ? link.originalUrl.slice(0, 40) + "..." : link.originalUrl}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </td>
                      <td className="py-3 px-4">{link.clickCount || 0}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            link.isValid
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                          }`}
                        >
                          {link.isValid ? "Valid" : "Invalid"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {link.expiresAt ? (
                          new Date(link.expiresAt) < new Date() ? (
                            <span className="text-red-500">Expired</span>
                          ) : (
                            new Date(link.expiresAt).toLocaleDateString()
                          )
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {new Date(link.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => copyToClipboard(link.shortCode)}
                            title="Copy link"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openEditDialog(link)}
                            title="Edit link"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(link)}
                            title="Delete link"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Link</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditLink} className="space-y-4">
            <div>
              <Label htmlFor="edit-originalUrl">Original URL</Label>
              <Input
                id="edit-originalUrl"
                type="url"
                value={formData.originalUrl}
                onChange={(e) => setFormData({ ...formData, originalUrl: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-shortCode">Short Code</Label>
              <Input
                id="edit-shortCode"
                value={formData.shortCode}
                onChange={(e) => setFormData({ ...formData, shortCode: e.target.value })}
                required
                pattern="^[a-zA-Z0-9_-]{3,20}$"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-expiresAt">Expires At</Label>
              <Input
                id="edit-expiresAt"
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateLinkMutation.isPending}>
                {updateLinkMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Link</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the link <strong className="text-foreground">{selectedLink?.shortCode}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteLink} disabled={deleteLinkMutation.isPending}>
              {deleteLinkMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
