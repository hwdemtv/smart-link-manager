-- Phase 12: 复合索引优化
-- 执行此 SQL 以添加新的复合索引

-- 链接表：用户 + 删除状态复合索引（优化列表查询）
CREATE INDEX IF NOT EXISTS userIdDeletedIdx ON links (userId, isDeleted);

-- 链接表：用户 + 删除状态 + 过期时间复合索引（优化过期查询）
CREATE INDEX IF NOT EXISTS userIdDeletedExpiresIdx ON links (userId, isDeleted, expiresAt);
