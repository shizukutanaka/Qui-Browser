# <LANGUAGE> Qui Browser Security Template

## Threat Model

- Outline server surface (`server-lightweight.js`) and critical data stores.
- Mention VR client traffic and Stripe webhook flows.

## Hardening Checklist

- TLS termination guidance.
- Host header and CORS restrictions via environment variables.
- Rate limiting and static file sanitisation references.
- Compression policy for safe mime types.

## Stripe Key Management

- Storage recommendations (secrets manager, rotation cadence).
- Webhook signature verification best practices.

## Incident Response

1. Immediate containment steps.
2. Log and Stripe event analysis.
3. Data recovery flow.
4. Post-incident communication.

## Compliance Notes

- Local privacy laws and retention.
- CI security scans (`npm run security:scan`).
