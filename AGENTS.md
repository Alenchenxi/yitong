# AGENTS.md — 燚桐项目 Agent 行为约束

> 本文件是燚桐项目（`G:\副业\仿校园小程序开发\project`）所有 agent（主代理 + 子代理）的**强制行为约束**。
> 进入项目第一件事：读本文件 → 运行 `/yitong-dev` skill 建立上下文。
> 主代理派发子代理时，**必须在 prompt 里要求子代理先读本文件**。

---

## 0. 项目速览
- **燚桐**：家教平台委托的校园生活小程序，三端（用户 / 商家 / 管理）+ 表白墙 / 树洞 / 兼职。
- **技术栈**：pnpm monorepo + NestJS + Prisma + PostgreSQL + Redis + 腾讯云 IM；用户端原生小程序；管理端 Vue3。
- **仓库**：https://github.com/Alenchenxi/yitong.git
- **规格文档**：飞书 Wiki「家教平台小程序」节点（只读沉淀，不写本地）。
- **过程文档**：本地 `docs/开发记录/`（改动记录 / 后台环境配置 / 分支开发计划 / 初始化记录）。

---

## 1. 工作流入口（强制）
- 任何开发任务先运行 `/yitong-dev` skill：读本地 `docs/` + 飞书全部子文档 + 确认 git 基线。
- 不读文档就动手 = 违规。
- 后续功能实现必须以 `docs/功能规划.md` 为当前产品功能基线；如果用户没有明确变更范围，不得继续按旧 MVP 范围补功能，也不得加入该文档明确不做的 AI、礼物/打赏、视频、实时语音房等能力。
- 后续 UI / 前端页面实现必须以 `docs/UI设计规范.md` 为设计基线：统一平台视觉，主色 `#F9C801`，不得给表白墙、树洞、兼职做独立频道配色。

---

## 2. 基础设施保护（🔴 红线，违反即事故）
- **禁止 `docker compose down`**。需要停服务只用 `docker compose stop`（停容器、不删、数据保留）。
- **禁止 `docker compose down -v` / `docker volume rm` / `docker system prune`**——会删 postgres/redis 数据卷。
- **禁止改 `apps/server/.env`**（gitignored，含本地凭证）。新增环境变量改 `.env.example` 并告知用户去填 `.env`。
- **禁止改写已推送的 git 历史**（`git push --force`、rebase 已 push 的提交）。
- **禁止 `rm -rf` / 批量删除**项目文件，除非主代理明确授权且已确认范围。
- **测试子代理特别约束**：测完只 `kill` 自己起的 server 进程，**绝不操作 docker / git**。

> 起因：2026-07-06 测试子代理测完自作主张 `docker compose down` 删了 postgres 容器（所幸 named volume 保住数据）。此类操作永久禁止子代理执行。

---

## 3. 代码改动 → 改动记录（强制）
- **任何**代码 / 项目文件改动，同步在 `docs/开发记录/改动记录.md` **顶部**追加一条。
- 字段顺序固定（与现有条目一致）：发生时间 → 状态 → commit → 改动概要 → 新增/修改文件 → 完成的工作 → 潜在隐患 → 后续待做工作/方向。
- 状态先标 **「待检查」**，**绝不**直接写「已完成 / 已审查」。
- 格式必须与现有条目一致（用户多次强调）。

---

## 4. 测试门槛（不得自证）
- 功能完成（至少 typecheck 通过）后，用 **Agent 工具开空上下文子代理**独立测试：
  - 后端：`tsc --noEmit` + 端到端 smoke（mock 模式）+ 关键单测
  - 前端：`tsc --noEmit`（小程序 tsconfig）+ 微信开发者工具人工验证
- 主代理**不得自行声明「测试通过」**，以子代理报告为准。
- 失败 → 修复 → 重新开空上下文测试（循环，不得跳过）。

---

## 5. 提交与合并（trunk-based）
- 从 main 切 `feat/<scope>` 分支开发（scope 取模块名）。
- 合并前：改动记录状态 = **已审查**，typecheck + smoke + 单测全过。
- 合并：`git checkout main && git merge --squash feat/<x> && git commit`。
- Conventional Commits：`feat(<scope>): 中文 subject`，结尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- `git push origin main` 本机常超时（errno 10054 / Timed out），多重试 3-5 次；仍失败告知用户手动 `! git push origin main`。
- 若 main 已前进，合并前先 `git rebase main`。

---

## 6. 文档落点
- **规划 / 规格类**（产品概述 / 技术栈 / 项目结构 / 开发规范 / API设计规范 / 数据模型 / 路线图 / 功能模块设计）→ 只落飞书，不写本地。
- **开发过程类**（改动记录 / 后台环境配置 / 分支开发计划 / 初始化记录 / 本文件）→ 本地。
- 飞书建长文档：Write 临时 .md → `lark-cli drive +import` → `wiki +move` → 删临时文件。

---

## 7. 技术红线（不可破）
- **树洞匿名**：anonToken 不得含真实 uid；树洞表（`AnonymousPost` 等）0 处真实 uid（仅 `AnonymousProfile` 后台可追溯）。
- **支付金额**：服务端按 `PricingConfig` 算，**不信前端传入金额**。
- **内容安全**：发帖 / 评论内联 `checkText` / `checkImage`，命中抛 `90002`。

---

## 8. 常见坑速查
- **mock 策略**：缺 WX / COS / TIM / 支付凭证时 dev 走 mock、prod 抛 `90003`（沿用 auth/common）。
- **Prisma enum**：值必须每行一个；schema 改动跑 `npx prisma migrate dev --name <x>`，必要时 `npx prisma db seed`。
- **pnpm**：从项目根 `pnpm -C "G:/副业/仿校园小程序开发/project" --filter @yitong/server ...`（filter 从错误 cwd 会报 No projects matched）。
- **server tsconfig**：`types:["node"]` + `noUncheckedIndexedAccess` → 用 `import type { File } from 'multer'` 而非全局 `Express.Multer.File`；数组/对象下标防 undefined。
- **小程序 tsconfig**：`types:["miniprogram-api-typings"]`，`Page`/`Component` 用 catchtap 阻止冒泡。
- **响应/异常**：路由前缀 `/api/v1`；成功 `ok(data)`；业务异常 `BizException(code,msg,status)`；错误码段见飞书《API设计规范》§3。
- **GitHub 推送**：本机常超时，多重试；不要因为 push 失败就改历史。

---

## 9. 分支与多 agent 协同
- 分支划分、合并波次、跨分支契约见 `docs/开发记录/分支开发计划.md`。
- 多 agent 并行：各管各的模块；`schema.prisma` 各加自己的 model；`app.module.ts` / `改动记录.md` 合并取并集；冲突按分支计划协议处理。

---

## 10. 子代理特别约束（主代理派发时须写入 prompt）
1. 先读本 `AGENTS.md`。
2. 默认**只读 + 跑测试**，不得 `git commit` / `git push` / `docker compose down` / 改 `.env`，除非主代理明确授权。
3. 只报告事实（通过 / 失败 + 命令输出证据），**不做合并 / 提交决策**。
4. 测试起 server 用 `npx nest start`，测完 `kill` 进程；**不碰 docker、不碰 git**。
5. 不确定就停下问主代理，不要自作主张。
