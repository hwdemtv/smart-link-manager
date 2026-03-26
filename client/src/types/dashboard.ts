import { z } from "zod";
import {
  createLinkSchema,
  updateLinkSchema,
} from "@shared/validators/links";
import type { Link, Domain } from "../../../drizzle/schema";

/** 重定向类型 */
export type RedirectType = "301" | "302" | "307" | "308";

/**
 * Dashboard 表单数据类型
 */
export interface LinkFormData {
  originalUrl: string;
  shortCode: string;
  customDomain: string;
  description: string;
  expiresAt: string;
  password: string;
  tagsString: string;
  seoTitle: string;
  seoDescription: string;
  seoImage: string;
  shareSuffix: string;
  seoPriority: number;
  noIndex: number;
  redirectType: RedirectType;
  seoKeywords: string;
  canonicalUrl: string;
  ogVideoUrl: string;
  ogVideoWidth: number;
  ogVideoHeight: number;
  abTestEnabled: number;
  abTestUrl: string;
  abTestRatio: number;
  groupId: number | null;
}

/**
 * 创建链接的输入类型 (从 Shared Schema 自动推导)
 */
export type CreateLinkInput = z.infer<typeof createLinkSchema>;

/**
 * 更新链接的输入类型 (从 Shared Schema 自动推导)
 */
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;

/**
 * 解析后的导入链接类型
 */
export interface ParsedImportLink {
  originalUrl: string;
  shortCode?: string;
  description?: string;
  tags?: string[];
  expiresAt?: string;
}

/**
 * 带验证状态的预览链接类型
 */
export interface PreviewLink extends ParsedImportLink {
  hasConflict: boolean;
  conflictReason?: string;
  hasWarning: boolean;
  warningReason?: string;
}

/**
 * SEO 生成结果
 */
export interface SeoResult {
  success: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoImage?: string;
}

/**
 * 状态过滤类型
 */
export type StatusFilter = "all" | "active" | "invalid";

/**
 * 导出格式类型
 */
export type ExportFormat = "json" | "csv";

/**
 * 链接表单对话框模式
 */
export type LinkFormMode = "create" | "edit";

/**
 * 表格行操作回调类型
 */
export interface LinkTableRowActions {
  onEdit: (link: Link) => void;
  onDelete: (link: Link) => void;
  onCopy: (shortCode: string) => void;
  onTagClick: (tag: string) => void;
  onQrCode: (shortCode: string) => void;
}

/**
 * 批量操作栏 Props 类型
 */
export interface BatchActionBarProps {
  selectedCount: number;
  onEnable: () => void;
  onDisable: () => void;
  onGenerateSeo: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
  onBatchTags?: () => void;
  onBatchExpiry?: () => void;
  onMoveToGroup?: () => void;
  onCheck?: () => void;
  isChecking?: boolean;
}

/**
 * 搜索筛选栏 Props 类型
 */
export interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  tagFilter: string;
  onTagChange: (tag: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * 链接表单对话框 Props 类型
 */
export interface LinkFormDialogProps {
  mode: LinkFormMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Link;
  domains: Domain[];
  groups: Array<{ id: number; name: string; color: string }>;
  onSubmit: (data: LinkFormData) => Promise<void>;
  isSubmitting: boolean;
  onGenerateSeo: (url: string, description?: string) => Promise<SeoResult>;
  isGeneratingSeo: boolean;
}

/**
 * 删除确认对话框 Props 类型
 */
export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  shortCode?: string;
  isDeleting: boolean;
}

/**
 * 导入链接对话框 Props 类型
 */
export interface ImportLinksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importText: string;
  onImportTextChange: (text: string) => void;
  onPreview: () => void;
  isImporting: boolean;
}

/**
 * 导入预览对话框 Props 类型
 */
export interface ImportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewLinks: PreviewLink[];
  onConfirm: () => void;
  onBack: () => void;
  isImporting: boolean;
}

// Re-export types from schema
export type { Link, Domain };
