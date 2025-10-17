# Qui Browser 運用ガイド (日本語)

## 想定読者

VR 環境で Qui
Browser を本番運用する運用チームおよび SRE チーム向けの手引きです。

## 1. デプロイ前チェックリスト

- **コンテナイメージ**: `docker build -t <registry>/qui-browser:<tag> .`
  でビルドし、`npm run security:scan` で脆弱性スキャンを実施します。
- **環境変数ファイル**: `.env.example` を複製し、`your_*` や `changeme`
  などのプレースホルダーを削除して秘密情報管理サービスで保護します。
- **環境検証**: デプロイ前に `npm run check:env` または `node cli.js env:check`
  を実行し、必須キーや HTTPS URL が正しく設定されていることを確認します。
- **TLS 証明書**:
  Ingress もしくはリバースプロキシ用に証明書を準備します。`k8s/ingress.yaml`
  のアノテーションを参照します。
- **課金設定**: `node ./cli.js billing:diagnostics`
  で Stripe 設定と URL を検証します。
- **静的アセット**: `npm run format:check`
  を実行し、プレ圧縮アセットの整合性を確認します。

## 2. 稼働時の期待値

- **プロセスエントリーポイント**: `npm start` または
  `node ./cli.js start --port 8000` で `server-lightweight.js` が起動します。
- **標準ポート**: HTTP は `8000`、WebSocket (`server-websocket.js`) は有効時に
  `8080` を使用します。
- **スケーリングモデル**: HTTP サーバーはステートレス。セッション状態は `data/`
  配下の JSON ストアに保存されるため、クラスター構成時は共有ストレージまたはボリュームを利用します。

## 3. 主な環境変数

| 変数                            | 役割                              | 推奨設定                                                                             |
| ------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| `PORT`                          | 待受ポート                        | `k8s/service.yaml` と一致させる。                                                    |
| `HOST`                          | バインドアドレス                  | コンテナ内部では `0.0.0.0` を推奨。                                                  |
| `ALLOWED_HOSTS`                 | Host ヘッダー許可リスト           | Ingress のホスト名に限定。ワイルドカード (`.example.com`) に対応。                   |
| `TRUST_PROXY`                   | `X-Forwarded-*` を信頼            | プロキシ配下では `true`。                                                            |
| `STATIC_ROOT`                   | 静的アセットの基準ディレクトリ    | 既定値は `.`。CDN 管理アセットをマウントする場合に変更。                             |
| `LIGHTWEIGHT`                   | 軽量モード切替                    | リソース制約環境で `true`。                                                          |
| `BILLING_ADMIN_TOKEN`           | 課金管理 API トークン             | 16 文字以上。四半期ごとにローテーション。                                            |
| `STRIPE_*` キー                 | Checkout 認証情報                 | シークレットマネージャーで保管。リポジトリに含めない。                               |
| `DEFAULT_BILLING_LOCALE`        | 価格情報のフォールバック          | `config/pricing.js` のロケールに対応。                                               |
| `LOG_LEVEL`                     | 将来のログ粒度                    | 集中ログ基盤と統合する計画を立案。                                                   |
| `HEALTH_*`                      | ヘルスモニタの閾値                | ハードウェア基準に合わせて調整。                                                     |
| `NOTIFICATION_ENABLED`          | Webhook ベースの通知を有効化      | まずステージングでペイロードを確認。                                                 |
| `NOTIFICATION_WEBHOOKS`         | 通知先 Webhook URL (カンマ区切り) | `NOTIFICATION_ENABLED=true` の場合は絶対パスの HTTPS URL が必須。空欄で通知無効化。  |
| `NOTIFICATION_MIN_LEVEL`        | 通知を送る最小レベル              | 既定値 `warning`。ノイズ削減なら `error`。                                           |
| `NOTIFICATION_TIMEOUT_MS`       | Webhook POST のタイムアウト       | 100 以上の整数。遅いエンドポイントでは増加させるがリクエストタイムアウト未満に設定。 |
| `NOTIFICATION_BATCH_WINDOW_MS`  | バッチ送信ウィンドウ (ms)         | 0 以上の整数。0 以外で通知をまとめて送信しノイズ抑制。                               |
| `NOTIFICATION_RETRY_LIMIT`      | 送信リトライ回数                  | 0〜10 の整数。既定値 `3`、無効化する場合は `0`。                                     |
| `NOTIFICATION_RETRY_BACKOFF_MS` | リトライ時の初期バックオフ        | 0 以上の整数。指数バックオフとジッターが適用される。                                 |

> 補足: リリース前に `node ./cli.js billing:diagnostics` と
> `node scripts/check-vulnerabilities.js` を CI で実行することを推奨します。

## 4. デプロイ手順

### Docker Compose

```bash
cp .env.example .env
# 環境変数を調整
npm install
npm run build
# 軽量サーバーを起動
npm start
```

### Kubernetes

1. コンテナイメージをレジストリにプッシュ。
2. `k8s/deployment.yaml` のイメージタグとリソース要求を編集。
3. `kubectl apply -f k8s/` でマニフェストを適用。
4. `kubectl rollout status deployment/qui-browser` でロールアウト完了を確認。
5. `kubectl get svc qui-browser` でサービス到達性を確認。

### ローリングアップデート

- イメージタグ更新:
  `kubectl set image deployment/qui-browser qui-browser=<registry>/qui-browser:<tag>`。
- ヘルス監視: `kubectl get pods` および `kubectl logs -l app=qui-browser`。
- 必要に応じてロールバック: `kubectl rollout undo deployment/qui-browser`。

## 5. 可観測性

- **ヘルスエンドポイント**: `GET /health`
  がステータス・稼働時間・リソース使用率・レート制限カウンターを返します（`server-lightweight.js`
  参照）。監視サービスと連携してください。
- **メトリクスエンドポイント**: `GET /metrics`
  でサーバーとシステムの統計を取得。Prometheus の
  `ServiceMonitor`（`k8s/servicemonitor.yaml`）でスクレイプ可能。
- **ログ**: `logs/`
  に保存。外部ログドライバーやバックアップスクリプトでローテーションを管理。
- **ダッシュボード**: `GET /dashboard` が `utils/performance-dashboard.js`
  を用いて HTML ダッシュボードを生成。

## 6. 定期運用

- **バックアップ**: `scripts/` 配下のツールを利用。
  - `node scripts/list-backups.js`: バックアップ一覧。
  - `node scripts/verify-backup.js --latest`: 最新アーカイブの検証。
  - `node scripts/prune-backups.js --retain 30`: 古いスナップショットの整理。
- **データ整合性**: `node scripts/restore-backup.js --id <timestamp>`
  でステージング環境に復元テスト。
- **セキュリティスキャン**:
  `npm audit`、`npm run security:scan`、`node scripts/check-vulnerabilities.js`
  を各リリースで実行。
- **環境健全性チェック**: 機密情報や Stripe 設定を更新した際は
  `npm run check:env` または `node cli.js env:check` を実施。
- **性能確認**: `node scripts/benchmark.js --full`
  で CPU とメモリのベースラインを記録。

## 7. インシデント対応手順

1. `/health` のステータスが `healthy` 以外になった場合に検知。
2. 問題のある Pod を切り離し (`kubectl cordon <node>` など) 、必要に応じてレプリカ数を調整。
3. `logs/` と Kubernetes イベント (`kubectl describe pod`) を収集。
4. `backups/` からの復旧、ロールバック、リソース追加などで問題を是正。
5. 関係者へ状況を共有し、`docs/improvement-backlog.md` にフォローアップを追記。

## 8. ハードニングチェックリスト

- Ingress で HTTPS を強制し、`config/security` オプションから HSTS を設定。
- `CORS_ALLOWED_ORIGINS` でオリジンを制限。
- `RATE_LIMIT_MAX` と `RATE_LIMIT_WINDOW` を 1 以上の整数で設定し、レート制限を適用。
- Prometheus アラートを CPU > 70%, メモリ > 80%, レート制限スパイクで設定。
- GitOps パイプラインで `npm run build` と全テストを実行してからデプロイ。

## 9. トラブルシューティング

| 症状 | 調査ポイント | 対処策 |
| --- | --- | --- |
| 400 Host ヘッダー拒否 | `ALLOWED_HOSTS` の設定確認 | Ingress ホストまたはワイルドカードを追加。 |
| 503 ヘルス低下 | `/health` レスポンスを確認 | リソース増強または `HEALTH_*` の閾値調整。 |
| Stripe 決済失敗 | `cli.js billing:diagnostics` 実行 | 認証情報やプレースホルダーを修正し再デプロイ。 |
| 静的ファイルが取得できない | `STATIC_ROOT` と `serveStaticFile` のログを確認 | アセット同期またはボリューム設定を見直し。 |
| 過度なレート制限 | `/metrics` の rateLimiting カウンター確認 | `RATE_LIMIT_MAX` 増加や CDN キャッシュ導入を検討。 |

## 10. 変更管理

- 本番変更は内部の変更ログに記録し、`docs/improvement-backlog.md` の Tracking
  ID を参照。
- Kubernetes の `maxUnavailable=0`, `maxSurge=1`
  を用いたブルー/グリーンまたはカナリアリリースを推奨。
- リリース後はメトリクススナップショットをアーカイブし、リリースノートに添付。

本ガイドを Qui
Browser の主要ランブックとして維持してください。設定やインフラ変更に合わせて随時更新し、運用チーム全体で最新情報を共有します。
