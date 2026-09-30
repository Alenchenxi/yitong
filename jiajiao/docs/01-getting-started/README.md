# 快速上手（2026-09-30 实跑验证）

## 后端 server（Docker，已验证）

前置：Docker Desktop 运行中。注意本机 Git Bash 里 docker CLI 不在 PATH，用完整路径：

```bash
DOCKER="/c/Program Files/Docker/Docker/resources/bin/docker.exe"
cd jiajiao/server
"$DOCKER" compose up -d --build   # 首次构建 5-10 分钟
```

| 项 | 值 |
| --- | --- |
| 应用 | http://localhost:8080 （容器 jiajiao-app，Apache 2.4 + PHP 7.4.33） |
| 后台入口 | http://localhost:8080/admin.php → /admin.php/admin/Login/index.html |
| MySQL | localhost:3306（容器 jiajiao-mysql；root/`jiajiao_root`，业务号 jiajiao/`jiajiao_pass`） |
| 库名/前缀 | `jiajiao` / `cd_`（连接配置走 `server/.env`，已 gitignore） |

**当前预期行为**：登录页可开；首页与 `/api/*` 返回 500（`Table 'jiajiao.cd_config' doesn't exist`）——**业务库表结构和数据未导入**，需向源码卖家索取 SQL 导出后倒入本地库（`docker exec -i jiajiao-mysql mysql -ujiajiao -pjiajiao_pass jiajiao < xxx.sql`）。

### 构建踩坑记录

- **php:7.4.33-apache（bullseye）apt 大面积 404**：在线镜像的 debian-security 包文件与索引不同步（2026-09 bullseye 归档过渡期）。解法：Dockerfile 改写 sources.list 为镜像自带的 `snapshot.debian.org` 2022-11-14 固定快照源 + `-o Acquire::Check-Valid-Until=false`。阿里云镜像源同样 404，勿再试。
- **`docker-credential-desktop` not found**：拉镜像报 credentials 错 → 命令前置 Docker bin 到 PATH（见上）。
- Dockerfile 内 composer 已配阿里云镜像加速。

## 前端 web（uni-app 小程序，HBuilderX）

1. 安装 HBuilderX **App 开发版**（本机未装）：https://www.dcloud.io/hbuilderx.html
2. 文件 → 打开目录 → 选 `jiajiao/web`
3. 运行 → 运行到小程序模拟器 → 微信开发者工具
   - 微信开发者工具已装于 `C:\Users\24235\AppData\Local\微信开发者工具`，需开启：设置 → 安全设置 → **服务端口**
   - HBuilderX 首次运行会要求指定开发者工具 cli 路径（上述目录下）
   - manifest 里 `wx360d1d10e789017a` 是卖家 appid，无自有 appid 前用测试号
4. 接口已切本地：`web/comm/api.js` `active: 'dev'` → `http://localhost:8080/api`（开发者工具需勾选「不校验合法域名」，manifest urlCheck 已为 false）
5. 已知坑：旧版开发者工具+新基础库可能白屏（appservice 起不来），先查基础库版本

## 已知坑（源码自带）

- `server/untime/` 是错名残留目录，真运行时目录是 `runtime/`
- `app/config/database_dev.php / database_prod.php` 是无引用的死文件，生效的只有 `config/database.php`（Env 回退值含卖家凭据，见 CONTEXT.md）
