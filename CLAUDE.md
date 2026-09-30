# 多项目仓库 - Claude Code 指令

本目录是 git 仓库根，采用**多项目布局**，各项目以独立子目录并存：

| 目录 | 项目 | 规范入口 |
| --- | --- | --- |
| `yitong/` | 燚桐校园生活小程序（用户/商家/管理三端 + NestJS 后端 + 表白墙/树洞/兼职） | `yitong/CLAUDE.md`（自动导入 `yitong/AGENTS.md`） |

## 加入新项目
- 新项目放到与本文件平级的独立子目录（如 `<新项目>/`），前台 + 后台代码都放在该子目录内，自带各自的 `CLAUDE.md` / `AGENTS.md` 与 `.gitignore`。
- 不要把新项目文件直接散落在仓库根；根目录只保留 `.git/`、`.claude/`（agent 工具目录）与各项目子目录。
- 各项目的开发红线、改动记录、测试门槛以各自目录内的 AGENTS.md 为准；跨项目共用的基础设施（如 docker 数据卷）操作前先确认归属。

## 仓库级约定（全局有效）
- 🔴 禁止 `docker compose down`（只能 `stop`）；禁止删 volume / 改 `.env` / 改写已推送历史。
- 提交信息用 Conventional Commits，中文 subject，结尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- `git push` 本机常超时：多重试 3-5 次，仍失败请用户手动 `! git push origin main`。
