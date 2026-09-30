# 燚桐

校园生活聚合小程序——表白墙 + 树洞 + 兼职，三端（用户端 / 商家端 / 管理端）。由家教平台委托开发。

## 技术栈
- 用户端 / 商家端：微信小程序原生 + TDesign Miniprogram
- 后端：NestJS + Prisma + PostgreSQL + Redis
- 管理端：Vue 3 + Element Plus
- 实时聊天：腾讯云 IM (TIM)
- 支付 / 审核：微信支付 + 微信内容安全 API

> 产品概述 / 技术栈 / 项目结构 等正式文档沉淀在飞书「家教平台小程序」知识库下。

## 目录结构（monorepo，pnpm workspaces）
```
apps/
  user-miniprogram/       用户端微信小程序
  merchant-miniprogram/   商家端微信小程序
  admin-web/              管理端（Vue3）
  server/                 后端（NestJS + Prisma）
packages/
  shared-types/           前后端共享类型
  shared-utils/           共享纯函数工具
deploy/                   部署配置（nginx / pm2 / docker-compose）
docs/                     本地研发文档
```

## 本地启动（各端初始化后补充完整）
```bash
pnpm install
pnpm dev:server    # 后端
pnpm dev:admin     # 管理端
# 小程序：用微信开发者工具打开 apps/user-miniprogram 或 apps/merchant-miniprogram
```

## 环境变量
复制 `.env.example` 为 `.env` 并填入真实配置（密钥禁止提交）。
