import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, GitCompare } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LinkFormData, LinkFormDialogProps, Link, Domain } from "@/types/dashboard";

/**
 * 获取空的表单数据
 */
const getEmptyFormData = (): LinkFormData => ({
  originalUrl: "",
  shortCode: "",
  customDomain: "",
  description: "",
  expiresAt: "",
  password: "",
  tagsString: "",
  seoTitle: "",
  seoDescription: "",
  seoImage: "",
  abTestEnabled: 0,
  abTestUrl: "",
  abTestRatio: 50,
});

/**
 * 从 Link 对象获取表单数据
 */
const getFormDataFromLink = (link: Link): LinkFormData => ({
  originalUrl: link.originalUrl,
  shortCode: link.shortCode,
  customDomain: link.customDomain || "",
  description: link.description || "",
  expiresAt: link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 16) : "",
  password: "", // 密码不回显
  tagsString: link.tags ? link.tags.join(", ") : "",
  seoTitle: link.seoTitle || "",
  seoDescription: link.seoDescription || "",
  seoImage: link.seoImage || "",
  abTestEnabled: link.abTestEnabled || 0,
  abTestUrl: link.abTestUrl || "",
  abTestRatio: link.abTestRatio || 50,
});

/**
 * LinkFormDialog 组件
 * 合并创建和编辑链接表单，使用 mode prop 区分
 */
export function LinkFormDialog({
  mode,
  open,
  onOpenChange,
  initialData,
  domains,
  onSubmit,
  isSubmitting,
  onGenerateSeo,
  isGeneratingSeo,
}: LinkFormDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<LinkFormData>(getEmptyFormData());

  // 当打开对话框或初始数据变化时更新表单
  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialData) {
        setFormData(getFormDataFromLink(initialData));
      } else {
        setFormData(getEmptyFormData());
      }
    }
  }, [open, mode, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const handleGenerateSeoClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!formData.originalUrl) {
      return;
    }
    const result = await onGenerateSeo(formData.originalUrl);
    if (result.success) {
      setFormData((prev) => ({
        ...prev,
        seoTitle: result.seoTitle || prev.seoTitle,
        seoDescription: result.seoDescription || prev.seoDescription,
      }));
    }
  };

  const handleInputChange = (field: keyof LinkFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value as any }));
  };

  const isCreate = mode === "create";
  const title = isCreate ? t("dashboard.createLink") : t("dashboard.editLink");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Original URL */}
          <div>
            <Label htmlFor="originalUrl">{t("dashboard.originalUrl")} *</Label>
            <Input
              id="originalUrl"
              type="url"
              placeholder={t("dashboard.urlPlaceholder")}
              value={formData.originalUrl}
              onChange={(e) => handleInputChange("originalUrl", e.target.value)}
              required
            />
          </div>

          {/* Short Code */}
          <div>
            <Label htmlFor="shortCode">{t("dashboard.shortCode")} *</Label>
            <Input
              id="shortCode"
              placeholder={t("dashboard.shortCodePlaceholder")}
              value={formData.shortCode}
              onChange={(e) => handleInputChange("shortCode", e.target.value)}
              required
              pattern="^[a-zA-Z0-9_-]{3,20}$"
              title={t("dashboard.shortCodePatternTip")}
            />
          </div>

          {/* Custom Domain (Create only) */}
          {isCreate && (
            <div>
              <Label htmlFor="customDomain">
                {t("dashboard.customDomain")} ({t("common.optional")})
              </Label>
              <select
                id="customDomain"
                value={formData.customDomain}
                onChange={(e) => handleInputChange("customDomain", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                <option value="">{t("dashboard.selectDomain")}</option>
                {domains.map((domain: Domain) => (
                  <option key={domain.id} value={domain.domain}>
                    {domain.domain} {domain.isVerified ? "✓" : t("dashboard.pending")}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <Label htmlFor="description">
              {t("dashboard.description")} ({t("common.optional")})
            </Label>
            <Input
              id="description"
              placeholder={t("dashboard.addNote")}
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
            />
          </div>

          {/* Expires At */}
          <div>
            <Label htmlFor="expiresAt">
              {t("dashboard.expiresAt")} ({t("common.optional")})
            </Label>
            <Input
              id="expiresAt"
              type="datetime-local"
              value={formData.expiresAt}
              onChange={(e) => handleInputChange("expiresAt", e.target.value)}
            />
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password">
              {t("dashboard.linkPassword")} ({t("common.optional")})
            </Label>
            <Input
              id="password"
              type="password"
              placeholder={isCreate ? t("dashboard.passwordPlaceholder") : t("dashboard.passwordEditPlaceholder")}
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
            />
          </div>

          {/* Tags */}
          <div>
            <Label htmlFor="tags">
              {t("dashboard.tagsLabel")} ({t("common.optional")})
            </Label>
            <Input
              id="tags"
              placeholder={t("dashboard.tagsPlaceholder")}
              value={formData.tagsString}
              onChange={(e) => handleInputChange("tagsString", e.target.value)}
            />
          </div>

          {/* A/B Testing Section */}
          <div className="pt-2 border-t border-border mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-medium">{t("dashboard.abTestSection", "A/B 智能测试 (A/B Testing)")}</h4>
              </div>
              <Switch
                checked={formData.abTestEnabled === 1}
                onCheckedChange={(checked) => handleInputChange("abTestEnabled", checked ? 1 : 0)}
              />
            </div>
            
            {formData.abTestEnabled === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                  <Label htmlFor="abTestUrl" className="text-xs">
                    {t("dashboard.variantBUrl", "变种 B 目标链接 (Variant B URL)")} *
                  </Label>
                  <Input
                    id="abTestUrl"
                    type="url"
                    placeholder={t("dashboard.urlPlaceholder")}
                    value={formData.abTestUrl}
                    onChange={(e) => handleInputChange("abTestUrl", e.target.value)}
                    required={formData.abTestEnabled === 1}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs">{t("dashboard.trafficSplit", "流量拆分比例 (Traffic Split)")}</Label>
                    <span className="text-xs font-mono text-muted-foreground">
                      A: {formData.abTestRatio}% / B: {100 - formData.abTestRatio}%
                    </span>
                  </div>
                  <Slider
                    value={[formData.abTestRatio]}
                    min={10}
                    max={90}
                    step={1}
                    onValueChange={(vals) => handleInputChange("abTestRatio", vals[0])}
                    className="py-2"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SEO Section */}
          <div className="pt-2 border-t border-border mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">{t("dashboard.seoSection")}</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateSeoClick}
                disabled={isGeneratingSeo || !formData.originalUrl}
                className="h-7 text-xs flex items-center gap-1 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary transition-all duration-300"
              >
                <Sparkles className={`w-3 h-3 ${isGeneratingSeo ? "animate-pulse" : ""}`} />
                {isGeneratingSeo ? t("common.loading") : t("dashboard.aiGenerateSeo")}
              </Button>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="seoTitle" className="text-xs">
                  {t("dashboard.seoTitle")}
                </Label>
                <Input
                  id="seoTitle"
                  placeholder={t("dashboard.seoTitlePlaceholder")}
                  value={formData.seoTitle}
                  onChange={(e) => handleInputChange("seoTitle", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="seoDescription" className="text-xs">
                  {t("dashboard.seoDescription")}
                </Label>
                <Input
                  id="seoDescription"
                  placeholder={t("dashboard.seoDescriptionPlaceholder")}
                  value={formData.seoDescription}
                  onChange={(e) => handleInputChange("seoDescription", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="seoImage" className="text-xs">
                  {t("dashboard.seoImage")}
                </Label>
                <Input
                  id="seoImage"
                  placeholder={t("dashboard.seoImagePlaceholder")}
                  value={formData.seoImage}
                  onChange={(e) => handleInputChange("seoImage", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (isCreate ? t("dashboard.creating") : t("dashboard.saving")) : t("common.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
