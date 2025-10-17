# セキュリティ基準 (日本語)

## 想定する脅威

- **サーバー攻撃面**: `server-lightweight.js` で公開する HTTP API と静的配信。
- **保存データ**: 拡張機能メタデータ (`data/extensions.json`)、セッション情報、サブスクリプション台帳 (`data/subscriptions.json`)。
- **通信データ**: VR ブラウザからのアクセス、Stripe Webhook コールバック。

## ハードニングチェックリスト

- **TLS 終端**: HTTPS 化されたリバースプロキシやロードバランサーの背後で稼働。
- **ホスト検証**: `validateHostHeader()` により許可ドメインを限定。`.env` の
  `ALLOWED_HOSTS` を明示。
- **CORS 制御**: `parseAllowedOrigins()` で許可オリジンをホワイトリスト方式に。
- **レート制限**: `checkRateLimit()` でスライディングウィンドウ制御。
- **静的配信保護**: `serveStaticFile()`
  でパス正規化・シンボリックリンク検証を実施。
- **圧縮安全性**: `utils/compression.js`
  が限定 MIME タイプのみ圧縮し BREACH などを抑制。

## Stripe シークレット管理

- `STRIPE_SECRET_KEY` と `STRIPE_WEBHOOK_SECRET` は秘密管理サービスで保管。
- 定期的に鍵をローテーションし、CI/CD 変数を更新。
- Webhook は HTTPS を必須とし、署名検証失敗を監視。

## 課金設定の検証強化

- `collectBillingConfigurationIssues()` により
  `BILLING_ADMIN_TOKEN`、Stripe鍵、成功/キャンセルURLを起動時に検証。
- HTTPS 以外の `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL`、空の鍵、`your_`
  などのプレースホルダー値は本番環境でエラーとして扱われる。
- `BILLING_ENFORCE_CONFIG=true`
  を指定すると、非本番でも検証失敗時にサーバー起動を停止。
- 既知の不足ロケール (価格ID未設定) は開発環境では警告、本番環境ではエラーとして集約ログに記録。

## インシデント対応

1. 侵害兆候があればトラフィック遮断または API キー失効。
2. `logs/` 内のサーバーログと Stripe ダッシュボードのイベントを精査。
3. 必要に応じて `backups/` から復旧し、`npm test` で再検証。
4. 修正・再展開後、関係者へ報告し事後分析を記録。

## コンプライアンス指針

- VR ブラウジング履歴やサブスク情報の保持期間を明文化。
- GDPR / CCPA など各種プライバシー法に沿った同意ログ管理。
- すべてのマージ時に `npm run security:scan` を実行し記録。
