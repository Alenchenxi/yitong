# yitongxiaoyuanyun 部署运维脚本

> 配套 `docker-compose.prod.yml` 的部署/维护脚本。所有脚本在生产服务器上执行，**不在开发机跑**。

## 为什么需要这些脚本

2026-08-25 圈子 LOGO 上传失败事故根因之一：**docker vfs storage driver 不共享 layer**，叠加缺 cleanup 流程，导致 `/var/lib/docker/vfs/dir` 累积 34GB（`/dev/vda1` 100% 满）→ MinIO drive offline → putObject 全部失败。

事故处置过程中累计释放 ~1.3GB dangling 镜像 + build cache，docker 自动 compact vfs 后释放 20GB。**结论：必须加自动 cleanup**，否则 8 次部署后又会撑爆。

## 脚本清单

| 脚本 | 触发时机 | 清理范围 | 风险 |
|---|---|---|---|
| `deploy-cleanup.sh` | **每次部署后**（粘到现有 deploy 脚本末尾） | dangling 镜像 + 72h+ build cache + dangling volume + 72h+ stopped 容器 | 🟢 低（默认不碰带 tag 镜像） |
| `weekly-prune.sh` | 每周日 03:00（crontab） | 同上 + 168h+ **未使用但有 tag 的镜像** | 🟡 中（YITONG_WEEKLY_PRUNE_UNUSED=0 可关闭激进清） |

## install

### 1) 把脚本放到生产服务器

```bash
# 在生产机器上
sudo mkdir -p /opt/yitong/scripts
sudo cp deploy-cleanup.sh weekly-prune.sh /opt/yitong/scripts/
sudo chmod +x /opt/yitong/scripts/*.sh
```

### 2) 集成到现有部署脚本

找到你当前的部署脚本（通常是 `/root/yitongxiaoyuanyun/deploy.sh` 或 `docker-compose 启动命令附近`），在 `docker compose -f docker-compose.prod.yml up -d --build` 之后追加：

```bash
# ↓ 加这一行 ↓
bash /opt/yitong/scripts/deploy-cleanup.sh
```

部署后会自动打印「deploy-cleanup start / done」日志，看到即生效。

### 3) 配置 weekly cron

```bash
sudo crontab -e
# 加一行：
0 3 * * 0 bash /opt/yitong/scripts/weekly-prune.sh >> /var/log/yitong-weekly-prune.log 2>&1
```

可选：weekly 跑完想立刻看效果，开 `YITONG_WEEKLY_LOG` 环境变量让它落 `/var/log/`：

```bash
echo '0 3 * * 0 bash /opt/yitong/scripts/weekly-prune.sh' | sudo crontab -
# 默认已配置 /var/log/yitong-weekly-prune.log 日志路径
```

## 环境变量

### `deploy-cleanup.sh`

| 变量 | 默认 | 说明 |
|---|---|---|
| `YITONG_DEPLOY_DIR` | `$(pwd)` | compose 项目根路径，用于定位日志 |
| `YITONG_LOG_FILE` | stdout | 落盘日志（生产建议 `/var/log/yitong-deploy-cleanup.log`） |
| `YITONG_PRUNE_HOURS` | `72` | build cache / stopped 容器保留小时数 |
| `YITONG_DRY_RUN` | `0` | 设为 `1` 只打印命令不真清（调试用） |

### `weekly-prune.sh`

| 变量 | 默认 | 说明 |
|---|---|---|
| `YITONG_WEEKLY_PRUNE_HOURS` | `168` | 一周保留窗口 |
| `YITONG_WEEKLY_PRUNE_UNUSED` | `1` | 是否清带 tag 但未使用的镜像（**生产可设 0**） |
| `YITONG_WEEKLY_LOG` | `/var/log/yitong-weekly-prune.log` | 日志路径 |

## 验证 / 调试

```bash
# 部署前试跑（dry-run，看会清什么）YITONG_DRY_RUN=1 bash /opt/yitong/scripts/deploy-cleanup.sh

# 看实时日志
tail -f /var/log/yitong-deploy-cleanup.log
tail -f /var/log/yitong-weekly-prune.log

# 手工清一遍（事故恢复后用）
bash /opt/yitong/scripts/deploy-cleanup.sh

# 看 docker 当前占用
docker system df -v
```

## 不要做的事

按 `AGENTS.md` 红线，**agent（Claude）不会主动跑以下命令**，必须由运维（你）执行：

- ❌ `docker system prune --volumes`（会清所有 volume，含 postgres / redis 数据）
- ❌ `docker compose down -v`（会删 named volume）
- ❌ `rm -rf /var/lib/docker/vfs`（要先切 overlay2 driver 并验证无引用）
- ❌ 任何 `rm -rf` 批量删除

本文档的两个脚本**只清 dangling + 过期**，**不会触碰正在用的 volume 和 running 容器**，可放心加进 deploy 流程。

## 中长期路线

| 优先级 | 事项 | 工作量 |
|---|---|---|
| 🔴 P0 | **加 cleanup 脚本**（本仓库 PR） | 已完成 |
| 🟡 P1 | **云盘扩容** `/dev/vda1` 到 200GB | 1 分钟在线扩容 |
| 🟡 P1 | **升级 kernel**（3.10.0-123 → 4.x）→ 切 overlay2 driver | 重启窗口 + daemon.json |
| 🟢 P2 | 监控告警：`/var/lib/docker/vfs > 70%` 自动通知 | 5 分钟 |