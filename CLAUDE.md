# 燚桐项目 - Claude Code 指令

本项目所有 agent（主代理 + 子代理）的行为约束、红线、工作流、常见坑速查，见 @AGENTS.md（自动导入）。

## 核心要求（先记牢）
- 进入项目第一件事：运行 `/yitong-dev` skill 建立上下文（读本地 `docs/` + 飞书文档 + git 基线）。
- 任何代码 / 项目文件改动 -> 同步 `docs/开发记录/改动记录.md`（顶部新增，状态标「待检查」）。
- 测试用 Agent 工具开空上下文子代理独立跑，不得自证；通过后状态改「已审查」。
- 开发必须在**独立 git worktree** 中进行（不只新建分支）——会有多个分支 / 多 agent 同时开发，共用工作目录会互相覆盖、漏提交；合并走 trunk-based：worktree 内 `feat/<scope>` -> 主工作区 `merge --squash` 到 main -> push。
- 🔴 禁止 `docker compose down`（只能 `stop`）；禁止删 volume / 改 `.env` / 改写已推送历史。

详细规则以 @AGENTS.md 为准。
