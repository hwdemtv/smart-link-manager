-- Smart Link Manager SEO 字段迁移脚本
-- 执行日期: 2026-03-25
-- 说明: 添加 SEO 优化相关字段到 links 表

-- 添加 seoPriority 字段 (sitemap 优先级, 0-100, 默认 80)
ALTER TABLE links ADD COLUMN seoPriority INT DEFAULT 80;

-- 添加 noIndex 字段 (1 = 不被搜索引擎索引)
ALTER TABLE links ADD COLUMN noIndex INT DEFAULT 0;

-- 添加 redirectType 字段 (重定向类型: 301/302/307/308)
ALTER TABLE links ADD COLUMN redirectType VARCHAR(10) DEFAULT '302';

-- 添加 seoKeywords 字段 (SEO 关键词)
ALTER TABLE links ADD COLUMN seoKeywords TEXT;

-- 添加 canonicalUrl 字段 (自定义 canonical URL)
ALTER TABLE links ADD COLUMN canonicalUrl VARCHAR(500);

-- 添加 ogVideo 相关字段 (视频预览)
ALTER TABLE links ADD COLUMN ogVideoUrl TEXT;
ALTER TABLE links ADD COLUMN ogVideoWidth INT DEFAULT 1200;
ALTER TABLE links ADD COLUMN ogVideoHeight INT DEFAULT 630;

-- 验证字段是否添加成功
-- SELECT seoPriority, noIndex, redirectType, ogVideoUrl FROM links LIMIT 1;
