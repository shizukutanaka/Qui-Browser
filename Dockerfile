# Qui Browser VR - Docker Configuration
# Multi-stage build for optimized production image

# ステージ1: ビルドステージ
FROM node:25-alpine AS builder

WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package.json package-lock.json ./

# 依存関係インストール（vite/terserはdevDependenciesのため全量）
RUN npm ci

# ソースファイルをコピー
COPY . .

# Viteビルドとビルド情報生成
RUN npm run build && \
    echo "{\"version\":\"2.0.0\",\"build\":\"$(date -u +%Y%m%d%H%M%S)\",\"date\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > dist/build-info.json

# ステージ2: プロダクションステージ
FROM nginx:alpine

# メンテナ情報
LABEL maintainer="Qui Browser VR Team"
LABEL version="2.0.0"
LABEL description="WebXR VR Browser optimized for Meta Quest, Pico, and other VR devices"

# Nginxの不要なデフォルトファイルを削除
RUN rm -rf /usr/share/nginx/html/*

# ビルド済みアプリケーションをコピー
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx設定ファイルをコピー
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# ヘルスチェック用スクリプト
COPY docker/healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh

# タイムゾーン設定
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime && \
    echo "Asia/Tokyo" > /etc/timezone && \
    apk del tzdata

# 権限設定
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# ポート公開（TLS終端は上流のリバースプロキシ想定）
EXPOSE 80

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD /usr/local/bin/healthcheck.sh

# Nginx起動
STOPSIGNAL SIGTERM

CMD ["nginx", "-g", "daemon off;"]
