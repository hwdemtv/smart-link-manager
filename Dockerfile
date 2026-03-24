# ============================================
# Stage 1: Dependencies
# 安装依赖，利用 Docker 缓存层
# ============================================
FROM node:22-alpine AS deps

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制依赖描述文件和 patches
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# 安装依赖
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Build
# 构建应用
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

# ============================================
# Stage 3: Production
# 生产镜像（最小化）
# ============================================
FROM node:22-alpine AS runner

WORKDIR /app

# 设置生产环境
ENV NODE_ENV=production

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle ./drizzle

# 设置文件所有权
RUN chown -R appuser:nodejs /app

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "dist/index.js"]
