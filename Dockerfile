FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm

# 先复制依赖清单（利用 Docker 缓存）
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY apps/server/package.json ./apps/server/

RUN pnpm install --frozen-lockfile

# 复制源码
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/

# 构建共享包 + 生成 Prisma Client + 编译 server
RUN pnpm --filter @yitong/shared-types build \
 && pnpm --filter @yitong/shared-utils build \
 && pnpm --filter @yitong/server prisma generate \
 && pnpm --filter @yitong/server build

WORKDIR /app/apps/server
EXPOSE 3000 3001

CMD ["node", "dist/main.js"]
