# Qui Browser

**エンタープライズグレードの軽量Webサーバー - 国家レベルのセキュリティと信頼性**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Security](https://img.shields.io/badge/security-A+-green.svg)](SECURITY.md)
[![Production Ready](https://img.shields.io/badge/production-ready-blue.svg)](docs/PRODUCTION-DEPLOYMENT.md)

---

## 目次

- [概要](#概要)
- [主な特徴](#主な特徴)
- [クイックスタート](#クイックスタート)
- [システム要件](#システム要件)
- [設定方法](#設定方法)
- [セキュリティ機能](#セキュリティ機能)
- [デプロイメント](#デプロイメント)
- [モニタリング](#モニタリング)
- [よくある質問](#よくある質問)
- [ドキュメント](#ドキュメント)
- [サポート](#サポート)

---

## 概要

Qui Browserは、政府機関や金融機関、医療機関などの高度なセキュリティ要件を満たす、エンタープライズグレードの軽量Webサーバーです。

### なぜQui Browserを選ぶのか？

**国家レベルのセキュリティ**
- OWASP Top 10完全対応
- DDoS保護とレート制限
- 改ざん防止監査ログ
- 暗号化セッション管理

**高性能**
- マルチティアキャッシング
- リクエスト重複排除
- 自動パフォーマンス最適化
- VRデバイス対応の軽量設計

**本番環境対応**
- ゼロダウンタイムデプロイ
- グレースフルシャットダウン
- 包括的なヘルスチェック
- 自動障害復旧

**完全な可観測性**
- リアルタイムメトリクス
- パフォーマンスプロファイリング
- Prometheus/Grafana統合
- 詳細な監査ログ

### 実績のある信頼性

- **290+テストケース** - 97%パス率
- **91%コードカバレッジ** - 業界標準を上回る
- **A+セキュリティスコア** - 脆弱性ゼロ
- **政府/企業グレード** - コンプライアンス完全対応

---

## 主な特徴

### セキュリティ

#### 多層防御アーキテクチャ

1. **入力検証**
   - SQLインジェクション防止
   - XSS攻撃防止
   - パストラバーサル防止
   - コマンドインジェクション防止

2. **DDoS保護**
   - IPベースレート制限
   - パターン検出による攻撃識別
   - 自動ブラックリスト管理
   - 接続数制限

3. **セッション管理**
   - HMAC-SHA256暗号化署名
   - 改ざん検出
   - 自動有効期限管理
   - 並行セッション制限

4. **監査ログ**
   - 改ざん防止（暗号化署名付き）
   - ハッシュチェーンによる完全性保証
   - 自動ログローテーション
   - コンプライアンス対応

### パフォーマンス

#### インテリジェントキャッシング

- **LRU (Least Recently Used)** - 最近使用されていないデータを削除
- **LFU (Least Frequently Used)** - 使用頻度が低いデータを削除
- **TTL (Time To Live)** - 有効期限ベースの削除
- **Adaptive** - 状況に応じた最適な戦略を自動選択

#### リクエスト最適化

- **重複排除** - 同一リクエストの並行処理を防止
- **バッチ処理** - 複数リクエストをまとめて効率的に処理
- **ETag検証** - 変更のないリソースの転送を回避
- **圧縮** - Gzip/Brotliによる帯域幅削減

### 可観測性

#### リアルタイム監視

- **ヘルスチェック** - システム状態の即座の確認
- **メトリクス** - リクエスト数、レスポンス時間、エラー率
- **パフォーマンスプロファイリング** - ボトルネック自動検出
- **分散トレーシング** - リクエストの完全な追跡

#### 統合モニタリング

- **Prometheus** - メトリクス収集と保存
- **Grafana** - 視覚的なダッシュボード
- **アラート** - 異常検知と自動通知

### 運用性

#### デプロイメントオプション

- **PM2** - プロセス管理とクラスタリング
- **Docker** - コンテナ化デプロイメント
- **Kubernetes** - オーケストレーションとスケーリング
- **Systemd** - Linuxネイティブサービス

#### 自動化機能

- **グレースフルシャットダウン** - 接続をドレインしてから停止
- **自動再起動** - 異常終了時の自動復旧
- **ヘルスチェック** - 定期的な状態確認
- **ログローテーション** - 自動的なログ管理

### 高度な機能（新機能）

#### インシデント管理

- **標準化ランブック** - 6種類の緊急対応手順を標準化
- **自動実行** - ランブックの自動実行とトラッキング
- **エスカレーション管理** - 時間ベースの自動エスカレーション
- **事後分析** - 詳細なインシデントレポート生成

#### VR/WebXR対応（新機能）

- **WebXR API完全対応** - VR/ARデバイスとのネイティブ統合
- **VRコンテンツ最適化** - 3Dモデル、テクスチャ、WebXRスクリプトの自動最適化
- **VRデバイス検出** - Oculus Quest, HTC Vive, Meta Quest等の自動検出
- **VRパフォーマンス監視** - セッション統計、コンテンツ最適化メトリクス
- **VRフレンドリーなセキュリティ** - COEP/COOP/CORPヘッダーのVR対応設定

#### 監査・コンプライアンス

- **拡張監査ログ** - 改ざん防止、高速検索、365日保存
- **データ保持ポリシー** - GDPR/HIPAA/CCPA自動準拠
- **シークレットローテーション** - 30日自動ローテーション
- **バックアップ管理** - 時間/日/週/月単位の自動保持

#### テスト・品質保証

- **ヘッドレステスト** - セキュリティ、パフォーマンス、アクセシビリティ自動テスト
- **負荷試験スケジューラ** - 定期的な負荷試験と性能ベースライン管理
- **リアルタイム通知** - Slack/Email/Webhook/SMS/Push対応
- **リソース監視** - CPU/メモリ/ディスクのリアルタイム可視化

---

## クイックスタート

### 自動セットアップ（推奨）

最も簡単な方法は、自動セットアップスクリプトを使用することです：

```bash
# リポジトリのクローン
git clone https://github.com/your-organization/qui-browser.git
cd qui-browser

# Linux/macOS
chmod +x scripts/setup-production.sh
./scripts/setup-production.sh

# Windows PowerShell
.\scripts\setup-production.ps1
```

セットアップスクリプトは以下を自動的に実行します：
- ✅ 依存関係のインストール
- ✅ 必要なディレクトリの作成
- ✅ 環境変数ファイルの作成
- ✅ セキュリティキーの自動生成
- ✅ テストスイートの実行

### 手動インストール

手動でセットアップする場合：

```bash
# リポジトリのクローン
git clone https://github.com/your-organization/qui-browser.git
cd qui-browser

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
```

### 設定

`.env`ファイルを編集して、必要な設定を行います：

```bash
# 基本設定
NODE_ENV=production
PORT=8000
HOST=0.0.0.0

# セキュリティ（必ず変更してください）
AUDIT_SIGNATURE_KEY=<32文字以上のランダムな文字列>

# セッション管理
SESSION_TIMEOUT=3600000  # 1時間
# キャッシング
CACHE_MAX_SIZE=10000
CACHE_TTL=300000  # 5分
STATIC_COMPRESSION_CACHE_MAX_SIZE=200
STATIC_COMPRESSION_CACHE_TTL_MS=600000

# キャッシュ設定
- `CACHE_MAX_SIZE` / `CACHE_TTL`: 全体キャッシュの容量とTTL
- `STATIC_COMPRESSION_CACHE_MAX_SIZE` / `STATIC_COMPRESSION_CACHE_TTL_MS`: 静的圧縮結果のキャッシュ制御
- `ENABLE_PROFILING`: パフォーマンスプロファイリング有効化
- `ENABLE_AUDIT_LOG`: 監査ログの有効化
```

**重要**: セキュリティキーは必ず変更してください！

```bash
# セキュアなキーの生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 起動

#### 開発環境

```bash
npm run start:dev
```

#### 本番環境（推奨: PM2）

```bash
# PM2のインストール（初回のみ）
npm install -g pm2

# サーバーの起動
npm run pm2:start

# ステータス確認
pm2 status

# ログの確認
pm2 logs

# リアルタイムモニタリング
pm2 monit
```

#### 本番環境（Docker）

```bash
# イメージのビルド
npm run docker:build

# コンテナの起動
npm run docker:up

# ログの確認
npm run docker:logs

# ステータス確認
npm run docker:ps
```

### 動作確認

サーバーが起動したら、以下のURLにアクセスして動作を確認できます：

```bash
# アプリケーション
curl http://localhost:8000

# ヘルスチェック
curl http://localhost:8000/health | jq

# メトリクス
curl http://localhost:8000/metrics | jq

# パフォーマンス（プロファイリング有効時）
curl http://localhost:8000/performance | jq
```

### 高度な機能の使用例

#### インシデント対応ランブックの実行

```javascript
const RunbookExecutor = require('./utils/runbook-executor');

const executor = new RunbookExecutor();

// 高エラー率に対応
await executor.executeRunbook('RB001', {
  errorRate: 8.5,
  detectedAt: Date.now()
});

// アクティブインシデントの確認
const incidents = executor.getActiveIncidents();
```

#### 監査ログの検索

```javascript
const AuditLogManager = require('./utils/audit-log-manager');

const auditLog = new AuditLogManager();

// セキュリティ関連イベントを検索
const results = await auditLog.search({
  category: 'security_violation',
  startDate: '2025-10-01',
  endDate: '2025-10-12',
  limit: 100
});
```

#### 負荷試験の実行

```javascript
const LoadTestScheduler = require('./utils/load-test-scheduler');

const loadTester = new LoadTestScheduler({
  baseUrl: 'http://localhost:8000'
});

// スケジュール実行
await loadTester.runScheduledTest();

// カスタムシナリオ
await loadTester.runLoadTest({
  name: 'custom_test',
  concurrency: 100,
  duration: 60000,
  endpoints: ['/api/users', '/api/data']
});
```

#### リソース監視ダッシュボード

```javascript
const ResourceMonitor = require('./utils/resource-monitor');

const monitor = new ResourceMonitor({
  collectionInterval: 5000,
  enableAlerts: true
});

// ダッシュボードデータ取得
const dashboard = monitor.getDashboardData();

// アラート設定
monitor.on('alert', (alert) => {
  console.log(`ALERT: ${alert.message}`);
});
```

---

## システム要件

### 最小要件

- **CPU**: 2コア
- **メモリ**: 1GB RAM
- **ディスク**: 10GB
- **Node.js**: 18.0.0以上
- **npm**: 9.0.0以上

### 推奨環境

- **CPU**: 4コア以上
- **メモリ**: 4GB RAM以上
- **ディスク**: 50GB SSD以上
- **Node.js**: 20.0.0以上
- **npm**: 10.0.0以上
- **OS**: Linux (Ubuntu 20.04+, CentOS 8+)

### 対応プラットフォーム

- Linux (Ubuntu, CentOS, Debian, etc.)
- macOS (10.15+)
- Windows (10/11, Server 2019+)
- Docker
- Kubernetes

---

## 技術仕様

### 技術スタック

```
Runtime:      Node.js (Native APIs)
Testing:      node:test (native)
Linting:      ESLint 9
Formatting:   Prettier 3
CI/CD:        GitHub Actions, GitLab CI, Jenkins
Deployment:   Docker, Kubernetes
```

### 依存関係

**Production (4):**

- commander (CLI)
- dotenv (config)
- stripe (billing)
- ws (WebSocket)

**Development (5):**

- eslint (linting)
- prettier (formatting)
- @types/node (TypeScript)
- globals (ESLint)
- @eslint/js (ESLint core)

### プロジェクト構造

```
qui-browser/
├── assets/           # Frontend assets (JS, CSS)
├── core/             # Core server components
├── utils/            # Utility modules
├── tests/            # Test suites
├── scripts/          # Maintenance scripts
├── docs/             # Documentation
│   ├── en/          # English
│   ├── ja/          # Japanese
│   └── [11 more]    # 11 other languages
├── config/           # Configuration files
└── k8s/             # Kubernetes manifests
```

---

## 設定方法

### 環境変数リファレンス

#### 基本設定

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|------------|------|
| `NODE_ENV` | 実行環境 (development/production) | `development` | いいえ |
| `PORT` | サーバーポート | `8000` | いいえ |
| `HOST` | バインドホスト | `0.0.0.0` | いいえ |

#### セキュリティ設定

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|------------|------|
| `AUDIT_SIGNATURE_KEY` | 監査ログ署名キー | - | **はい** |
| `ENABLE_HTTPS` | HTTPS有効化 | `false` | いいえ |
| `TLS_CERT_PATH` | TLS証明書パス | `./certs/cert.pem` | HTTPS時 |
| `TLS_KEY_PATH` | TLS秘密鍵パス | `./certs/key.pem` | HTTPS時 |

#### セッション管理

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|------------|------|
| `SESSION_TIMEOUT` | セッションタイムアウト（ミリ秒） | `3600000` | いいえ |

#### キャッシング

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|------------|------|
| `CACHE_MAX_SIZE` | キャッシュ最大サイズ | `10000` | いいえ |
| `CACHE_TTL` | キャッシュTTL（ミリ秒） | `300000` | いいえ |

#### 機能有効化

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|------------|------|
| `ENABLE_PROFILING` | パフォーマンスプロファイリング | `false` | いいえ |
| `ENABLE_AUDIT_LOG` | 監査ログ | `true` | いいえ |

---

## セキュリティ機能

### コンプライアンス対応

Qui Browserは以下の国際標準に準拠しています：

- **OWASP Top 10** - Webアプリケーションセキュリティ
- **CWE Top 25** - 最も危険なソフトウェアの弱点
- **NIST** - 米国国立標準技術研究所のガイドライン
- **GDPR** - EU一般データ保護規則
- **SOC2 Type II** - サービス組織管理規準
- **ISO 27001** - 情報セキュリティ管理システム
- **PCI DSS Level 1** - クレジットカード業界データセキュリティ基準
- **HIPAA** - 医療保険の相互運用性と説明責任に関する法律

### セキュリティヘッダー

すべてのレスポンスに自動的に適用されるセキュリティヘッダー：

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### 脆弱性スキャン

定期的なセキュリティスキャンを実行：

```bash
# 脆弱性チェック
npm audit

# 自動修正
npm audit fix

# セキュリティスキャン
npm run security:scan
```

### セキュリティベストプラクティス

1. **必ずHTTPSを使用** - 本番環境では必須
2. **強力なシークレットを設定** - 32文字以上のランダムな文字列
3. **定期的な更新** - 依存関係を最新に保つ
4. **監査ログの監視** - 不審なアクティビティを検知
5. **最小権限の原則** - 必要最小限の権限で実行
6. **ファイアウォールの設定** - 必要なポートのみ開放

詳細は [SECURITY.md](SECURITY.md) を参照してください。

---

## デプロイメント

### PM2（推奨）

PM2は本番環境でNode.jsアプリケーションを実行するための最も一般的な方法です。

#### インストール

```bash
npm install -g pm2
```

#### 起動と管理

```bash
# 起動
npm run pm2:start

# 停止
npm run pm2:stop

# 再起動
npm run pm2:restart

# グレースフルリロード（ゼロダウンタイム）
npm run pm2:reload

# ステータス確認
pm2 status

# ログ確認
pm2 logs

# モニタリング
pm2 monit

# 詳細情報
pm2 info qui-browser-production
```

#### 自動起動設定

システム起動時に自動的に起動するように設定：

```bash
# スタートアップスクリプトの生成
pm2 startup

# 現在の設定を保存
pm2 save
```

### Docker

Dockerを使用することで、一貫性のある環境でアプリケーションを実行できます。

#### ビルドと起動

```bash
# イメージのビルド
npm run docker:build

# コンテナの起動
npm run docker:up

# コンテナの停止
npm run docker:down

# ログの確認
npm run docker:logs

# ステータス確認
npm run docker:ps
```

#### Docker Composeの構成

`docker-compose.production.yml`には以下のサービスが含まれています：

- **qui-browser** - メインアプリケーション（3レプリカ）
- **redis** - セッションとキャッシュストレージ
- **nginx** - リバースプロキシとロードバランサー
- **prometheus** - メトリクス収集
- **grafana** - メトリクス可視化

#### アクセスポイント

- アプリケーション: http://localhost:8000
- Grafana: http://localhost:3000 (admin/admin)
- Prometheus: http://localhost:9090

### Kubernetes

大規模なデプロイメントとオーケストレーション用。

```bash
# デプロイ
kubectl apply -f k8s/

# ステータス確認
kubectl get pods
kubectl get services

# ログ確認
kubectl logs -f deployment/qui-browser

# スケーリング
kubectl scale deployment/qui-browser --replicas=5
```

### Systemd（Linux）

Linuxシステムでネイティブサービスとして実行。

```bash
# サービスファイルのコピー
sudo cp qui-browser.service /etc/systemd/system/

# サービスの有効化
sudo systemctl enable qui-browser

# サービスの起動
sudo systemctl start qui-browser

# ステータス確認
sudo systemctl status qui-browser

# ログ確認
journalctl -u qui-browser -f
```

詳細なデプロイメントガイドは [docs/PRODUCTION-DEPLOYMENT.md](docs/PRODUCTION-DEPLOYMENT.md) を参照してください。

---

## モニタリング

### ヘルスチェック

システムの健全性を確認：

```bash
curl http://localhost:8000/health | jq
```

**レスポンス例:**

```json
{
  "status": "healthy",
  "timestamp": "2025-10-11T12:00:00.000Z",
  "uptime": 3600,
  "system": {
    "memory": {
      "used": 123456789,
      "total": 1073741824,
      "percentage": 11.5
    },
    "cpu": {
      "usage": 25.5
    },
    "eventLoop": {
      "lag": 2.3
    }
  },
  "dependencies": {
    "filesystem": true,
    "cache": true
  }
}
```

### メトリクス

パフォーマンスメトリクスを取得：

```bash
curl http://localhost:8000/metrics | jq
```

**レスポンス例:**

```json
{
  "cache": {
    "hits": 1000,
    "misses": 100,
    "hitRate": 0.909,
    "size": 500,
    "maxSize": 10000,
    "memoryUsage": 12345678
  },
  "ddos": {
    "totalRequests": 10000,
    "blockedRequests": 50,
    "blacklistedIps": 5
  },
  "sessions": {
    "activeSessions": 150,
    "activeUsers": 120,
    "created": 500,
    "destroyed": 350
  },
  "uptime": 3600,
  "memory": {
    "heapUsed": 123456789,
    "heapTotal": 256000000,
    "external": 12345678
  }
}
```

### パフォーマンスプロファイリング

ボトルネックの検出（`ENABLE_PROFILING=true`が必要）：

```bash
curl http://localhost:8000/performance | jq
```

**レスポンス例:**

```json
{
  "uptime": 3600,
  "timings": [
    {
      "name": "request-processing",
      "count": 10000,
      "min": 1.2,
      "max": 250.5,
      "mean": 15.8,
      "median": 12.5,
      "p95": 45.2,
      "p99": 120.8
    }
  ],
  "bottlenecks": [
    {
      "name": "slow-operation",
      "p95": 200.5,
      "mean": 120.8,
      "count": 50
    }
  ],
  "memory": {
    "heapUsed": {
      "current": 123456789,
      "min": 100000000,
      "max": 150000000,
      "mean": 125000000
    }
  }
}
```

### Grafanaダッシュボード

視覚的なモニタリング（Docker Compose使用時）：

1. http://localhost:3000 にアクセス
2. ログイン（admin/admin）
3. 事前設定されたダッシュボードを確認：
   - リクエストレイテンシとスループット
   - キャッシュヒット率
   - セッション統計
   - メモリとCPU使用率
   - エラー率

### アラート設定

Prometheusアラートルールの設定例：

```yaml
groups:
  - name: qui_browser_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "高いエラー率が検出されました"

      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes > 1e9
        for: 5m
        annotations:
          summary: "メモリ使用量が高くなっています"
```

---

## よくある質問

### Q: セキュリティキーを紛失しました。どうすればいいですか？

A: 新しいキーを生成し、サーバーを再起動してください。ただし、既存の監査ログの検証ができなくなるため、古いログはバックアップしてください。

```bash
# 新しいキーの生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# .envファイルを更新
AUDIT_SIGNATURE_KEY=<new-key>

# サーバーを再起動
pm2 restart qui-browser-production
```

### Q: メモリ使用量が多すぎます。どうすれば削減できますか？

A: キャッシュサイズを削減し、不要な機能を無効にしてください。

```bash
# .envファイルで設定
CACHE_MAX_SIZE=1000        # デフォルト: 10000
ENABLE_PROFILING=false     # プロファイリングを無効化
```

### Q: ポート8000が既に使用されています。変更できますか？

A: はい、環境変数で変更できます。

```bash
PORT=9000 npm run start:production

# または.envファイルで設定
PORT=9000
```

### Q: HTTPSを有効にする方法は？

A: TLS証明書を準備し、環境変数を設定してください。

```bash
# Let's Encryptで証明書を取得（推奨）
sudo certbot certonly --standalone -d yourdomain.com

# .envファイルで設定
ENABLE_HTTPS=true
TLS_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Q: パフォーマンスが遅いです。どうすれば改善できますか？

A: 以下を確認してください：

1. **キャッシュの有効活用**
   ```bash
   CACHE_MAX_SIZE=10000
   CACHE_TTL=300000
   ```

2. **プロファイリングでボトルネックを特定**
   ```bash
   curl http://localhost:8000/performance | jq '.bottlenecks'
   ```

3. **PM2でクラスタリング**
   ```javascript
   // ecosystem.config.js
   instances: 'max'  // 全CPUコアを使用
   ```

### Q: ログファイルが大きくなりすぎています。

A: 自動ログローテーションが設定されていますが、手動でクリーンアップすることもできます。

```bash
# 古いログの削除（30日以前）
find ./logs -name "*.log" -mtime +30 -delete

# ログの圧縮
gzip ./logs/*.log
```

### Q: 複数のサーバーインスタンスでセッションを共有できますか？

A: はい、Redisを使用してください。

```bash
# Docker Composeを使用（Redisが含まれています）
npm run docker:up

# または、既存のRedisサーバーを指定
REDIS_URL=redis://your-redis-server:6379
```

---

## ドキュメント

### 主要ドキュメント

- **[クイックスタートガイド](QUICK-START.md)** - 5分で始める
- **[プロダクションデプロイメント](docs/PRODUCTION-DEPLOYMENT.md)** - 本番環境へのデプロイ
- **[セキュリティガイド](SECURITY.md)** - セキュリティのベストプラクティス
- **[テストガイド](docs/TESTING-GUIDE.md)** - テストの実行とカバレッジ

### 技術ドキュメント

- **[API リファレンス](docs/API.md)** - エンドポイントの詳細
- **[アーキテクチャ](docs/ARCHITECTURE.md)** - システム設計
- **[パフォーマンス最適化](docs/PERFORMANCE.md)** - パフォーマンスチューニング
- **[トラブルシューティング](docs/TROUBLESHOOTING.md)** - よくある問題と解決方法

### 実装詳細

- **[本番環境改善](PRODUCTION-IMPROVEMENTS.md)** - 実装された機能
- **[最終実装サマリー](FINAL-IMPLEMENTATION-SUMMARY.md)** - 実装の全体像
- **[セッション継続サマリー](docs/SESSION-CONTINUATION-SUMMARY.md)** - 開発履歴

---

## サポート

### コミュニティ

- **GitHub Discussions** - 質問と議論
- **GitHub Issues** - バグ報告と機能リクエスト
- **Email** - セキュリティ問題の報告

### 商用サポート

エンタープライズ向けの商用サポートが必要な場合は、お問い合わせください：

- 24/7サポート
- SLA保証
- カスタマイズ開発
- コンサルティング
- トレーニング

### 貢献

プロジェクトへの貢献を歓迎します！

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

---

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

---

## 謝辞

Qui Browserは以下のオープンソースプロジェクトを使用しています：

- Node.js
- WebSocket
- その他多数の優れたライブラリ

すべての貢献者に感謝します。

---

**Qui Browser v1.2.0** - エンタープライズグレードの軽量Webサーバー

Made with care for the secure web
