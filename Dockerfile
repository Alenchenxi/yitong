FROM node:20-alpine
WORKDIR /app

# Prisma 在 Alpine 上需要 libssl / openssl
RUN apk add --no-cache openssl

RUN npm install -g pnpm@9

# 先复制依赖清单（利用 Docker 缓存）
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY apps/server/package.json ./apps/server/

# node-linker=hoisted（在 .npmrc 里）让 pnpm 用 npm-style 扁平 node_modules，
# 让 prisma:generate 能找到自己的 build/index.js
RUN pnpm install --frozen-lockfile

# 复制源码
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/

# 构建共享包 + 生成 Prisma Client + 编译 server
RUN pnpm --filter @yitong/shared-types build \
 && pnpm --filter @yitong/shared-utils build \
 && pnpm --filter @yitong/server prisma:generate \
 && pnpm --filter @yitong/server build

WORKDIR /app/apps/server
EXPOSE 3000 3001

CMD ["node", "dist/main.js"]
