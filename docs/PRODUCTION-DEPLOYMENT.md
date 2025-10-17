# Production Deployment Guide

Complete guide for deploying Qui Browser to production with all enterprise features enabled.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Methods](#deployment-methods)
4. [Configuration](#configuration)
5. [Monitoring & Observability](#monitoring--observability)
6. [Security Hardening](#security-hardening)
7. [Troubleshooting](#troubleshooting)

## Overview

Qui Browser production server includes:

- ✅ **DDoS Protection** - Multi-layered request filtering
- ✅ **Input Validation** - Government-grade security
- ✅ **Audit Logging** - Tamper-evident logs with HMAC
- ✅ **Circuit Breaker** - Automatic failure recovery
- ✅ **Session Management** - Cryptographic session handling
- ✅ **Advanced Caching** - Multi-tier intelligent caching
- ✅ **Request Deduplication** - Prevent duplicate processing
- ✅ **Performance Profiling** - Built-in metrics and bottleneck detection
- ✅ **Graceful Shutdown** - Zero-downtime deployments
- ✅ **Health Monitoring** - Comprehensive health checks

## Prerequisites

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 1GB
- Disk: 10GB
- Node.js: 18.0.0+
- npm: 9.0.0+

**Recommended:**
- CPU: 4+ cores
- RAM: 4GB+
- Disk: 50GB+ SSD
- Node.js: 20.0.0+
- npm: 10.0.0+

### Software Requirements

```bash
# Node.js and npm
node --version  # >= 18.0.0
npm --version   # >= 9.0.0

# PM2 (for production process management)
npm install -g pm2

# Docker (optional)
docker --version
docker-compose --version
```

## Deployment Methods

### Method 1: PM2 Process Manager (Recommended)

PM2 provides production-grade process management with clustering, monitoring, and zero-downtime deployments.

#### Installation

```bash
# Install PM2 globally
npm install -g pm2

# Install project dependencies
npm install
```

#### Configuration

The project includes `ecosystem.config.js` with pre-configured settings:

```javascript
{
  name: 'qui-browser-production',
  script: './server-production.js',
  instances: 'max',  // Use all CPU cores
  exec_mode: 'cluster',
  env: {
    NODE_ENV: 'production',
    PORT: 8000,
    ENABLE_PROFILING: 'true',
    ENABLE_AUDIT_LOG: 'true',
  }
}
```

#### Start Server

```bash
# Start with PM2
npm run pm2:start

# Or directly
pm2 start ecosystem.config.js --env production

# Check status
pm2 status
pm2 monit

# View logs
pm2 logs
```

#### Management Commands

```bash
# Restart (graceful)
npm run pm2:reload

# Stop
npm run pm2:stop

# Delete
npm run pm2:delete

# Monitoring
npm run pm2:monit

# Save configuration for auto-restart on reboot
pm2 save
pm2 startup
```

### Method 2: Docker Compose (Recommended for Complex Setups)

Docker Compose provides containerized deployment with Redis, Prometheus, and Grafana.

#### Build and Start

```bash
# Build images
npm run docker:build

# Start all services
npm run docker:up

# View logs
npm run docker:logs

# Check status
npm run docker:ps

# Stop all services
npm run docker:down
```

#### Services Included

- **qui-browser** - Main application (3 replicas)
- **redis** - Session and cache storage
- **nginx** - Load balancer and reverse proxy
- **prometheus** - Metrics collection
- **grafana** - Metrics visualization (http://localhost:3000)

#### Access Points

- **Application**: http://localhost:8000
- **Health Check**: http://localhost:8000/health
- **Metrics**: http://localhost:8000/metrics
- **Performance**: http://localhost:8000/performance
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090

### Method 3: Direct Node.js (Development/Testing)

```bash
# Production mode
npm run start:production

# With custom port
PORT=9000 npm run start:production

# With HTTPS
ENABLE_HTTPS=true TLS_CERT_PATH=./certs/cert.pem TLS_KEY_PATH=./certs/key.pem npm run start:production
```

### Method 4: Systemd Service (Linux)

Create systemd service file `/etc/systemd/system/qui-browser.service`:

```ini
[Unit]
Description=Qui Browser Production Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/qui-browser
ExecStart=/usr/bin/node server-production.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=qui-browser

Environment=NODE_ENV=production
Environment=PORT=8000
Environment=ENABLE_PROFILING=true
Environment=ENABLE_AUDIT_LOG=true

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable qui-browser
sudo systemctl start qui-browser
sudo systemctl status qui-browser
```

## Configuration

### Environment Variables

Create `.env` file in project root:

```bash
# Server Configuration
NODE_ENV=production
PORT=8000
HOST=0.0.0.0

# HTTPS (Optional)
ENABLE_HTTPS=false
TLS_CERT_PATH=./certs/cert.pem
TLS_KEY_PATH=./certs/key.pem

# Features
ENABLE_PROFILING=true
ENABLE_AUDIT_LOG=true

# Session Management
SESSION_TIMEOUT=3600000  # 1 hour in milliseconds

# Caching
CACHE_MAX_SIZE=10000
CACHE_TTL=300000  # 5 minutes

# Security
AUDIT_SIGNATURE_KEY=your-secret-key-here-change-in-production
```

### Security Configuration

**Critical: Change default secrets!**

```bash
# Generate secure audit signature key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update .env
AUDIT_SIGNATURE_KEY=<generated-key>
```

### TLS/SSL Configuration

For HTTPS support:

1. **Generate self-signed certificate (development):**

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes
```

2. **Use Let's Encrypt (production):**

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Update .env
ENABLE_HTTPS=true
TLS_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

## Monitoring & Observability

### Health Checks

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-11T12:00:00.000Z",
  "uptime": 3600,
  "system": {
    "memory": { "used": 123456789, "total": 1073741824 },
    "cpu": { "usage": 25.5 },
    "eventLoop": { "lag": 2.3 }
  },
  "dependencies": {
    "filesystem": true,
    "cache": true
  }
}
```

### Metrics Endpoint

**Endpoint:** `GET /metrics`

**Response:**
```json
{
  "cache": {
    "hits": 1000,
    "misses": 100,
    "hitRate": 0.909,
    "size": 500,
    "maxSize": 10000
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
    "heapTotal": 256000000
  }
}
```

### Performance Profiling

**Endpoint:** `GET /performance`

Enabled with `ENABLE_PROFILING=true`

**Response:**
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
      "count": 50
    }
  ],
  "memory": {
    "heapUsed": { "current": 123456789, "min": 100000000, "max": 150000000 }
  }
}
```

### Prometheus Integration

Prometheus scrapes `/metrics` endpoint every 15 seconds.

**Configuration:** `config/prometheus.yml`

**Access:** http://localhost:9090

### Grafana Dashboards

Pre-configured dashboards for:
- Request latency and throughput
- Cache hit rates
- Session statistics
- Memory and CPU usage
- Error rates

**Access:** http://localhost:3000 (admin/admin)

### Audit Logs

Tamper-evident logs with HMAC signatures.

**Location:** `./logs/audit/`

**Format:** JSON Lines with cryptographic signatures

**Example:**
```json
{"timestamp":"2025-10-11T12:00:00.000Z","sequence":1,"type":"system","userId":null,"action":"server_started","metadata":{"port":8000},"signature":"abc123..."}
```

**Verify integrity:**
```bash
node -e "const { AuditLogger } = require('./utils/audit-logger'); const logger = new AuditLogger(); logger.verifyIntegrity('./logs/audit/audit-2025-10-11.log').then(console.log);"
```

## Security Hardening

### Checklist

- [ ] **Change default secrets** in `.env`
- [ ] **Enable HTTPS** with valid TLS certificates
- [ ] **Configure firewall** to allow only necessary ports
- [ ] **Set up DDoS protection** at network level (Cloudflare, AWS Shield)
- [ ] **Enable audit logging** and monitor for suspicious activity
- [ ] **Regular security updates** - `npm audit fix`
- [ ] **Implement rate limiting** at load balancer level
- [ ] **Use read-only containers** (Docker `read_only: true`)
- [ ] **Run as non-root user** (Docker `USER node`)
- [ ] **Scan for vulnerabilities** - `npm run security:scan`

### Network Security

**Firewall (UFW):**
```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow application port (if needed)
sudo ufw allow 8000/tcp

# Enable firewall
sudo ufw enable
```

**Nginx Reverse Proxy:**

```nginx
upstream qui_browser {
    least_conn;
    server 127.0.0.1:8000;
    server 127.0.0.1:8001;
    server 127.0.0.1:8002;
}

server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://qui_browser;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
}
```

### Application Security

Built-in security features:

1. **Input Validation**
   - SQL injection prevention
   - XSS protection
   - Path traversal prevention
   - Command injection protection

2. **DDoS Protection**
   - Rate limiting per IP
   - Connection limits
   - Pattern detection
   - Automatic blacklisting

3. **Session Security**
   - HMAC-SHA256 signatures
   - Tamper detection
   - Automatic expiration
   - Secure session IDs (crypto.randomBytes)

4. **Security Headers**
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Strict-Transport-Security
   - Content-Security-Policy

## Troubleshooting

### Common Issues

#### Server won't start

**Check logs:**
```bash
# PM2
pm2 logs

# Docker
docker logs qui-browser-production

# Systemd
journalctl -u qui-browser -f
```

**Common causes:**
- Port already in use
- Missing dependencies
- Invalid configuration
- Permission issues

#### High Memory Usage

**Check memory:**
```bash
# PM2
pm2 monit

# Docker
docker stats

# System
free -h
htop
```

**Solutions:**
- Reduce `CACHE_MAX_SIZE`
- Lower `max_memory_restart` in PM2
- Increase container memory limits
- Check for memory leaks in profiling endpoint

#### High CPU Usage

**Check CPU:**
```bash
# PM2 monitoring
pm2 monit

# Performance profiling
curl http://localhost:8000/performance | jq '.bottlenecks'
```

**Solutions:**
- Scale horizontally (add more instances)
- Optimize bottlenecks identified in profiling
- Enable caching more aggressively
- Use request deduplication

#### Audit Log Integrity Failed

**Verify logs:**
```bash
node -e "const { AuditLogger } = require('./utils/audit-logger'); const logger = new AuditLogger(); logger.verifyIntegrity('./logs/audit/audit-2025-10-11.log').then(r => console.log(r.valid ? 'VALID' : 'TAMPERED'));"
```

**Causes:**
- Log file tampered
- Wrong signature key
- Corrupted file

**Recovery:**
- Restore from backup
- Investigate security breach
- Update signature key

### Debug Mode

Enable debug logging:

```bash
# Set debug environment
DEBUG=* npm run start:production

# Or specific modules
DEBUG=qui:* npm run start:production
```

### Performance Testing

**Load test:**
```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Run load test
ab -n 10000 -c 100 http://localhost:8000/

# Monitor performance
curl http://localhost:8000/performance | jq '.bottlenecks'
```

## Backup & Recovery

### Backup Strategy

**What to backup:**
- Audit logs (`./logs/audit/`)
- Session data (if persisted)
- Configuration files (`.env`, `ecosystem.config.js`)
- TLS certificates

**Automated backup script:**
```bash
#!/bin/bash
BACKUP_DIR="/backup/qui-browser"
DATE=$(date +%Y-%m-%d)

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

# Backup logs
tar -czf "$BACKUP_DIR/$DATE/logs.tar.gz" ./logs/

# Backup data
tar -czf "$BACKUP_DIR/$DATE/data.tar.gz" ./data/

# Backup config
cp .env "$BACKUP_DIR/$DATE/"
cp ecosystem.config.js "$BACKUP_DIR/$DATE/"

# Keep only last 30 days
find "$BACKUP_DIR" -type d -mtime +30 -exec rm -rf {} +

echo "Backup completed: $BACKUP_DIR/$DATE"
```

**Schedule with cron:**
```bash
# Daily backup at 3 AM
0 3 * * * /path/to/backup-script.sh
```

### Disaster Recovery

**Full recovery procedure:**

1. **Stop services**
```bash
pm2 stop all
# or
docker-compose down
```

2. **Restore backup**
```bash
cd /var/www/qui-browser
tar -xzf /backup/qui-browser/2025-10-11/logs.tar.gz
tar -xzf /backup/qui-browser/2025-10-11/data.tar.gz
cp /backup/qui-browser/2025-10-11/.env .
```

3. **Verify configuration**
```bash
npm run check:env
```

4. **Start services**
```bash
pm2 start ecosystem.config.js
# or
docker-compose up -d
```

5. **Verify health**
```bash
curl http://localhost:8000/health
```

## Scaling

### Horizontal Scaling (PM2)

```javascript
// ecosystem.config.js
{
  instances: 'max',  // Use all CPU cores
  exec_mode: 'cluster',
}
```

### Horizontal Scaling (Docker)

```yaml
# docker-compose.production.yml
deploy:
  replicas: 6  # Increase replicas
```

### Load Balancing

Use Nginx, HAProxy, or cloud load balancers to distribute traffic across multiple instances.

## Maintenance

### Regular Tasks

**Daily:**
- Check health endpoint
- Review audit logs for suspicious activity
- Monitor metrics in Grafana

**Weekly:**
- Review performance bottlenecks
- Check disk space
- Rotate logs

**Monthly:**
- Update dependencies (`npm update`)
- Security audit (`npm audit`)
- Review and optimize cache strategy
- Backup verification

### Updates

**Zero-downtime deployment with PM2:**
```bash
git pull
npm install
npm run build
pm2 reload ecosystem.config.js  # Graceful reload
```

**Zero-downtime deployment with Docker:**
```bash
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d --no-deps --build qui-browser
```

## Support

### Getting Help

1. Check this documentation
2. Review audit logs for errors
3. Check performance endpoint for bottlenecks
4. Review GitHub issues
5. Contact support team

### Reporting Issues

Include:
- Node.js version
- Deployment method (PM2/Docker/systemd)
- Error logs
- Health check output
- Performance metrics
- Audit log entries (if relevant)

---

**Version:** 1.2.0
**Last Updated:** 2025-10-11
**Status:** ✅ Production Ready
