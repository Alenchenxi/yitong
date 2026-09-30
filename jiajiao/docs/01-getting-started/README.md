# 快速上手（首版，待实跑校准）

## server（ThinkPHP 6 + Docker）

```bash
cd jiajiao/server
docker compose up -d --build   # 端口 8080，容器名 yantong-app（卖家遗留命名）
```

- 数据库：需自备 MySQL（源码配置指向卖家库 `xxjjwz`，见 CONTEXT.md 凭据说明）
- `runtime/` 目录当前缺失，ThinkPHP 首次运行需可写（缺失时自动创建或手动建空目录）
- vendor 未随源码附带，需 `composer install`（或容器内执行）

## web（uni-app 小程序）

- HBuilderX 导入 `jiajiao/web/`，或 CLI 编译为微信小程序
- `comm/api.js` 中 `url` 改为本地 server 地址（dev 段）
- `project.config.json` 的 appid 为卖家小程序，二开需换成自有 appid

## 已知坑

- `server/untime/` 是错名残留目录，真运行时目录是 `runtime/`
- `docker-compose.yml` 容器名 `yantong-app` 为卖家遗留命名
