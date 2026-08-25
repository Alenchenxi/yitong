#!/usr/bin/env bash
# deploy-cleanup.sh —— yitongxiaoyuanyun 部署后自动清理 docker dangling 资源
#
# 用途：粘到生产部署脚本末尾（docker compose up -d --build 之后）。
# 解决：vfs storage driver 不共享 layer + 缺 cleanup 导致 /var/lib/docker 累积撑爆磁盘。
# 事故溯源：2026-08-25 圈子 LOGO 上传失败，根因 /var/lib/docker 100% 满。
#
# 清理策略（保守，不影响当前 running 容器）：
#   - dangling=true 镜像          （<none>:<none>，旧 tag 覆盖残留）  →  每次部署必清
#   - builder cache since=72h    （旧 build 中间产物，>72h 没用的全清） →  每次部署必清
#   - dangling volume             （没有容器引用的 volume，孤儿数据）   →  每次部署必清
#   - stopped container since=72h （>72h 仍 stopped 的容器）            →  每次部署必清
#
# 不动：
#   - 当前 running 容器镜像（即使没被引用也不清，避免误删 hot image）
#   - 任何正在用的 volume（prune 默认排除）
#   - 任何正在用的 network
#
# 依赖：docker CLI >= 17；bash 3.2+。CentOS 7 默认 bash 4.2 通过。
#
# 用：法：
#   1) chmod +x deploy-cleanup.sh
#   2) 在部署脚本末尾追加：
#        bash /path/to/deploy-cleanup.sh
#   3) 可选环境变量：
#        YITONG_DEPLOY_DIR=/path/to/compose   显式指定 compose 项目根（默认 cwd）
#        YITONG_LOG_FILE=/var/log/yitong-deploy.log  日志落盘（默认 stdout）

set -euo pipefail

# === 配置 ===
DEPLOY_DIR="${YITONG_DEPLOY_DIR:-$(pwd)}"
LOG_FILE="${YITONG_LOG_FILE:-}"
SINCE_HOURS="${YITONG_PRUNE_HOURS:-72}"
DRY_RUN="${YITONG_DRY_RUN:-0}"

# === 工具函数 ===
log() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S %z')"
  local msg="[$ts] $*"
  echo "$msg"
  if [[ -n "$LOG_FILE" ]]; then
    echo "$msg" >> "$LOG_FILE"
  fi
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log "ERROR: docker not found in PATH"
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    log "ERROR: docker daemon unreachable"
    exit 2
  fi
}

# === 前置：检查 docker ===
require_docker

# === 前置：记录清理前空间 ===
BEFORE_DF="$(df -h /var/lib/docker 2>/dev/null | tail -1 || df -h / | tail -1)"
BEFORE_DF_VFS="$(du -sh /var/lib/docker/vfs 2>/dev/null | awk '{print $1}' || echo 'n/a')"
log "deploy-cleanup start"
log "  deploy_dir: $DEPLOY_DIR"
log "  prune_since_hours: $SINCE_HOURS"
log "  before docker df: $BEFORE_DF"
log "  before /var/lib/docker/vfs: $BEFORE_DF_VFS"

run_prune() {
  local label="$1"; shift
  local cmd=("$@")
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: $label -> ${cmd[*]}"
    return 0
  fi
  log "  -> $label: ${cmd[*]}"
  # shellcheck disable=SC2068
  ${cmd[@]} >/tmp/yitong-prune-$$.log 2>&1 || {
    local rc=$?
    log "    WARN: $label exited $rc"
    log "    output: $(tail -5 /tmp/yitong-prune-$$.log | tr '\n' ' ')"
    rm -f /tmp/yitong-prune-$$.log
    return $rc
  }
  # 输出最后一行 'Total reclaimed space: XXX' 之类的统计
  local summary
  summary="$(grep -E '^Total|reclaimed|deleted' /tmp/yitong-prune-$$.log 2>/dev/null | tail -3 | tr '\n' '|' || true)"
  if [[ -n "$summary" ]]; then
    log "    $summary"
  fi
  rm -f /tmp/yitong-prune-$$.log
}

# === 清理动作 ===
# 1) dangling 镜像（<none>:<none>）—— 每次部署必清
run_prune "image prune (dangling)" \
  docker image prune -f --filter "dangling=true"

# 2) build cache（>72h 的 builder cache）—— 每次部署必清
run_prune "builder prune (>${SINCE_HOURS}h)" \
  docker builder prune -f --filter "until=${SINCE_HOURS}h"

# 3) dangling volume（孤儿 volume，0 容器引用的）—— 每次部署必清
run_prune "volume prune (dangling)" \
  docker volume prune -f

# 4) stopped 容器（>72h 还 stopped 的）—— 每次部署必清
run_prune "container prune (>${SINCE_HOURS}h)" \
  docker container prune -f --filter "until=${SINCE_HOURS}h"

# === 清理后：记录空间 ===
AFTER_DF="$(df -h /var/lib/docker 2>/dev/null | tail -1 || df -h / | tail -1)"
AFTER_DF_VFS="$(du -sh /var/lib/docker/vfs 2>/dev/null | awk '{print $1}' || echo 'n/a')"
log "deploy-cleanup done"
log "  after docker df: $AFTER_DF"
log "  after /var/lib/docker/vfs: $AFTER_DF_VFS"

# === 后置：当前容器巡检 ===
RUNNING_COUNT="$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')"
log "  currently running containers: $RUNNING_COUNT"

# 暴露给调用方一个退出码（始终 0 —— 清理失败不阻断部署）
exit 0