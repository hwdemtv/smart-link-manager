import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Sparkles, GitCompare, Settings2, Link2, Share2, Info, ChevronDown, Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  LinkFormData,
  LinkFormDialogProps,
  Link,
  Domain,
  RedirectType,
} from "@/types/dashboard";

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
  shareSuffix: "",
  seoPriority: 0,
  noIndex: 0,
  redirectType: "302",
  seoKeywords: "",
  canonicalUrl: "",
  ogVideoUrl: "",
  ogVideoWidth: 0,
  ogVideoHeight: 0,
  abTestEnabled: 0,
  abTestUrl: "",
  abTestRatio: 50,
  groupId: null,
});

/**
 * 从 Link 对象获取表单数据
 */
const getFormDataFromLink = (link: Link): LinkFormData => ({
  originalUrl: link.originalUrl,
  shortCode: link.shortCode,
  customDomain: link.customDomain || "",
  description: link.description || "",
  expiresAt: link.expiresAt
    ? new Date(link.expiresAt).toISOString().slice(0, 16)
    : "",
  password: "", // 密码不回显
  tagsString: link.tags ? link.tags.join(", ") : "",
  seoTitle: link.seoTitle || "",
  seoDescription: link.seoDescription || "",
  seoImage: link.seoImage || "",
  shareSuffix: link.shareSuffix || "",
  seoPriority: link.seoPriority || 0,
  noIndex: link.noIndex || 0,
  redirectType: (link.redirectType as RedirectType) || "302",
  seoKeywords: link.seoKeywords || "",
  canonicalUrl: link.canonicalUrl || "",
  ogVideoUrl: link.ogVideoUrl || "",
  ogVideoWidth: link.ogVideoWidth || 0,
  ogVideoHeight: link.ogVideoHeight || 0,
  abTestEnabled: link.abTestEnabled || 0,
  abTestUrl: link.abTestUrl || "",
  abTestRatio: link.abTestRatio || 50,
  groupId: link.groupId ?? null,
});

/**
 * LinkFormDialog 组件
 */
export function LinkFormDialog({
  mode,
  open,
  onOpenChange,
  initialData,
  domains,
  groups,
  onSubmit,
  isSubmitting,
  onGenerateSeo,
  isGeneratingSeo,
  subscriptionTier,
  defaultShareSuffix,
}: LinkFormDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<LinkFormData>(getEmptyFormData());
  const [openSections, setOpenSections] = useState<string[]>([]);

  // 当打开对话框或初始数据变化时更新表单
  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialData) {
        setFormData(getFormDataFromLink(initialData));
      } else {
        const emptyData = getEmptyFormData();
        // 如果不可自定义，且是创建模式，预生成短码
        if (subscriptionTier !== "business") {
          const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          let randomCode = "";
          for (let i = 0; i < 6; i++) {
            randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          emptyData.shortCode = randomCode;
        }
        // 创建模式：自动填充全局默认分享口令后缀
        if (defaultShareSuffix) {
          emptyData.shareSuffix = defaultShareSuffix;
        }
        setFormData(emptyData);
      }
      setOpenSections([]); // 重置折叠项
    }
  }, [open, mode, initialData, subscriptionTier, defaultShareSuffix]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const handleGenerateSeoClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!formData.originalUrl) {
      return;
    }
    const result = await onGenerateSeo(formData.originalUrl, formData.description);
    if (result.success) {
      setFormData(prev => ({
        ...prev,
        seoTitle: result.seoTitle || prev.seoTitle,
        seoDescription: result.seoDescription || prev.seoDescription,
        seoImage: result.seoImage || prev.seoImage,
      }));
      // 自动展开社交分享面板
      setOpenSections(prev => prev.includes("social-seo") ? prev : [...prev, "social-seo"]);
    }
  };

  const handleInputChange = (
    field: keyof LinkFormData,
    value: string | number | null
  ) => {
    setFormData(prev => ({ ...prev, [field]: value as any }));
  };

  const isCreate = mode === "create";
  const title = isCreate ? t("dashboard.createLink") : t("dashboard.editLink");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col bg-[#f9fafb] border-none shadow-2xl theme-transition">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl font-bold text-slate-800 tracking-tight">{title}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
          <div className="flex-1 overflow-y-auto pr-2 space-y-5 custom-scrollbar">
            {/* --- 1. 基础信息区域 (固定可见) --- */}
            <div className="space-y-4">
              {/* Original URL */}
              <div className="space-y-2">
                <Label htmlFor="originalUrl" className="text-[13px] font-bold text-slate-600 ml-1">
                  {t("dashboard.originalUrl")} *
                </Label>
                <Input
                  id="originalUrl"
                  type="url"
                  placeholder={t("dashboard.urlPlaceholder")}
                  value={formData.originalUrl}
                  onChange={e => handleInputChange("originalUrl", e.target.value)}
                  className="h-11 rounded-xl border-slate-200/60 bg-white shadow-sm focus-visible:ring-[#009688]/20 focus-visible:border-[#009688]/40 transition-all text-sm"
                  required
                />
              </div>

              {/* Short Code & Custom Domain */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <Label htmlFor="shortCode" className="text-[13px] font-bold text-slate-600">
                      {t("dashboard.shortCode")} *
                    </Label>
                    {subscriptionTier === "business" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                          let result = "";
                          for (let i = 0; i < 6; i++) {
                            result += chars.charAt(Math.floor(Math.random() * chars.length));
                          }
                          handleInputChange("shortCode", result);
                        }}
                        className="h-6 px-1.5 text-[11px] flex items-center gap-1.5 text-slate-400 hover:text-[#009688] hover:bg-[#009688]/5 transition-all rounded-lg"
                      >
                        {t("dashboard.generateRandom")}
                      </Button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="shortCode"
                      placeholder={subscriptionTier === "business" ? t("dashboard.shortCodePlaceholder") : t("dashboard.shortCodeAutoGenerated")}
                      value={formData.shortCode}
                      onChange={e => handleInputChange("shortCode", e.target.value)}
                      className={`h-11 rounded-xl border-slate-200/60 bg-white shadow-sm focus-visible:ring-[#009688]/20 transition-all text-sm ${subscriptionTier !== "business" ? "bg-slate-50/50 cursor-not-allowed text-slate-400 font-mono" : ""}`}
                      required
                      readOnly={subscriptionTier !== "business"}
                      pattern="^[a-zA-Z0-9_-]{3,20}$"
                      title={t("dashboard.shortCodePatternTip")}
                    />
                    {subscriptionTier !== "business" && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Info className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customDomain" className="text-[13px] font-bold text-slate-600 ml-1">
                    {t("dashboard.customDomain")}
                  </Label>
                  <div className="relative">
                    <select
                      id="customDomain"
                      value={formData.customDomain}
                      onChange={e => handleInputChange("customDomain", e.target.value)}
                      className="w-full h-11 px-3.5 py-2 border border-slate-200/60 rounded-xl bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/10 transition-all appearance-none cursor-pointer text-slate-700"
                    >
                      <option value="">{t("dashboard.selectDomain")}</option>
                      {domains.map((domain: Domain) => (
                        <option key={domain.id} value={domain.domain}>
                          {domain.domain} {domain.isVerified ? "✓" : t("dashboard.pending")}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Group & Tags (常驻) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="groupId" className="text-[13px] font-bold text-slate-600 ml-1">{t("dashboard.group")}</Label>
                  <div className="relative">
                    <select
                      id="groupId"
                      value={formData.groupId ?? ""}
                      onChange={e => handleInputChange("groupId", e.target.value === "" ? null : Number(e.target.value))}
                      className="w-full h-11 px-3.5 py-2 border border-slate-200/60 rounded-xl bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/10 transition-all appearance-none cursor-pointer text-slate-700"
                    >
                      <option value="">{t("dashboard.noGroup")}</option>
                      {groups.map(group => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags" className="text-[13px] font-bold text-slate-600 ml-1">{t("dashboard.tagsLabel")}</Label>
                  <Input
                    id="tags"
                    placeholder={t("dashboard.tagsPlaceholder")}
                    value={formData.tagsString}
                    onChange={e => handleInputChange("tagsString", e.target.value)}
                    className="h-11 rounded-xl border-slate-200/60 bg-white shadow-sm focus-visible:ring-[#009688]/10 text-sm"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-[13px] font-bold text-slate-600 ml-1">
                  {t("dashboard.description")} ({t("common.optional")})
                </Label>
                <Input
                  id="description"
                  placeholder={t("dashboard.descriptionPlaceholder")}
                  value={formData.description}
                  onChange={e => handleInputChange("description", e.target.value)}
                  className="h-11 rounded-xl border-slate-200/60 bg-white shadow-sm focus-visible:ring-[#009688]/10 text-sm"
                />
                <div className="mt-2 p-2.5 rounded-xl border border-cyan-100/50 bg-cyan-50/30 flex items-center gap-2">
                  <p className="text-[11.5px] text-cyan-700/70 leading-relaxed font-medium">
                    {t("dashboard.descriptionHint")}
                  </p>
                </div>
              </div>
            </div>

            {/* --- 2. 设置面板区域 (Accordion) --- */}
            <div className="pt-2 space-y-3">
              <Accordion type="multiple" className="w-full space-y-3" value={openSections} onValueChange={setOpenSections}>
                {/* 社交分享与 SEO 专题 (还原) */}
                <AccordionItem value="social-seo" className="border-none">
                  <AccordionTrigger className="flex items-center justify-between py-3 hover:no-underline group px-3 rounded-xl hover:bg-white transition-all shadow-none hover:shadow-sm border border-transparent hover:border-slate-100 [&[data-state=open]>div>div>svg]:text-[#009688] [&[data-state=open]>div>div]:bg-[#009688]/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center transition-colors">
                        <Share2 className="w-3.5 h-3.5 text-slate-500 transition-colors" />
                      </div>
                      <span className="text-[13.5px] font-bold text-slate-700">{t("dashboard.socialShare")}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateSeoClick(e as any);
                      }}
                      disabled={isGeneratingSeo || !formData.originalUrl}
                      className="h-7 text-[10px] font-black flex items-center gap-1.5 border-[#009688]/20 bg-[#e0f2f1]/50 text-[#009688] hover:bg-[#009688] hover:text-white transition-all rounded-lg mr-1 px-2.5 shadow-none active:scale-[0.95]"
                    >
                      <Sparkles className={`w-3 h-3 ${isGeneratingSeo ? "animate-pulse" : ""}`} />
                      {isGeneratingSeo ? t("common.loading") : t("dashboard.aiGenerateSeo")}
                    </Button>
                  </AccordionTrigger>
                  <AccordionContent className="pt-3 pb-4 px-4 space-y-4 bg-white/40 rounded-b-xl border-x border-b border-slate-50">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="shareSuffix" className="text-xs font-bold text-slate-500 ml-1">
                          {t("dashboard.shareSuffix")}
                        </Label>
                        <Input
                          id="shareSuffix"
                          placeholder={t("dashboard.shareSuffixPlaceholder")}
                          value={formData.shareSuffix}
                          onChange={e => handleInputChange("shareSuffix", e.target.value)}
                          className="h-10 rounded-xl border-slate-200/60 text-sm shadow-none focus-visible:ring-[#009688]/10 bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="seoTitle" className="text-xs font-bold text-slate-500 ml-1">
                          {t("dashboard.seoTitle")}
                        </Label>
                        <Input
                          id="seoTitle"
                          placeholder={t("dashboard.seoTitlePlaceholder")}
                          value={formData.seoTitle}
                          onChange={e => handleInputChange("seoTitle", e.target.value)}
                          className="h-10 rounded-xl border-slate-200/60 text-sm shadow-none focus-visible:ring-[#009688]/10 bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="seoDescription" className="text-xs font-bold text-slate-500 ml-1">
                          {t("dashboard.seoDescription")}
                        </Label>
                        <textarea
                          id="seoDescription"
                          placeholder={t("dashboard.seoDescriptionPlaceholder")}
                          value={formData.seoDescription}
                          onChange={e => handleInputChange("seoDescription", e.target.value)}
                          className="flex min-h-[80px] w-full rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-[#009688]/10 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="seoImage" className="text-xs font-bold text-slate-500 ml-1">
                          {t("dashboard.seoImage")}
                        </Label>
                        <Input
                          id="seoImage"
                          placeholder={t("dashboard.seoImagePlaceholder")}
                          value={formData.seoImage}
                          onChange={e => handleInputChange("seoImage", e.target.value)}
                          className="h-10 rounded-xl border-slate-200/60 text-sm shadow-none focus-visible:ring-[#009688]/10 bg-white"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 访问控制与实验 */}
                <AccordionItem value="advanced-control" className="border-none">
                  <AccordionTrigger className="flex items-center justify-between py-3 hover:no-underline group px-3 rounded-xl hover:bg-white transition-all shadow-none hover:shadow-sm border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-[#009688]/10 transition-colors">
                        <Settings2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#009688] transition-colors" />
                      </div>
                      <span className="text-[13.5px] font-bold text-slate-700">{t("dashboard.advancedSettings")}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-3 pb-4 px-4 space-y-5 bg-white/40 rounded-b-xl border-x border-b border-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="expiresAt" className="text-xs font-bold text-slate-500 ml-1">{t("dashboard.expiresAt")}</Label>
                        <Input
                          id="expiresAt"
                          type="datetime-local"
                          value={formData.expiresAt}
                          onChange={e => handleInputChange("expiresAt", e.target.value)}
                          className="h-9 rounded-lg border-slate-200/60 text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="password" className="text-xs font-bold text-slate-500 ml-1">{t("dashboard.linkPassword")}</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder={isCreate ? t("dashboard.passwordPlaceholder") : t("dashboard.passwordEditPlaceholder")}
                          value={formData.password}
                          onChange={e => handleInputChange("password", e.target.value)}
                          className="h-9 rounded-lg border-slate-200/60 text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 mt-2">
                      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/60 transition-all cursor-pointer"
                           onClick={() => handleInputChange("abTestEnabled", formData.abTestEnabled === 1 ? 0 : 1)}>
                        <div className="flex items-center gap-2.5">
                          <GitCompare className="w-3.5 h-3.5 text-slate-400" />
                          <Label className="text-xs font-bold text-slate-600 cursor-pointer">{t("dashboard.abTestSection")}</Label>
                        </div>
                        <Switch
                          checked={formData.abTestEnabled === 1}
                          onCheckedChange={checked => handleInputChange("abTestEnabled", checked ? 1 : 0)}
                          className="data-[state=checked]:bg-[#009688] scale-90"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      {formData.abTestEnabled === 1 && (
                        <div className="mt-3 p-4 rounded-xl border border-[#009688]/10 bg-white/80 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="space-y-2">
                            <Label htmlFor="abTestUrl" className="text-[11px] font-bold text-slate-500 ml-1">
                              {t("dashboard.variantBUrl")} *
                            </Label>
                            <Input
                              id="abTestUrl"
                              type="url"
                              placeholder={t("dashboard.urlPlaceholder")}
                              value={formData.abTestUrl}
                              onChange={e => handleInputChange("abTestUrl", e.target.value)}
                              required={formData.abTestEnabled === 1}
                              className="h-9 rounded-lg border-slate-200/60 text-xs"
                            />
                          </div>
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between px-1">
                              <Label className="text-[11px] font-bold text-slate-500">
                                {t("dashboard.trafficSplit")}
                              </Label>
                              <span className="text-[10px] font-black text-[#009688]">
                                A: {formData.abTestRatio}% / B: {100 - formData.abTestRatio}%
                              </span>
                            </div>
                            <Slider
                              value={[formData.abTestRatio]}
                              min={10}
                              max={90}
                              step={1}
                              onValueChange={vals => handleInputChange("abTestRatio", vals[0])}
                              className="py-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>

          <DialogFooter className="mt-6 gap-3 sm:gap-2 border-t border-slate-100/50 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 px-6 rounded-xl border-slate-100 bg-[#f1f5f9] text-slate-600 hover:bg-slate-200/80 hover:text-slate-800 font-bold transition-all border-none"
            >
              {t("common.cancel")}
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="h-11 px-10 rounded-xl bg-[#009688] hover:bg-[#00897b] text-white font-black shadow-lg shadow-[#009688]/20 transition-all active:scale-[0.98] tracking-widest"
            >
              {isSubmitting
                ? isCreate ? t("dashboard.creating") : t("dashboard.saving")
                : t("common.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
