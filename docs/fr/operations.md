# Qui Browser Operations Guide Template

## Audience / 想定読者

Describe the primary teams (operations, SRE, support) who will use this guide.
Keep the description in target language plus English if possible.

## 1. Pre-deployment Checklist / デプロイ前チェック

- **Container image**: `docker build -t <registry>/qui-browser:<tag> .` →
  `npm run security:scan`
- **Environment file**: Copy `.env.example`, remove placeholders (`your_*`,
  `changeme`), store secrets securely.
- **TLS assets**: Provide instructions to prepare certificates for
  ingress/reverse proxy; reference `k8s/ingress.yaml`.
- **Billing configuration**: Validate Stripe keys/URLs using
  `node ./cli.js billing:diagnostics`.
- **Static assets**: Run `npm run format:check` to keep precompressed files
  aligned.
- Add locale-specific notes as needed.

## 2. Runtime Expectations / 稼働時の前提

- **Process entrypoint**: `npm start` or `node ./cli.js start --port 8000`
  launching `server-lightweight.js`.
- **Default ports**: HTTP `8000`; WebSocket (`server-websocket.js`) `8080` when
  enabled.
- **Scaling model**: Stateless HTTP; session data under `data/`. Mention shared
  storage guidance for clustered deployments.
- Document any locale/regional hosting considerations.

## 3. Environment Variables / 環境変数

Provide a table: | Variable | Purpose | Recommendation | | --- | --- | --- | |
`PORT` | ... | ... | | `HOST` | ... | ... | | `ALLOWED_HOSTS` | ... | ... | |
`TRUST_PROXY` | ... | ... | | `STATIC_ROOT` | ... | ... | | `LIGHTWEIGHT` | ...
| ... | | `BILLING_ADMIN_TOKEN` | ... | ... | | `STRIPE_*` | ... | ... | |
`DEFAULT_BILLING_LOCALE` | ... | ... | | `LOG_LEVEL` | ... | ... | | `HEALTH_*`
| ... | ... | Include region-specific guidance if applicable.

> Tip / 補足: Suggest running `node ./cli.js billing:diagnostics` and
> `node scripts/check-vulnerabilities.js` in CI prior to release.

## 4. Deployment Workflows / デプロイ手順

### Docker Compose

```bash
cp .env.example .env
# Adjust environment variables
npm install
npm run build
npm start
```

Add locale-specific notes (e.g., service account usage).

### Kubernetes

1. Push container image to registry.
2. Update image tag/resources in `k8s/deployment.yaml`.
3. `kubectl apply -f k8s/`.
4. `kubectl rollout status deployment/qui-browser`.
5. `kubectl get svc qui-browser`. Include regional compliance or platform
   differences if needed.

### Rolling Updates / ローリングアップデート

- `kubectl set image deployment/qui-browser qui-browser=<registry>/qui-browser:<tag>`
- Monitor logs/pods; rollback with
  `kubectl rollout undo deployment/qui-browser`.

## 5. Observability / 可観測性

Outline usage of `GET /health`, `GET /metrics`, logs under `logs/`,
`GET /dashboard` for performance dashboard. Provide integration tips
(Prometheus, Grafana, uptime).

## 6. Routine Maintenance / 定期運用

Reference scripts in `scripts/` for backups, verification, pruning. Mention
`node scripts/restore-backup.js --id <timestamp>`, `npm audit`,
`npm run security:scan`, `node scripts/benchmark.js --full`.

## 7. Incident Response / インシデント対応

Provide ordered checklist:

1. Detect (monitor `/health` or alerts).
2. Isolate pods (`kubectl cordon`, scale adjustments).
3. Collect logs/events (`kubectl describe pod`).
4. Restore from `backups/` if data issues.
5. Communicate and log follow-up in `docs/improvement-backlog.md`. Include local
   escalation paths if required.

## 8. Hardening Checklist / ハードニング

List HTTPS enforcement, HSTS, `CORS_ALLOWED_ORIGINS`, rate limiting defaults,
Prometheus alerts thresholds, CI requirements (`npm run build`, tests).

## 9. Troubleshooting Table / トラブルシューティング表

Example format: | Symptom | Investigation | Resolution | | --- | --- | --- | |
400 Host rejection | Check `ALLOWED_HOSTS` | Add ingress host/wildcard | | 503
degraded health | Inspect `/health` | Scale resources or tune `HEALTH_*` | | ...
| ... | ... | Adapt to language/locale.

## 10. Change Management / 変更管理

Describe documentation requirements (tracking IDs from
`docs/improvement-backlog.md`), blue/green or canary strategy with
`maxUnavailable=0`, `maxSurge=1`, archiving metrics snapshots post-release. Add
local compliance instructions.

## Localization Guidance / ローカライズ指針

- Maintain bilingual headings where helpful.
- Keep CLI commands and file paths verbatim.
- Reference localized terminology for operations, monitoring, and compliance.

Use this template as the baseline when creating new locale-specific guides.
Replace the bilingual text with the target language plus English if mandated by
documentation standards.
