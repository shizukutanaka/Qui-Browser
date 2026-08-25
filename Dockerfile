# Qui Browser VR - Docker Configuration
# Multi-stage build for optimized production image

# ステージ1: ビルドステージ（将来の最適化用）
FROM node:25-alpine AS builder

WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係インストール。
# `--only=production` では vite が入らずビルドできない。lockfile どおりに全て入れる
# （`.dockerignore` は package-lock.json を除外していたので `npm ci` が成立せず、
#  黙って `npm install` にフォールバックして固定されないツリーを作っていた）。
RUN npm ci

# ソースファイルをコピー
COPY . .

# 実際にビルドする。
# ここが無かったため、production ステージは `src/` の生 ESM をそのまま配信していた。
# 実測: 生成される document root を Chromium で読むと `window.QuiBrowser` は
# undefined、`TypeError: Cannot read properties of undefined (reading 'PROD')`
# が投げられる（`import.meta.env` は vite がビルド時に置換する値で、素の
# ブラウザには存在しない）。nginx は /health に 200 を返し続けるので、
# CI の疎通確認だけは緑のまま壊れた成果物を配信していた。
RUN npm run build

# ビルド情報生成
RUN echo "{\"version\":\"2.0.0\",\"build\":\"$(date -u +%Y%m%d%H%M%S)\",\"date\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > dist/build-info.json

# ステージ2: プロダクションステージ
FROM nginx:alpine

# メンテナ情報
LABEL maintainer="Qui Browser VR Team"
LABEL version="2.0.0"
LABEL description="WebXR VR Browser optimized for Meta Quest, Pico, and other VR devices"

# Nginxの不要なデフォルトファイルを削除
RUN rm -rf /usr/share/nginx/html/*

# ビルド成果物だけをコピー（node_modules もテストもソースも入らない）
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

# gzipとbrotli圧縮モジュール
RUN apk add --no-cache \
    nginx-mod-http-brotli \
    nginx-mod-http-geoip2

# 権限設定
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# ポート公開
EXPOSE 80 443

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD /usr/local/bin/healthcheck.sh

# Nginx起動
STOPSIGNAL SIGTERM

CMD ["nginx", "-g", "daemon off;"]
