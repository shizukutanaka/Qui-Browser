# Security Baseline (English)

## Threat Model

- **Server surface**: Node.js HTTP entrypoint `server-lightweight.js` with REST
  APIs and static delivery.
- **Data at rest**: Extension metadata (`data/extensions.json`), session state,
  subscription ledger (`data/subscriptions.json`).
- **Data in transit**: VR browser requests, Stripe webhook callbacks.

## Hardening Checklist

- **TLS termination**: Place the server behind HTTPS (reverse proxy or managed
  load balancer).
- **Host validation**: `validateHostHeader()` ensures trusted domains; configure
  `ALLOWED_HOSTS` in `.env`.
- **CORS**: `parseAllowedOrigins()` enforces whitelisted origins. Keep
  `ALLOWED_ORIGINS` narrow.
- **Rate limiting**: Sliding window in `checkRateLimit()` throttles abusive
  clients.
- **Static delivery**: `serveStaticFile()` implements path sanitisation and
  symbolic-link checks.
- **Compression safety**: `utils/compression.js` restricts compressible MIME
  types to mitigate BREACH-style attacks.

## Stripe Secrets Handling

- Store keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) in a secrets
  manager.
- Rotate secrets regularly and update CI/CD variables before deployment.
- Consume webhooks over HTTPS only and monitor signature verification failures.

## Incident Response

1. Disable ingress or revoke API keys if compromise is suspected.
2. Inspect server logs located in `logs/` and Stripe dashboard events.
3. Restore from latest backup in `backups/` if data integrity is affected.
4. Patch, retest (`npm test`), redeploy, and notify stakeholders.

## Compliance Guidance

- Maintain GDPR/CCPA consent logs for telemetry features (if enabled).
- Document data retention for VR browsing history and subscriptions.
- Run `npm run security:scan` in CI on every merge.
