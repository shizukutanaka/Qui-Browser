# Qui Browser Operations Guide (English)

## Audience

Operations and SRE teams responsible for deploying and maintaining Qui Browser
in production VR environments.

## 1. Pre-deployment checklist

- **Container image**: Build with
  `docker build -t <registry>/qui-browser:<tag> .` and scan with
  `npm run security:scan`.
- **Environment file**: Clone `.env.example`, remove placeholder values
  (`your_*`, `changeme`) and store secrets in a vault.
- **Environment validation**: Run `npm run check:env` or `node cli.js env:check`
  to ensure all required keys and HTTPS URLs are configured before deployment.
- **TLS assets**: Prepare certificates for ingress or reverse proxies; see
  `k8s/ingress.yaml` for annotations.
- **Billing configuration**: Verify Stripe keys and URLs with
  `node ./cli.js billing:diagnostics`.
- **Static assets**: Run `npm run format:check` to ensure precompressed assets
  stay in sync.

## 2. Runtime expectations

- **Process entrypoint**: `server-lightweight.js` via `npm start` or
  `node ./cli.js start --port 8000`.
- **Default ports**: HTTP `8000`, WebSocket `server-websocket.js` uses `8080`
  when enabled.
- **Scaling model**: Stateless HTTP; session state lives in `data/` JSON stores.
  Use shared storage or volume claims in clustered deployments.

## 3. Environment variables

| Variable                        | Purpose                         | Recommendation                                                                              |
| ------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| `PORT`                          | Listening port                  | Match service spec (`k8s/service.yaml`).                                                    |
| `HOST`                          | Bind address                    | Use `0.0.0.0` inside containers.                                                            |
| `ALLOWED_HOSTS`                 | Host header allow-list          | Restrict to ingress hostnames; supports wildcards (`.example.com`).                         |
| `TRUST_PROXY`                   | Respect `X-Forwarded-*` headers | Enable (`true`) when behind a proxy.                                                        |
| `STATIC_ROOT`                   | Static asset base directory     | Default `.`; mount CDN-managed assets if needed.                                            |
| `LIGHTWEIGHT`                   | Toggle minimal mode             | Set `true` for constrained hardware.                                                        |
| `BILLING_ADMIN_TOKEN`           | Admin API token                 | Minimum 16 characters; rotate quarterly.                                                    |
| `STRIPE_*` keys                 | Checkout credentials            | Store in secret manager; never commit.                                                      |
| `DEFAULT_BILLING_LOCALE`        | Pricing fallback                | Matches `config/pricing.js` locales.                                                        |
| `LOG_LEVEL`                     | Future logging granularity      | Plan for integration with centralized logging.                                              |
| `HEALTH_*`                      | Health monitor thresholds       | Tune for hardware-specific baselines.                                                       |
| `NOTIFICATION_ENABLED`          | Toggle webhook-based alerts     | Enable in staging first to verify payloads.                                                 |
| `NOTIFICATION_WEBHOOKS`         | Comma-separated webhook URLs    | Must be absolute HTTPS endpoints when `NOTIFICATION_ENABLED=true`; blank disables dispatch. |
| `NOTIFICATION_MIN_LEVEL`        | Minimum severity to dispatch    | Default `warning`; raise to `error` for reduced noise.                                      |
| `NOTIFICATION_TIMEOUT_MS`       | Webhook POST timeout            | Integer ≥ 100; increase for slow endpoints but keep < request timeout.                      |
| `NOTIFICATION_BATCH_WINDOW_MS`  | Batch window (ms)               | Integer ≥ 0; >0 groups health changes to reduce chatter.                                    |
| `NOTIFICATION_RETRY_LIMIT`      | Automatic retry attempts        | Integer 0-10; default `3`, set `0` to disable retries.                                      |
| `NOTIFICATION_RETRY_BACKOFF_MS` | Initial retry backoff           | Integer ≥ 0; exponential backoff with jitter.                                               |

> Tip: run `node ./cli.js billing:diagnostics` and
> `node scripts/check-vulnerabilities.js` in CI before shipping.

## 4. Deployment workflows

### Docker Compose

```bash
cp .env.example .env
# Adjust environment variables
npm install
npm run build
# Launch lightweight server
npm start
```

### Kubernetes

1. Push the container image to your registry.
2. Edit `k8s/deployment.yaml` image tags and resource requests.
3. Apply manifests: `kubectl apply -f k8s/`.
4. Verify rollout: `kubectl rollout status deployment/qui-browser`.
5. Confirm service reachability: `kubectl get svc qui-browser`.

### Rolling updates

- Update image tag:
  `kubectl set image deployment/qui-browser qui-browser=<registry>/qui-browser:<tag>`.
- Monitor health: `kubectl get pods` and `kubectl logs -l app=qui-browser`.
- Rollback if needed: `kubectl rollout undo deployment/qui-browser`.

## 5. Observability

- **Health endpoint**: `GET /health` returns status, uptime, resource
  utilization, and rate-limit counters (`server-lightweight.js`). Integrate with
  uptime checks.
- **Metrics endpoint**: `GET /metrics` provides aggregated server/system metrics
  for dashboards; scrape via Prometheus `ServiceMonitor`
  (`k8s/servicemonitor.yaml`).
- **Logs**: Stored in `logs/`. Rotate using external log driver or the backup
  scripts below.
- **Dashboard**: `GET /dashboard` renders an Atlassian-style performance
  snapshot with health, cache efficiency, and alert banners.
- **Notification telemetry**: `node ./cli.js inspector notification-stats` (or
  the admin `/api/stats`) surfaces `getNotificationStats()` counters
  (`dispatched`, `failed`, `lastDispatchAt`) for webhook health checks.

## 6. Routine maintenance

- **Backups**: Use scripts in `scripts/`.
  - List backups: `node scripts/list-backups.js`.
  - Verify latest archive: `node scripts/verify-backup.js --latest`.
  - Prune old snapshots: `node scripts/prune-backups.js --retain 30`.
- **Data integrity**: `node scripts/restore-backup.js --id <timestamp>` to test
  restore in staging.
- **Security scans**: `npm audit`, `npm run security:scan`, and
  `node scripts/check-vulnerabilities.js` each release.
- **Environment sanity**: `npm run check:env` or `node cli.js env:check`
  whenever secrets or Stripe configuration change.
- **Performance sanity**: `node scripts/benchmark.js --full` to baseline CPU and
  memory.

## 7. Incident response

1. **Identify** via health degradation or alert on `/health` status ≠ `healthy`.
2. **Isolate** suspect pods: `kubectl cordon <node>` or scale down replicas.
3. **Collect** logs from `logs/` and Kubernetes events (`kubectl describe pod`).
4. **Remediate** by rolling back, restoring from `backups/`, or increasing resources as needed.
5. **Communicate** status and update `docs/improvement-backlog.md` with follow-up items.

## 8. Hardening checklist

- Enforce HTTPS at ingress; set HSTS via `config/security` options.
- Limit origins with `CORS_ALLOWED_ORIGINS`.
- Enable rate limiting defaults (`RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW` must
  be set to integers ≥ 1).
- Configure Prometheus alerts for CPU > 70%, memory > 80%, rate-limit spikes.
- Ensure GitOps pipeline runs `npm run build` and all tests before deploy.

## 9. Troubleshooting reference

| Symptom | Investigation | Resolution |
| --- | --- | --- |
| 400 Host header rejection | Check `ALLOWED_HOSTS` value | Add ingress host or wildcard. |
| 503 Health degraded | Inspect `/health` response fields | Scale resources or tune `HEALTH_*` thresholds. |
| Stripe checkout failures | Run `cli.js billing:diagnostics` | Fix credentials or placeholders, redeploy. |
| Static files missing | Validate `STATIC_ROOT`, check `serveStaticFile` logs | Sync assets or adjust volume mounts. |
| High rate limiting | View `/metrics` rateLimiting block counters | Increase `RATE_LIMIT_MAX` or add CDN cache. |

## 10. Change management

- Document production changes in internal change log referencing `Tracking ID`
  from `docs/improvement-backlog.md`.
- Schedule blue/green or canary rollouts using Kubernetes `maxUnavailable=0`,
  `maxSurge=1`.
- After each release, archive metrics snapshots and attach to release notes.

Maintain this guide as the primary runbook for Qui Browser operations. Update
alongside configuration or infrastructure changes to keep SRE teams aligned.
