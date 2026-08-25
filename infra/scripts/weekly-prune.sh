#!/usr/bin/env bash
# weekly-prune.sh —— yitongxiaoyuanyun 每周一次 docker 全面清理
#
# 用途：挂 crontab，每周日 03:00 自动清理 1 周没用的镜像 + 全部 build cache。
# 比 deploy-cleanup.sh 更激进（since=168h 一周），适合作为周维护。
#
# 清理策略：
#   - 所有 dangling 镜像                    →  必清
#   - builder cache since=168h              →  必清（保留一周内可能回滚用的）
#   - dangling volume                       →  必清
#   - stopped 容器 since=168h              →  必清
#   - 72h 前未使用的镜像（即使有 tag）      →  默认开启（YITONG_WEEKLY_PRUNE_UNUSED=0 可关闭）
#
# 不动：
#   - 当前 running 容器镜像
#   - 任何正在用的 volume
#
# 用法：
#   1) chmod +x weekly-prune.sh
#   2) crontab -e 加：
#        0 3 * * 0 bash /path/to/weekly-prune.sh >> /var/log/yitong-weekly-prune.log 2>&1

set -euo pipefail

SINCE_HOURS="${YITONG_WEEKLY_PRUNE_HOURS:-168}"
PRUNE_UNUSED="${YITONG_WEEKLY_PRUNE_UNUSED:-1}"
LOG_FILE="${YITONG_WEEKLY_LOG:-/var/log/yitong-weekly-prune.log}"

log() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S %z')"
  local msg="[$ts] $*"
  echo "$msg"
  if [[ -n "$LOG_FILE" ]]; then
    mkdir -p "$(dirname "$LOG_FILE")"
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

require_docker

log "weekly-prune start (since=${SINCE_HOURS}h, prune_unused=${PRUNE_UNUSED})"
log "  before docker system df: $(docker system df 2>&1 | tail -1)"

# === 1) dangling 镜像 ===
log "  -> image prune (dangling)"
docker image prune -f --filter "dangling=true" 2>&1 | tail -3 || true

# === 2) build cache ===
log "  -> builder prune (>${SINCE_HOURS}h)"
docker builder prune -f --filter "until=${SINCE_HOURS}h" 2>&1 | tail -3 || true

# === 3) dangling volume ===
log "  -> volume prune (dangling)"
docker volume prune -f 2>&1 | tail -3 || true

# === 4) stopped 容器 ===
log "  -> container prune (>${SINCE_HOURS}h)"
docker container prune -f --filter "until=${SINCE_HOURS}h" 2>&1 | tail -3 || true

# === 5) 未使用的镜像（可选） ===
if [[ "$PRUNE_UNUSED" == "1" ]]; then
  log "  -> image prune -a (>${SINCE_HOURS}h unused, with tag)"
  docker image prune -af --filter "until=${SINCE_HOURS}h" 2>&1 | tail -3 || true
fi

log "  after docker system df: $(docker system df 2>&1 | tail -1)"
log "weekly-prune done"

exit 0