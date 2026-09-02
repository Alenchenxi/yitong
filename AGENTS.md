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
- 后续开发排期和验收必须同步维护 `docs/任务规划.md`：每个任务只能标「已完成」或「待实现」；完成任务时必须同步更新任务状态，并在改动记录中写明对应任务 ID。

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

### 4.1 前端验收红线（强制）
- 任何用户端 / 管理端前端改动，在验收前必须先清理对应构建产物（以仓库实际输出为准，通常是 `apps/**/` 下生成的 `.js` / `.js.map`），再重新编译。
- `tsc --noEmit` 只代表类型检查通过，不能替代“删除旧产物 → 重新编译 → 复检产物”这一步。
- 源码脚本文件（例如 `scripts/*.js`）属于源码，不是构建产物，不能混同删除。
- 若项目存在多个前端输出目录，必须逐个目录按同样流程验收，不得只验收源码未覆盖的目录。

### 4.2 后端 Prisma 红线（强制）
- 任何后端 `prisma schema` / model / migration 变更，在验收前必须先重新生成 Prisma Client（例如 `npx prisma generate` 或仓库等价脚本），并确认生成结果与当前 schema 一致。
- `npx prisma migrate ...`、`nest build`、`tsc --noEmit` 都不等于重新生成 Prisma Client，不能拿来代替 `prisma generate`。
- 如果本次改动依赖生成后的 Prisma Client，必须在改动记录里写明已重新生成并复检；不能用旧 client 继续验收。

### 4.3 功能完成后的 main 合并与最终重编译红线（强制）
- 用户未明确要求“暂不合并 / 仅保留功能分支”时，功能完成且独立验收通过后，主代理必须直接按第 5 节流程 squash 合并并提交到 `main`，不得停在功能分支等待二次确认。
- 合并到 `main` 后，必须在主工作区再次清理本次前端对应的旧 `.js` / `.js.map` 构建产物，再从 `main` 重新编译并复检；功能 worktree 中的编译结果不能替代 `main` 的最终重编译。
- 若前端 `tsconfig` 默认配置了 `noEmit: true`，最终重编译必须显式覆盖为可输出模式（例如 `tsc -p <tsconfig> --noEmit false`）或使用仓库等价构建命令；仅执行 `tsc` / `tsc --noEmit` 不得记为已重新构建。
- 只有 `main` 上的清理重编译、产物完整性检查和必要 smoke 均通过，才可报告功能交付完成；随后再按授权执行推送，并按第 5.1 节清理 worktree。

### 4.4 后端部署 bundle 上传红线（强制）
- 如果本次功能修改需要重新部署后端，必须先按第 4.3 节和第 5 节完成独立验收、squash 合并及 `main` 提交，并在主工作区完成最终验收；不得从功能 worktree 或未合并分支生成部署包。
- 合并后的 `main` 必须重新生成完整历史 bundle，禁止复用旧 `yitong-main.bundle`：
  ```bash
  git bundle create yitong-main.bundle main
  git bundle verify yitong-main.bundle
  git bundle list-heads yitong-main.bundle
  ```
- `git bundle verify` 必须通过，且 `git bundle list-heads yitong-main.bundle` 中的 `refs/heads/main` 必须与当前 `git rev-parse main` 完全一致。
- 校验通过后，必须执行以下命令将 bundle 上传到服务器：
  ```bash
  scp yitong-main.bundle root@121.40.26.41:/home/yitongxiaoyuanyun/
  ```
- 只有 `scp` 退出码为 0 才可报告后端部署包交付完成。上传失败时必须保留本地 bundle、报告失败原因并重试或等待用户处理，不得把“已生成”写成“已上传”。
- 不需要重新部署后端的纯前端或文档修改不触发本条。

---

## 5. 提交与合并（trunk-based）
- **每个开发任务必须在独立 git worktree 中进行，禁止只在主工作区 `git checkout -b` 切分支**：多个分支 / 多 agent 会同时开发，共用一个工作目录会互相覆盖、漏提交。开 worktree：`git worktree add <路径> -b feat/<scope>`（scope 取模块名）；Claude Code agent 用 `EnterWorktree` 工具（在 `.claude/worktrees/` 下建隔离副本）。
- 合并前：改动记录状态 = **已审查**，typecheck + smoke + 单测全过。
- 合并：主工作区 `git checkout main && git merge --squash feat/<x> && git commit`（squash 并入后该 worktree 分支可 `git worktree remove` 清理）。
- Conventional Commits：`feat(<scope>): 中文 subject`；**提交信息（subject + body）以中文为主，不得全英文**（技术术语如 tabBar/shell/Prisma 可保留英文，但整体须中文可读），结尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- `git push origin main` 本机常超时（errno 10054 / Timed out），多重试 3-5 次；仍失败告知用户手动 `! git push origin main`。
- 若 main 已前进，合并前先在 worktree 内 `git rebase main`。

### 5.1 worktree 清理清单（强制，缺一步视为未完成）

squash merge 到 main 并 push 成功后，必须依次执行以下步骤，**不得跳过任何一步**：

1. **杀掉 worktree 内启动的后台进程**（node / nest / tsc / pnpm dev / smoke server 等）：`pkill -f "<worktree路径>"` 或 `taskkill //F //PID <pid>`；确认端口已释放（`netstat -ano | grep <port>`）。
2. **`git worktree remove <路径>`**（优先）—— 同时清理 git 元数据和工作目录。如果报 `Invalid argument`（Windows 常见，工作目录有未提交改动），改用 `git worktree remove --force <路径>`。
3. **`git branch -D <分支名>`**：remove 通常自动删分支；若残留（如 `--force` 跳过），手动删。
4. **删除 .env 副本**：如果在 worktree 内复制了 `.env` 用于本地测试（worktree 根的 `.env` 或 `apps/server/.env`），**必须删除该副本**，避免残留凭证或过期配置。注意：worktree remove 会自动清空已跟踪文件，但 `.env` 在 `.gitignore` 中，remove 不会删它；删整个 worktree 目录前确认 `.env` 已清理。
5. **验证清理**：`git worktree list` 不再出现该 worktree；`.claude/worktrees/<name>` 物理目录不存在。

> 起因：2026-08-11 用户发现 `.claude/worktrees/square-hybrid-impl` 残留目录（含完整 node_modules/ 和 .env 副本），worktree 已从 git 移除但目录未清理——原因是 `git worktree remove --force` 删了 git 元数据但留下 node_modules（文件被残留 server 进程锁住），且 .env 副本未被清理。此后本条作为 §5 子条款强制执行。

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
- **Prisma schema / client**：只要 `schema.prisma`、model、migration、enum 有变更，验收前必须先重新生成 Prisma Client（例如 `npx prisma generate`），再继续 typecheck / smoke / 构建复检；不能把旧 client 当作新结果。
- **pnpm**：从项目根 `pnpm -C "G:/副业/仿校园小程序开发/project" --filter @yitong/server ...`（filter 从错误 cwd 会报 No projects matched）。
- **server tsconfig**：`types:["node"]` + `noUncheckedIndexedAccess` → 用 `import type { File } from 'multer'` 而非全局 `Express.Multer.File`；数组/对象下标防 undefined。
- **小程序 tsconfig**：`types:["miniprogram-api-typings"]`，`Page`/`Component` 用 catchtap 阻止冒泡。
- **前端构建产物**：前端验收必须检查构建输出中的 `.js` / `.js.map` 是否已按改动重新生成；只跑 `tsc --noEmit` 不算完成。
- **响应/异常**：路由前缀 `/api/v1`；成功 `ok(data)`；业务异常 `BizException(code,msg,status)`；错误码段见飞书《API设计规范》§3。
- **GitHub 推送**：本机常超时，多重试；不要因为 push 失败就改历史。

---

## 9. 分支与多 agent 协同
- **多 agent / 多分支并行 = 各自独立 worktree**：每个 agent / 任务一个 worktree，互不共用工作目录；绝不在同一 worktree 里同时切两个分支改代码（这是第 5 节硬性要求的直接原因）。
- 分支划分、合并波次、跨分支契约见 `docs/开发记录/分支开发计划.md`。
- 多 agent 并行：各管各的模块；`schema.prisma` 各加自己的 model；`app.module.ts` / `改动记录.md` 合并取并集；冲突按分支计划协议处理。
- worktree 并发注意：各 worktree 共享同一 `.git`，`prisma migrate` / `pnpm install` 等会持锁或改 lockfile 的操作不要多个 worktree 同时跑；`改动记录.md` 合并取并集、不互相覆盖。

---

## 10. 子代理特别约束（主代理派发时须写入 prompt）
1. 先读本 `AGENTS.md`。
2. 默认**只读 + 跑测试**，不得 `git commit` / `git push` / `docker compose down` / 改 `.env`，除非主代理明确授权。
3. 只报告事实（通过 / 失败 + 命令输出证据），**不做合并 / 提交决策**。
4. 测试起 server 用 `npx nest start`，测完 `kill` 进程；**不碰 docker、不碰 git**。
5. 不确定就停下问主代理，不要自作主张。
6. **测试数据清理（强制）**：测试过程中**子代理插入的所有测试数据**（prisma.create / SQL INSERT / API POST 创建的记录），**测试完毕必须清理**（deleteMany / DELETE SQL / API DELETE / seed 重置），不留任何残留。覆盖范围至少包括：
   - 业务流水：User / Post / Comment / AnonymousProfile / AnonymousPost / ChatMatch / ChatMessage / JobPost / JobApplication / PaymentOrder / Notification 等
   - 配置类：AnonTag / HotSearch / SearchHistory / PricingConfig / AdminUser 等（即使 seed 也会重建，测试中手工插入的脏词也必须清）
   - 副作用类：触发的搜索行为写入 `search_histories`、点赞 / 评论 / 关注等计数（库内 likeCount / followerCount 等需在删除主记录前先归零或级联删除）
   - 文件类：测试中上传到 COS / 本地的图片 / 文件，删记录的同时删文件
7. **清理后必须自验证**：用 prisma client / SQL 复查目标表，确认测试数据已不存在；自验证通过后再报告「清理完成」。
8. **清理失败必须上报**：若因 FK 约束、级联失败等导致部分记录未清，**不得静默跳过**——列出失败项 + 原因，请求主代理决策（人工 SQL 清理 / 改 schema 级联 / 接受残留）。
9. **报告格式**：测试报告必须包含独立的「清理清单」一节，逐项列出 `表名 / 操作 / 涉及行数 / 验证结果`；缺这一节视为测试未完成。

> 起因：2026-07-28 用户发现树洞心情 chips 有 `ok / 优e25ozm / 优trrsra / t07w3nzc3t7` 4 条非 seed 脏数据 + `pricing_config.D30` 被改 120 + `hot_searches` 有 `kw_xxxxxxxx` 测试残留，排查溯源为此前某轮测试子代理未清理数据库。本次明确写入强制约束并要求清理报告入测试产出。
