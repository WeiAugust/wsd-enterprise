FROM node:20-alpine

LABEL org.opencontainers.image.title="WSD Manager"
LABEL org.opencontainers.image.description="企业级 Claude Code 资产管理平台"

WORKDIR /app

# 安装依赖
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# 复制源码
COPY src/ ./src/
COPY web/ ./web/
COPY registry/ ./registry/
COPY cli/ ./cli/

# 创建数据目录
RUN mkdir -p /data && chown -R node:node /data /app

USER node

# 环境变量
ENV PORT=3030
ENV NODE_ENV=production
ENV WSD_DATA_DIR=/data

EXPOSE 3030

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3030/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/server.js"]
