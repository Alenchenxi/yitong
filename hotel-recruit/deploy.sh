#!/bin/sh
# 一键部署：前提是服务器装了 docker 和 docker compose，且已配置好 .env
set -e
cd "$(dirname "$0")"
[ -f .env ] || { echo "缺少 .env，请先: cp .env.example .env 并填写"; exit 1; }
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
$DC up -d --build
$DC logs --tail 20
echo "----"
echo "服务已启动，监听 8090。请用服务器上的 nginx 把 https 域名反代到 http://127.0.0.1:8090"
