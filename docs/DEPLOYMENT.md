# Deployment Guide - Qui Browser VR

VRブラウザのデプロイメント完全ガイド

Version: 2.0.0
Last Updated: 2025-10-19

---

## 目次

1. [前提条件](#前提条件)
2. [GitHub Pagesへのデプロイ](#github-pagesへのデプロイ)
3. [Netlifyへのデプロイ](#netlifyへのデプロイ)
4. [Vercelへのデプロイ](#vercelへのデプロイ)
5. [カスタムサーバーへのデプロイ](#カスタムサーバーへのデプロイ)
6. [Docker](#docker)
7. [最適化](#最適化)
8. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

### 必須要件

- ✅ **HTTPS**: WebXRは必ずHTTPS環境が必要（localhostを除く）
- ✅ **静的ファイルサーバー**: HTMLファイルを提供できるサーバー
- ✅ **正しいMIMEタイプ**: JavaScriptファイルは `application/javascript`

### 推奨要件

- 🟢 **CDN**: グローバルアクセスの場合
- 🟢 **Gzip/Brotli圧縮**: ファイルサイズ削減
- 🟢 **キャッシュ制御**: パフォーマンス向上
- 🟢 **PWA対応**: Service Worker有効化

---

## GitHub Pagesへのデプロイ

### 自動デプロイ（推奨）

GitHub Actionsワークフローが既に設定されています。

**手順**:

1. **リポジトリをGitHubにプッシュ**
   ```bash
   git remote add origin https://github.com/[username]/qui-browser-vr.git
   git branch -M main
   git push -u origin main
   ```

2. **GitHub Pagesを有効化**
   - リポジトリ > Settings > Pages
   - Source: "GitHub Actions" を選択
   - Save

3. **自動デプロイ**
   - `main`ブランチにプッシュすると自動的にデプロイ
   - Actions タブでデプロイ状況を確認

4. **アクセス**
   ```
   https://[username].github.io/qui-browser-vr/
   ```

### 手動デプロイ

```bash
# 1. gh-pagesブランチ作成
git checkout --orphan gh-pages

# 2. 必要なファイルのみ残す
git rm -rf .
git checkout main -- index.html manifest.json assets/ public/ examples/ docs/

# 3. コミット&プッシュ
git add .
git commit -m "Deploy to GitHub Pages"
git push origin gh-pages

# 4. mainブランチに戻る
git checkout main
```

### カスタムドメイン設定

1. **CNAMEファイル作成**
   ```bash
   echo "vr.yourdomain.com" > CNAME
   git add CNAME
   git commit -m "Add custom domain"
   git push
   ```

2. **DNS設定**
   - Aレコード:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
   - またはCNAMEレコード: `[username].github.io`

3. **HTTPS有効化**
   - Settings > Pages > Enforce HTTPS: チェック

---

## Netlifyへのデプロイ

### 方法1: GitHubから自動デプロイ（推奨）

1. **Netlifyアカウント作成**
   - https://netlify.com にアクセス
   - GitHubでサインアップ

2. **新しいサイト作成**
   - "New site from Git" をクリック
   - GitHubリポジトリを選択
   - ブランチ: `main`
   - ビルドコマンド: 空欄（静的サイト）
   - 公開ディレクトリ: `.` （ルート）

3. **デプロイ**
   - "Deploy site" をクリック
   - 数分で完了

4. **カスタムドメイン設定**
   - Domain settings > Add custom domain
   - DNS設定: Netlify DNSまたは外部DNS

### 方法2: Netlify CLI

```bash
# 1. Netlify CLIインストール
npm install -g netlify-cli

# 2. ログイン
netlify login

# 3. 初期化
netlify init

# 4. デプロイ
netlify deploy --prod
```

### netlify.toml設定

```toml
[build]
  publish = "."

[[redirects]]
  from = "/sw.js"
  to = "/public/sw.js"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*.js"
  [headers.values]
    Content-Type = "application/javascript"
    Cache-Control = "public, max-age=31536000"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"

[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "public, max-age=3600"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
```

---

## Vercelへのデプロイ

### 方法1: GitHubから自動デプロイ

1. **Vercelアカウント作成**
   - https://vercel.com
   - GitHubでサインアップ

2. **新しいプロジェクト作成**
   - "New Project" をクリック
   - GitHubリポジトリをインポート
   - Framework Preset: "Other"
   - Root Directory: `.`

3. **環境変数設定**（オプション）
   ```
   NODE_ENV=production
   ```

4. **デプロイ**
   - "Deploy" をクリック

### 方法2: Vercel CLI

```bash
# 1. Vercel CLIインストール
npm install -g vercel

# 2. ログイン
vercel login

# 3. デプロイ
vercel

# 4. 本番デプロイ
vercel --prod
```

### vercel.json設定

```json
{
  "version": 2,
  "builds": [
    {
      "src": "*.html",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/sw.js",
      "dest": "/public/sw.js"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ],
  "headers": [
    {
      "source": "/(.*).js",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/javascript"
        },
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache"
        }
      ]
    },
    {
      "source": "/(.*).html",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

---

## カスタムサーバーへのデプロイ

### Nginx

**nginx.conf**:

```nginx
server {
    listen 443 ssl http2;
    server_name vr.yourdomain.com;

    # SSL証明書（Let's Encrypt推奨）
    ssl_certificate /etc/letsencrypt/live/vr.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vr.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ルートディレクトリ
    root /var/www/qui-browser-vr;
    index index.html;

    # Gzip圧縮
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # キャッシュ制御
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /sw.js {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header X-Frame-Options "DENY";
        add_header X-Content-Type-Options "nosniff";
        add_header X-XSS-Protection "1; mode=block";
    }

    # Service Worker
    location ~ ^/public/sw\.js$ {
        add_header Cache-Control "no-cache";
        add_header Service-Worker-Allowed "/";
    }
}

# HTTP -> HTTPS リダイレクト
server {
    listen 80;
    server_name vr.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

**デプロイ手順**:

```bash
# 1. ファイルアップロード
scp -r * user@server:/var/www/qui-browser-vr/

# 2. Nginx再起動
ssh user@server "sudo systemctl restart nginx"

# 3. SSL証明書取得（Let's Encrypt）
ssh user@server "sudo certbot --nginx -d vr.yourdomain.com"
```

### Apache

**.htaccess**:

```apache
# HTTPS強制
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST%{REQUEST_URI} [L,R=301]

# Gzip圧縮
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# キャッシュ制御
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType text/html "access plus 1 hour"
</IfModule>

# Service Worker
<Files "sw.js">
  Header set Cache-Control "no-cache"
  Header set Service-Worker-Allowed "/"
</Files>

# セキュリティヘッダー
Header set X-Frame-Options "DENY"
Header set X-Content-Type-Options "nosniff"
Header set X-XSS-Protection "1; mode=block"

# SPAルーティング
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## Docker

### Dockerfile

```dockerfile
FROM nginx:alpine

# ファイルをコピー
COPY . /usr/share/nginx/html

# Nginx設定
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# ポート公開
EXPOSE 80 443

# Nginx起動
CMD ["nginx", "-g", "daemon off;"]
```

### docker/nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /sw.js {
        add_header Cache-Control "no-cache";
    }
}
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  vr-browser:
    build: .
    ports:
      - "8080:80"
    volumes:
      - .:/usr/share/nginx/html:ro
    restart: unless-stopped
```

### デプロイ

```bash
# ビルド
docker build -t qui-browser-vr .

# 実行
docker run -d -p 8080:80 qui-browser-vr

# または docker-compose
docker-compose up -d
```

---

## 最適化

### ファイル圧縮

**Gzip圧縮**:

```bash
# すべてのJavaScriptファイルを圧縮
find assets/js -name "*.js" -exec gzip -k {} \;

# CSS圧縮
find assets/css -name "*.css" -exec gzip -k {} \;
```

**Brotli圧縮（推奨）**:

```bash
# Brotliインストール
npm install -g brotli

# 圧縮
find assets/js -name "*.js" -exec brotli {} \;
find assets/css -name "*.css" -exec brotli {} \;
```

### ファイル最小化

```bash
# UglifyJS（JavaScript最小化）
npm install -g uglify-js

# 全VRモジュールを最小化
for file in assets/js/vr-*.js; do
  uglifyjs "$file" -o "${file%.js}.min.js" -c -m
done
```

### 画像最適化

```bash
# ImageMagick
find assets/icons -name "*.png" -exec convert {} -quality 85 {} \;

# SVG最適化
npm install -g svgo
find assets -name "*.svg" -exec svgo {} \;
```

### Service Worker最適化

```javascript
// sw.js - キャッシュサイズ制限
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

async function trimCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  let totalSize = 0;

  for (const request of keys) {
    const response = await cache.match(request);
    const blob = await response.blob();
    totalSize += blob.size;

    if (totalSize > maxSize) {
      await cache.delete(request);
    }
  }
}
```

---

## CDN設定

### Cloudflare

1. **サイト追加**
   - Cloudflareにドメインを追加
   - DNSレコードをインポート

2. **最適化設定**
   - Speed > Optimization
   - Auto Minify: JS, CSS, HTML
   - Brotli: 有効化
   - HTTP/3: 有効化

3. **キャッシュルール**
   ```
   *.js → Cache Level: Standard, Browser TTL: 1 year
   *.css → Cache Level: Standard, Browser TTL: 1 year
   *.html → Cache Level: Standard, Browser TTL: 1 hour
   /sw.js → Cache Level: Bypass
   ```

### AWS CloudFront

**distribution-config.json**:

```json
{
  "Origins": {
    "Items": [
      {
        "Id": "S3-qui-browser-vr",
        "DomainName": "qui-browser-vr.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-qui-browser-vr",
    "ViewerProtocolPolicy": "redirect-to-https",
    "Compress": true,
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000
  }
}
```

---

## 監視とログ

### Google Analytics

```html
<!-- index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Sentry（エラー追跡）

```javascript
// エラー追跡
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "https://your-dsn@sentry.io/project-id",
  environment: "production",
  release: "qui-browser-vr@2.0.0"
});
```

---

## トラブルシューティング

### 問題: WebXRが動作しない

**原因**: HTTPSでない

**解決策**:
```bash
# Let's Encrypt証明書取得
sudo certbot --nginx -d yourdomain.com
```

### 問題: Service Workerが更新されない

**原因**: キャッシュの問題

**解決策**:
```javascript
// Service Workerバージョン更新
const CACHE_VERSION = 'v2.0.1'; // バージョンアップ

// 強制更新
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.update());
});
```

### 問題: ファイルが404エラー

**原因**: パスが間違っている

**解決策**:
```javascript
// 絶対パスを使用
<script src="/assets/js/vr-launcher.js"></script>

// 相対パスではなく
<script src="./assets/js/vr-launcher.js"></script>
```

---

## チェックリスト

デプロイ前の確認事項:

- [ ] HTTPS有効化
- [ ] Service Worker登録確認
- [ ] manifest.json設定
- [ ] キャッシュ制御設定
- [ ] Gzip/Brotli圧縮有効化
- [ ] セキュリティヘッダー設定
- [ ] エラーログ監視設定
- [ ] パフォーマンステスト実施
- [ ] Meta Questでテスト
- [ ] Pico 4でテスト
- [ ] ドキュメント更新

---

## サポート

- **Issues**: https://github.com/yourusername/qui-browser-vr/issues
- **Discussions**: https://github.com/yourusername/qui-browser-vr/discussions
- **Email**: support@qui-browser.example.com

---

**Version**: 2.0.0
**Last Updated**: 2025-10-19
**License**: MIT
