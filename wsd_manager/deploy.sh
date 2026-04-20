#!/bin/bash
# ══════════════════════════════════════════════════════════════
# WSD Manager — Docker 打包 & 部署脚本
# 用法: bash deploy.sh [build|run|stop|restart|logs|clean]
# ══════════════════════════════════════════════════════════════

set -e

IMAGE="wsd-manager"
CONTAINER="wsd-manager"
PORT="${PORT:-3030}"
DATA_DIR="${DATA_DIR:-$HOME/.wsd-manager/data}"

# 颜色输出
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[WSD]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WSD]${NC} $*"; }
error() { echo -e "${RED}[WSD]${NC} $*"; exit 1; }

cmd="${1:-help}"

case "$cmd" in

# ── 构建镜像 ──────────────────────────────────────────────────
build)
  info "构建镜像: ${IMAGE}:latest ..."
  docker build -t "${IMAGE}:latest" .
  info "构建完成 ✓"
  docker images "${IMAGE}"
  ;;

# ── 启动容器 ──────────────────────────────────────────────────
run)
  # 创建宿主机数据目录
  mkdir -p "${DATA_DIR}"

  # 若已有同名容器先移除
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    warn "发现已有容器 ${CONTAINER}，先停止并移除..."
    docker rm -f "${CONTAINER}"
  fi

  info "启动容器: ${CONTAINER} (端口 ${PORT}) ..."
  docker run -d \
    --name "${CONTAINER}" \
    --restart unless-stopped \
    -p "${PORT}:3030" \
    -v "${DATA_DIR}:/data" \
    -e NODE_ENV=production \
    -e WSD_DATA_DIR=/data \
    "${IMAGE}:latest"

  info "容器已启动 ✓"
  info "访问地址: http://localhost:${PORT}"
  info "数据目录: ${DATA_DIR}"
  ;;

# ── 停止容器 ──────────────────────────────────────────────────
stop)
  info "停止容器 ${CONTAINER} ..."
  docker stop "${CONTAINER}" && docker rm "${CONTAINER}"
  info "已停止 ✓"
  ;;

# ── 重新构建并重启 ─────────────────────────────────────────────
restart)
  bash "$0" build
  bash "$0" run
  ;;

# ── 查看日志 ──────────────────────────────────────────────────
logs)
  docker logs -f --tail=100 "${CONTAINER}"
  ;;

# ── 健康检查 ──────────────────────────────────────────────────
status)
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    info "容器运行中 ✓"
    docker ps --filter "name=${CONTAINER}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    curl -sf "http://localhost:${PORT}/api/health" && echo "" && info "API 健康 ✓" || warn "API 暂未就绪"
  else
    warn "容器未运行"
  fi
  ;;

# ── 清理镜像和容器 ────────────────────────────────────────────
clean)
  warn "将删除容器和镜像，数据目录保留"
  docker rm -f "${CONTAINER}" 2>/dev/null || true
  docker rmi "${IMAGE}:latest" 2>/dev/null || true
  info "清理完成 ✓"
  ;;

# ── 帮助 ──────────────────────────────────────────────────────
*)
  echo ""
  echo "WSD Manager — Docker 部署脚本"
  echo ""
  echo "用法:"
  echo "  bash deploy.sh build      # 构建 Docker 镜像"
  echo "  bash deploy.sh run        # 启动容器（自动挂载数据目录）"
  echo "  bash deploy.sh restart    # 重新构建并启动"
  echo "  bash deploy.sh stop       # 停止并移除容器"
  echo "  bash deploy.sh logs       # 实时查看日志"
  echo "  bash deploy.sh status     # 查看运行状态及健康检查"
  echo "  bash deploy.sh clean      # 删除容器和镜像"
  echo ""
  echo "环境变量（可在执行前 export）:"
  echo "  PORT=3030                 # 宿主机映射端口（默认 3030）"
  echo "  DATA_DIR=~/.wsd-manager/data  # 数据持久化目录"
  echo ""
  echo "示例:"
  echo "  PORT=8080 bash deploy.sh run"
  echo "  DATA_DIR=/opt/wsd/data bash deploy.sh restart"
  echo ""
  ;;
esac
