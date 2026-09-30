# 燚桐试用授权锁 - 远程授权服务器（Cloudflare Worker）

phone-home 架构的「事实源」：持有 licenseId + 密码哈希 + 倒计时状态，部署在 Cloudflare 边缘（免费、永远在线、免机器、免公网 IP）。客户端后端定时 `POST /check` 查是否放行。

## 为什么用 Worker
- **免费永远在线**：不依赖笔记本/VPS 常开，避免「付费客户因授权服务器关机被误锁」。
- **客户碰不到**：密码哈希与状态只存 Cloudflare KV，客户服务器上没有任何可伪造的本地文件。
- 免费额度（10 万请求/天）远超巡检用量（每部署约 48 请求/天）。

## 部署步骤

### 1. 前置
- 注册 Cloudflare 账号（免费）：https://dash.cloudflare.com/sign-up
- 本机装 wrangler：`npm install -g wrangler`（或在本目录 `npm install` 后用 `npx wrangler`）
- 登录：`wrangler login`

### 2. 创建 KV namespace
```bash
wrangler kv namespace create LICENSE_KV
```
把输出里的 `id` 填进 `wrangler.toml` 的 `[[kv_namespaces]] id = "..."`。

### 3. 设置密钥（secret，勿写进 toml）
```bash
# /check 共享密钥（客户端 LICENSE_API_KEY 与之一致）
wrangler secret put LICENSE_API_KEY
# 运维主密钥（注册 license / 查状态用）
wrangler secret put LICENSE_MASTER_KEY
```
各输入一段强随机串（如 `openssl rand -hex 32`）。**记下 LICENSE_API_KEY**，客户端要填同样的值。

### 4. 部署
```bash
wrangler deploy
```
部署后会得到一个 URL，如 `https://yitong-license.<你的子域>.workers.dev`。这就是客户端 `LICENSE_SERVER_URL` 的值。
> 国内访问建议绑自定义域名（Cloudflare 后台 Workers -> 该 Worker -> Triggers -> Custom Domains），比 workers.dev 稳。

### 5. 注册一个 license
```bash
curl -X POST https://yitong-license.<子域>.workers.dev/admin/create \
  -H "Content-Type: application/json" \
  -H "X-Master-Key: <你的 LICENSE_MASTER_KEY>" \
  -d '{"licenseId":"yt-prod-001","password":"你的停止密码","days":10}'
```
- `licenseId`：自定，填进客户端 `LICENSE_ID`。
- `password`：你的「停止密码」。**用强密码**--客户能从其服务器读到 licenseId+apiKey，可能在线猜密码（Worker 有 5 次错误锁定 15 分钟，但仍建议强密码）。
- 注册后 status=inactive，客户端服务处于「停用」状态，等你 activate 才放行。

### 6. 客户端配置 + 激活
在客户服务器的 `.env.production` 填：
```
LICENSE_SERVER_URL=https://yitong-license.<子域>.workers.dev
LICENSE_ID=yt-prod-001
LICENSE_API_KEY=<与步骤3一致>
```
部署客户端后，在客户服务器上执行：
```bash
docker exec yitong-server node dist/license/license-cli.js activate --password <停止密码>
# 或交互输入（不回显）：docker exec -it yitong-server node dist/license/license-cli.js activate
```
10 天倒计时开始。到期未付费自动 90003 停服；付费后 `unlock --password <p>` 永久激活。

## 端点速查

| 方法 路径 | 鉴权 | 作用 |
|---|---|---|
| `POST /check` | `X-License-Key` | `{allowed,status,expiresAt?,serverTime,tampered}`；body 可选 `integrityHash`（客户端 SHA256 指纹，详见下文） |
| `POST /admin/create` | `X-Master-Key` | 注册 license（body: licenseId,password,days?） |
| `POST /admin/activate` | password | 开/重置 trial（body: licenseId,password,days?） |
| `POST /admin/unlock` | password | 永久激活 |
| `POST /admin/lock` | password | 手动停服 |
| `GET /admin/status?licenseId=` | `X-Master-Key` | 查详情；含 `tampered`/`tamperedSince`/`lastIntegrityHash` |

## 运维
- 查某 license 状态：`curl "https://.../admin/status?licenseId=yt-prod-001" -H "X-Master-Key: <k>"`
- 主动停服：`curl -X POST https://.../admin/lock -H "Content-Type: application/json" -d '{"licenseId":"yt-prod-001","password":"<p>"}'`
- 看日志：`wrangler tail`
- KV 数据备份：`wrangler kv key list --binding LICENSE_KV` / `wrangler kv key get license:yt-prod-001`

## 故障排查
- **客户端一直 90003、status=unknown**：检查 `LICENSE_SERVER_URL`/`LICENSE_ID`/`LICENSE_API_KEY` 是否填对、Worker 是否可达（`curl https://.../ ` 应返回 `{"ok":true}`）。
- **activate 报 invalid password**：密码错；连续 5 次会锁 15 分钟（429）。
- **付费客户偶尔 90003**：Worker 抖动断连，客户端有 2h 容忍窗口；持续 >2h 检查 Worker 状态（`wrangler tail` 看异常）。
- **CPU 超限**：PBKDF2 哈希只在 create/activate/unlock/lock 触发（极低频），免费额度够；如仍报 CPU 限，可降低 worker.js 里 `PBKDF2_ITERATIONS`（不低于 5 万）。

## 完整性检测（防客户改 dist 绕过 guard）

> 威胁：客户能进容器 → 直接编辑 `dist/license/license.guard.js` 把 `canActivate` 改成 return true → 服务永远放行。
> 这是 DRM 根本性限制，本方案只在「懂 JS 但懒得继续改 hash 算法」的客户面前有效。真硬防见文末。

机制：
- 客户端把 `dist/license/*.js` 的 SHA256（路径+长度+内容混合哈希）算成 64 位 hex，每 30 分钟 + 启动时随 `/check` 上报（`body.integrityHash`）。
- 本地比对：客户端 `LICENSE_BOOT_HASH` 写部署时的基线 hash；运行时不一致 → 立即 fail-closed（不依赖远端）。
- 远端比对：本 Worker 与上次记录对比，发现 hash 漂移 → `tampered=true` + `tamperedSince`，暴露在 `/admin/status`。

### 部署时算 LICENSE_BOOT_HASH

部署客户服务器前，在构建产物上跑：
```bash
cd apps/server
node -e "const{createHash}=require('crypto'),{readdirSync,readFileSync}=require('fs'),{join}=require('path');const d='dist/license';const h=createHash('sha256');for(const n of readdirSync(d).filter(f=>f.endsWith('.js')&&!f.endsWith('.js.map')).sort()){const c=readFileSync(join(d,n));h.update(n);h.update(String(c.length));h.update(c);}console.log(h.digest('hex'));"
```
把输出的 hex 填进客户 `.env.production` 的 `LICENSE_BOOT_HASH`。

### 检测到篡改时

`/admin/status?licenseId=<id>` 返回：
```json
{ "tampered": true, "tamperedSince": 1700000000000, "lastIntegrityHash": "<客户端最近一次上报的 hash>" }
```
人工判断：联系客户要求还原代码 / 停止服务。

### 为什么这不够（重要）

客户端代码在客户手里，懂 JS + 改 `dist/license/license.service.js` 内的 `computeAndCheckLocal` 的人可以同时让本地比对和上报都吐「正确的 hash」，绕过整套检测。
**真正的硬防只有收回宿主权限**：不让客户进容器、用你们的 CI 部署、管理服务器只开放运维通道。
本完整性检测仅作「告警」用，不是阻断。
