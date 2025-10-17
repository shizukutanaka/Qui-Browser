# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :x:                |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to security@qui-browser.example.com
(replace with actual email).

You should receive a response within 48 hours. If for some reason you do not,
please follow up via email to ensure we received your original message.

Please include the following information in your report:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting,
  etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

This information will help us triage your report more quickly.

## Security Update Process

1. Security reports are received and assigned a primary handler
2. The problem is confirmed and a list of affected versions is determined
3. Code is audited to find any potential similar problems
4. Fixes are prepared for all supported releases
5. Fixes are released as soon as possible

## Security Best Practices

When deploying Qui Browser, please follow these security best practices:

### Environment Configuration

- **Never commit `.env` files** - Use `.env.example` as a template
- **Use strong secrets** - Generate random tokens for `BILLING_ADMIN_TOKEN` (16+
  characters)
- **Enable HTTPS** - Always use TLS in production environments
- **Configure CSP** - Use strict Content Security Policy headers
- **Set allowed origins** - Restrict CORS to trusted domains only

### Network Security

- **Firewall configuration** - Restrict access to necessary ports only
- **Rate limiting** - Configure `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW`
  appropriately
- **DDoS protection** - Use a reverse proxy (nginx, Caddy) or CDN
- **Network isolation** - Deploy in private networks when possible

### Monitoring & Logging

- **Enable health checks** - Monitor `/health` and `/api/stats` endpoints
- **Log sanitization** - Ensure `LOG_SANITIZED_HEADERS=true` in production
- **Audit logs** - Regularly review logs for suspicious activity
- **Alerting** - Configure `NOTIFICATION_WEBHOOKS` for critical events

### Dependency Management

- **Regular updates** - Run `npm audit` and `npm outdated` weekly
- **Automated scanning** - Enable Dependabot and GitHub security alerts
- **Review dependencies** - Audit new dependencies before adding them
- **Lock files** - Always commit `package-lock.json`

### Container Security

- **Image scanning** - Use Trivy or similar tools to scan Docker images
- **Non-root user** - Run containers as non-root (already configured)
- **Minimal base images** - Use Alpine Linux or distroless images
- **Image signing** - Sign and verify container images in production

### Kubernetes Security

- **RBAC** - Use Role-Based Access Control for cluster access
- **Network policies** - Isolate pods with network policies
- **Secrets management** - Use Kubernetes secrets or external vaults
- **Resource limits** - Set CPU/memory limits in deployment.yaml
- **Pod Security Policies** - Enforce security standards for pods

## Known Security Features

Qui Browser includes the following built-in security features:

### HTTP Security Headers

- **CSP**: Content Security Policy to prevent XSS attacks
- **HSTS**: HTTP Strict Transport Security for HTTPS enforcement
- **X-Frame-Options**: Prevent clickjacking attacks
- **X-Content-Type-Options**: Prevent MIME type sniffing
- **Referrer-Policy**: Control referrer information

### Request Validation

- **URI length limits**: Prevent buffer overflow attacks (max 2048 bytes)
- **NULL byte injection protection**: Block path traversal attempts
- **CRLF injection protection**: Prevent header injection
- **Method validation**: Only allow GET, HEAD, OPTIONS

### Rate Limiting

- **Token bucket algorithm**: Prevent DoS attacks
- **Per-IP limiting**: Configurable via `RATE_LIMIT_MAX`
- **Automatic cleanup**: Prevent memory exhaustion

### Input Sanitization

- **Path normalization**: Prevent directory traversal
- **Header validation**: Block malicious headers
- **Query parameter filtering**: Remove sensitive data from logs

## Disclosure Policy

When we receive a security report, we will:

1. Confirm the vulnerability and determine affected versions
2. Prepare fixes and release them as soon as possible
3. Credit the reporter (unless they wish to remain anonymous)
4. Publish a security advisory on GitHub
5. Update this SECURITY.md file with mitigation details

## Security Hall of Fame

We appreciate the work of security researchers who help keep Qui Browser safe:

<!-- Add researchers who responsibly disclose vulnerabilities -->

## Contact

For security concerns, contact: security@qui-browser.example.com

For general questions, use: https://github.com/qui-browser/qui-browser/issues

---

**Last updated**: 2025-10-10
