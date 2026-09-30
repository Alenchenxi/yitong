FROM node:20-alpine
WORKDIR /app

# 国内构建加速：apk 换阿里云源（避免 dl-cdn.alpinelinux.org DNS 失败）
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories

# Prisma 在 Alpine 上需要 openssl
RUN apk add --no-cache openssl

# 国内构建加速：npm/prisma 走淘宝镜像（海外构建可用 --build-arg 覆盖回官方源）
#   --build-arg NPM_REGISTRY=https://registry.npmjs.org
#   --build-arg PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma

RUN npm_config_registry=${NPM_REGISTRY} npm install -g pnpm@9

# 先复制依赖清单（利用 Docker 缓存）
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY apps/server/package.json ./apps/server/

# node-linker=hoisted（在 .npmrc 里）让 pnpm 用 npm-style 扁平 node_modules，
# 让 prisma:generate 能找到自己的 build/index.js
RUN export npm_config_registry=${NPM_REGISTRY} && pnpm install --frozen-lockfile

# 复制源码
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/

# 构建共享包 + 生成 Prisma Client + 编译 server
RUN export PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR} \
 && pnpm --filter @yitong/shared-types build \
 && pnpm --filter @yitong/shared-utils build \
 && pnpm --filter @yitong/server prisma:generate \
 && pnpm --filter @yitong/server build

WORKDIR /app/apps/server
EXPOSE 3000 3001

CMD ["node", "dist/main.js"]
