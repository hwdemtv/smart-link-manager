# 错误处理最佳实践指南

本文档说明项目中错误处理的规范和最佳实践。

## 1. 错误类型定义

### 1.1 数据库错误类型

```typescript
interface DatabaseError {
  code?: string;      // MySQL 错误码，如 "ER_DUP_ENTRY"
  message?: string;   // 错误信息
  errno?: number;     // 错误编号
  sqlState?: string;  // SQL 状态码
}
```

### 1.2 常见错误码

| 错误码 | 说明 | 处理方式 |
|--------|------|----------|
| `ER_DUP_ENTRY` | 唯一索引冲突 | 转换为业务错误提示 |
| `ER_NO_REFERENCED_ROW` | 外键约束失败 | 检查关联数据是否存在 |
| `ER_LOCK_WAIT_TIMEOUT` | 锁等待超时 | 重试或提示用户稍后重试 |

## 2. 错误处理模式

### 2.1 推荐方式（类型安全）

```typescript
// ✅ 使用类型断言而非 any
try {
  await db.insert(links).values(data);
} catch (error) {
  const dbError = error as { code?: string; message?: string };
  if (dbError.code === "ER_DUP_ENTRY") {
    throw new TRPCError({ code: "CONFLICT", message: "短码已存在" });
  }
  throw error;
}
```

### 2.2 不推荐方式

```typescript
// ❌ 避免使用 any
try {
  await db.insert(links).values(data);
} catch (error: any) {
  if (error.code === "ER_DUP_ENTRY") {  // any 类型不安全
    // ...
  }
}
```

## 3. 事务处理

### 3.1 使用事务确保原子性

```typescript
export async function restoreLink(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");

  return await db.transaction(async (tx) => {
    // 1. 查询并加锁
    const [link] = await tx
      .select({ shortCode: links.shortCode })
      .from(links)
      .where(eq(links.id, linkId));

    // 2. 业务逻辑检查
    if (!link) throw new Error("Link not found");

    // 3. 更新操作
    await tx.update(links).set({ /* ... */ }).where(eq(links.id, linkId));

    return { success: true };
  });
}
```

## 4. 错误转换

### 4.1 服务层到 API 层

```typescript
// 服务层抛出具体错误
class ShortCodeExistsError extends Error {
  constructor(public shortCode: string) {
    super(`Short code "${shortCode}" already exists`);
  }
}

// API 层转换为 HTTP 响应
.mutation(async ({ input }) => {
  try {
    await createLink(input);
  } catch (error) {
    if (error instanceof ShortCodeExistsError) {
      throw new TRPCError({
        code: "CONFLICT",
        message: error.message,
      });
    }
    throw error;
  }
});
```

## 5. 客户端错误处理

### 5.1 tRPC 错误处理

```typescript
const createLinkMutation = trpc.links.create.useMutation({
  onError: (error) => {
    // error.code 是 tRPC 错误码
    switch (error.code) {
      case "CONFLICT":
        toast.error("短码已存在，请更换");
        break;
      case "FORBIDDEN":
        toast.error("超出配额限制");
        break;
      default:
        toast.error("操作失败: " + error.message);
    }
  },
});
```

## 6. 日志记录

### 6.1 错误日志规范

```typescript
import { logger } from "./_core/logger";

// 记录错误详情
try {
  await riskyOperation();
} catch (error) {
  logger.error("[Module] Operation failed:", {
    error: error instanceof Error ? error.message : "Unknown",
    stack: error instanceof Error ? error.stack : undefined,
    context: { userId, linkId }, // 相关上下文
  });
  throw error; // 重新抛出或转换
}
```

## 7. 验证错误

### 7.1 Zod Schema 验证

```typescript
const createLinkSchema = z.object({
  shortCode: z
    .string()
    .min(3, "短码至少3个字符")
    .max(20, "短码最多20个字符")
    .regex(/^[a-zA-Z0-9_-]+$/, "短码只能包含字母、数字、下划线和横线"),
  originalUrl: z.string().url("请输入有效的 URL"),
});

// Zod 错误会自动转换为 tRPC 错误
.procedure
  .input(createLinkSchema)
  .mutation(async ({ input }) => {
    // input 已通过验证，类型安全
  });
```

## 8. 异步错误

### 8.1 Promise.all 错误处理

```typescript
// ✅ 使用 Promise.allSettled 避免一个失败影响其他
const results = await Promise.allSettled([
  operation1(),
  operation2(),
  operation3(),
]);

results.forEach((result, index) => {
  if (result.status === "rejected") {
    logger.error(`Operation ${index} failed:`, result.reason);
  }
});

// ✅ 或包装单个错误处理
await Promise.all([
  operation1().catch(err => { /* 处理但不抛出 */ }),
  operation2().catch(err => { /* 处理但不抛出 */ }),
]);
```

## 9. 总结

| 场景 | 推荐做法 |
|------|----------|
| 捕获未知错误 | `error as { code?: string }` |
| 数据库操作 | 使用事务 + 捕获特定错误码 |
| 并发操作 | 使用乐观锁或数据库唯一索引 |
| 客户端提示 | 根据错误码显示对应的本地化消息 |
| 日志记录 | 包含上下文信息，便于排查问题 |
