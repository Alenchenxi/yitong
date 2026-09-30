# jiajiao — 家教小程序 AI 工作合同

> 源码购入项目，处于**二开起步阶段**。本文件是 AI Agent 在本目录工作的最高约束（次于仓库根 `CLAUDE.md` 的全局红线）。

## 项目简介

家教服务平台：家长/学生在小程序找老师、发需求、下单；教师入驻接单；平台方用 ThinkPHP 后台管理。源码购自第三方（原卖家站点 www.xxjjwz.com），当前目标是跑通本地环境后按自有品牌二开。

## 目录结构

```
jiajiao/
├── server/            # ThinkPHP 6 后端（xhadmin 快速开发框架二开）
│   ├── app/admin/     # 后台管理应用
│   ├── app/api/       # 小程序接口
│   ├── app/cms/       # 内容模块
│   ├── config/        # 配置（database*.php 含卖家凭据，见 DON'T）
│   ├── extend/        # 扩展类库（xhadmin、PHPMailer、getid3 等）
│   ├── public/        # Web 入口与静态资源
│   ├── runtime/       # 运行时缓存（不提交；当前缺失）
│   ├── untime/        # ⚠️ 复制残留的错名目录（内含旧 log），无代码引用，勿放代码
│   └── docker/ + docker-compose.yml + Dockerfile
├── web/               # uni-app 微信小程序前端（uview-ui / vk-uview-ui）
│   ├── pages/         # 家长/学生端
│   ├── pages_teacher/ # 教师端
│   ├── my/            # 我的（订单/收藏/优惠券/发布管理等）
│   ├── division/      # 分校/评分/直播
│   ├── receiving/     # 接单相关
│   ├── comm/api.js    # 接口地址配置（dev=localhost:8080，prod=卖家域名，二开必改）
│   └── pages.json     # 页面与 tabBar 注册
└── docs/              # 工程文档（见导航）
```

## 开工流程

1. 读本文件 + 仓库根 `CLAUDE.md` → 2. 查 `docs/05-planning/` 与 `docs/06-development-log/` 了解进度 → 3. 改动前后跑交付自检 → 4. Conventional Commits 中文 subject 提交。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| `CONTEXT.md` | 业务上下文、角色板块、遗留凭据说明 |
| `docs/README.md` | 文档总索引 |
| `docs/01-getting-started/` | 本地启动（server / web） |
| `docs/02-architecture/` | 架构说明（现状 + 待补） |
| `docs/03-tech-stack/` | 技术栈清单 |
| `docs/04-conventions/` | 编码约定 |
| `docs/05-planning/` | 规划与里程碑 |
| `docs/06-development-log/devLogs/` | 每日开发记录 |
| `docs/07-decisions/` | ADR 决策记录 |

## 文档优先级与冲突仲裁

仓库根 `CLAUDE.md`（全局红线）> 本 `AGENTS.md` > `docs/07-decisions/`（ADR）> 其余 `docs/*` > `CONTEXT.md`（业务背景参考）。冲突时以更高优先级为准并在 devLog 记录。

## 必须询问触发器

以下操作**先问用户再动手**：

- 修改 `server/config/database*.php` 连接信息（内含卖家凭据，改前确认目标环境）
- 任何部署动作（Docker build / `up -d` / 数据库迁移 / 改线上数据）
- 删除文件或目录（包括清理 `untime/` 残留、`.DS_Store`）
- 修改 `web/comm/api.js` 接口地址（影响小程序全部请求）
- 微信 appid、支付、短信等第三方账号配置
- 引入新依赖（composer / npm）

## DO / DON'T

DO：
- 后端遵循 ThinkPHP 6 惯例（controller / service / model / validate 分层，沿用 xhadmin 生成器产物风格）
- 前端页面改动同步注册 `pages.json`，样式沿用 uni.scss 变量与 uview 组件
- 数据库表前缀 `cd_`，库名 `xxjjwz`（沿用源码现状）

DON'T：
- ❌ 新增任何硬编码密码/密钥/Secret 进 git（历史里已有卖家凭据，别再添）
- ❌ `docker compose down`、删 volume、改写已推送历史（仓库红线，只能 `stop`）
- ❌ 提交 `server/runtime/`、`server/untime/`、`server/vendor/`、`web/unpackage/`、`web/node_modules/`（.gitignore 已覆盖）
- ❌ 在 `untime/` 里找代码或放代码（错名残留目录）

## 交付前自检清单

- [ ] `git status` 无意外文件、无新增敏感文件
- [ ] 改动的 PHP 文件过 `php -l` 语法检查
- [ ] 前端页面在 `pages.json` 注册且小程序编译通过（HBuilderX / 微信开发者工具）
- [ ] 涉及接口的改动在 devLog 写明请求路径与验证方式

## 交付前自动化测试规范

现状：购入源码**无任何自动化测试**。在测试框架建立之前：
- PHP 改动以 `php -l` + 对应接口手工请求验证为最低门槛，**不得虚报"测试通过"**
- 引入 PHPUnit / 小程序自动化属新依赖，触发"必须询问"

## Git 与协作边界

- 遵循仓库根 CLAUDE.md：Conventional Commits、中文 subject、结尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 本项目随仓库根统一提交，不建独立 `.git`；提交范围限定 `jiajiao/` 内路径（subject 用 `feat(jiajiao)/fix(jiajiao)/chore(jiajiao)` scope）
- `git push` 本机常超时：多重试 3-5 次，仍失败请用户手动 `! git push origin main`
