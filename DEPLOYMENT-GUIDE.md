# Qui Browser - Production Deployment Guide

**Version:** 1.2.0
**Target Audience:** DevOps Engineers, System Administrators
**Security Level:** Government/Enterprise Grade

## Table of Contents

1. [Pre-Deployment Requirements](#pre-deployment-requirements)
2. [Environment Setup](#environment-setup)
3. [Security Configuration](#security-configuration)
4. [Deployment Methods](#deployment-methods)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedures](#rollback-procedures)

## Pre-Deployment Requirements

### System Requirements

#### Minimum Specifications
- **CPU**: 2 cores (4 recommended)
- **RAM**: 2GB (4GB recommended)
- **Disk**: 10GB available space
- **OS**: Linux (Ubuntu 20.04+, CentOS 8+), Windows Server 2019+, macOS 11+

#### Software Requirements
```bash
Node.js >= 18.0.0
npm >= 9.0.0
Git >= 2.30.0
```

### Network Requirements
- **Inbound**: Port 8000 (configurable)
- **Outbound**: HTTPS (443) for external APIs
- **Internal**: Health check endpoints accessible
- **Firewall**: Configure based on deployment topology

### Security Prerequisites

1. **TLS Certificates**
   ```bash
   # Generate self-signed certificate (development only)
   openssl req -x509 -newkey rsa:4096 -nodes \
     -keyout key.pem -out cert.pem -days 365

   # Production: Use valid certificates from CA
   ```

2. **Secrets Management**
   - Generate strong admin tokens (32+ characters)
   - Rotate API keys before deployment
   - Store secrets in secure vault (HashiCorp Vault, AWS Secrets Manager)

3. **User Permissions**
   ```bash
   # Create dedicated service user
   sudo useradd -r -s /bin/false qui-browser
   sudo usermod -aG qui-browser $USER
   ```

## Environment Setup

### 1. Clone Repository

```bash
# Production deployment
git clone <repository-url> qui-browser-prod
cd qui-browser-prod
git checkout tags/v1.2.0  # Use specific version tag
```

### 2. Install Dependencies

```bash
# Production dependencies only
npm ci --production

# Verify installation
npm list --depth=0
```

### 3. Configure Environment

Create `.env` from template:

```bash
cp .env.example .env
chmod 600 .env  # Restrict permissions
```

#### Essential Configuration

```ini
# Server Configuration
NODE_ENV=production
PORT=8000
HOST=0.0.0.0

# Security (CRITICAL)
ENABLE_SECURITY_HEADERS=true
BILLING_ADMIN_TOKEN=<generate-with-crypto.randomBytes(32).toString('hex')>

# Rate Limiting (Adjust based on load)
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_ENTRIES=10000

# DDoS Protection
DDOS_MAX_CONNECTIONS_PER_IP=100
DDOS_MAX_REQUESTS_PER_SECOND=10
DDOS_BLACKLIST_DURATION=3600000
DDOS_ENABLE_PATTERN_DETECTION=true

# Audit Logging (Compliance)
AUDIT_LOG_DIR=./logs/audit
AUDIT_ENABLE_SIGNATURE=true
AUDIT_MAX_FILE_SIZE=10485760
AUDIT_MAX_FILES=30

# Health Monitoring
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000
HEALTH_MEMORY_THRESHOLD=0.9

# Request Correlation
CORRELATION_HEADER_NAME=X-Correlation-ID
CORRELATION_ID_FORMAT=uuid

# Circuit Breaker
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=2
CIRCUIT_BREAKER_TIMEOUT=60000
```

## Security Configuration

### 1. Firewall Rules

#### Ubuntu/Debian (UFW)
```bash
sudo ufw allow 8000/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw enable
sudo ufw status
```

#### CentOS/RHEL (firewalld)
```bash
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
```

### 2. SELinux Configuration (RHEL/CentOS)

```bash
# Allow Node.js to bind to port 8000
sudo semanage port -a -t http_port_t -p tcp 8000

# Set proper context for application files
sudo chcon -R -t httpd_sys_content_t /opt/qui-browser
```

### 3. File Permissions

```bash
# Set ownership
sudo chown -R qui-browser:qui-browser /opt/qui-browser

# Set permissions
find /opt/qui-browser -type d -exec chmod 755 {} \;
find /opt/qui-browser -type f -exec chmod 644 {} \;
chmod 755 /opt/qui-browser/server-lightweight.js
chmod 600 /opt/qui-browser/.env

# Create log directory
sudo mkdir -p /var/log/qui-browser
sudo chown qui-browser:qui-browser /var/log/qui-browser
sudo chmod 750 /var/log/qui-browser
```

## Deployment Methods

### Method 1: Systemd Service (Recommended for Linux)

#### 1. Create Service File

```bash
sudo nano /etc/systemd/system/qui-browser.service
```

```ini
[Unit]
Description=Qui Browser Production Server
After=network.target
Documentation=https://github.com/qui-browser/qui-browser

[Service]
Type=simple
User=qui-browser
Group=qui-browser
WorkingDirectory=/opt/qui-browser
Environment=NODE_ENV=production
EnvironmentFile=/opt/qui-browser/.env
ExecStart=/usr/bin/node server-lightweight.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/qui-browser/output.log
StandardError=append:/var/log/qui-browser/error.log

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/qui-browser /opt/qui-browser/logs

[Install]
WantedBy=multi-user.target
```

#### 2. Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable qui-browser

# Start service
sudo systemctl start qui-browser

# Check status
sudo systemctl status qui-browser

# View logs
sudo journalctl -u qui-browser -f
```

### Method 2: Docker Deployment

#### 1. Build Image

```bash
# Build production image
npm run docker:build

# Or manually
docker build -t qui-browser:1.2.0 .
```

#### 2. Run Container

```bash
docker run -d \
  --name qui-browser \
  --restart always \
  -p 8000:8000 \
  -e NODE_ENV=production \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/.env:/app/.env:ro \
  --memory="2g" \
  --cpus="2" \
  qui-browser:1.2.0
```

#### 3. Docker Compose

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  qui-browser:
    image: qui-browser:1.2.0
    restart: always
    ports:
      - "8000:8000"
    environment:
      NODE_ENV: production
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./.env:/app/.env:ro
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

```bash
# Deploy with Docker Compose
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Stop
docker-compose -f docker-compose.production.yml down
```

### Method 3: Kubernetes Deployment

#### 1. Create Namespace

```bash
kubectl create namespace qui-browser-prod
```

#### 2. Create Secret

```bash
# Create secret from .env
kubectl create secret generic qui-browser-env \
  --from-env-file=.env \
  -n qui-browser-prod
```

#### 3. Apply Manifests

```bash
# Apply all manifests
kubectl apply -f k8s/ -n qui-browser-prod

# Check deployment
kubectl get all -n qui-browser-prod

# Check logs
kubectl logs -f deployment/qui-browser -n qui-browser-prod
```

### Method 4: PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start server-lightweight.js \
  --name qui-browser \
  --instances 2 \
  --exec-mode cluster \
  --env production

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup

# Monitor
pm2 monit

# View logs
pm2 logs qui-browser
```

## Post-Deployment Verification

### 1. Health Check

```bash
# Basic health check
curl http://localhost:8000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-10-11T...",
  "uptime": 123
}
```

### 2. Metrics Verification

```bash
# Prometheus metrics
curl http://localhost:8000/metrics

# Admin insights (requires admin token)
curl -H "X-Billing-Admin-Token: YOUR_TOKEN" \
  http://localhost:8000/api/admin/insights
```

### 3. Security Headers

```bash
# Check security headers
curl -I http://localhost:8000/

# Should include:
# - X-Content-Type-Options: nosniff
# - X-Frame-Options: DENY
# - X-XSS-Protection: 1; mode=block
# - Content-Security-Policy: ...
# - Strict-Transport-Security: ...
```

### 4. Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Run load test
ab -n 1000 -c 10 http://localhost:8000/health

# Expected: All requests successful
```

### 5. Log Verification

```bash
# Check logs
tail -f /var/log/qui-browser/output.log
tail -f /var/log/qui-browser/error.log

# Check audit logs
tail -f ./logs/audit/audit-*.jsonl
```

## Monitoring & Maintenance

### 1. Prometheus Integration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'qui-browser'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### 2. Log Rotation

```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/qui-browser
```

```
/var/log/qui-browser/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 qui-browser qui-browser
    postrotate
        systemctl reload qui-browser > /dev/null 2>&1 || true
    endscript
}
```

### 3. Automated Backups

```bash
# Create backup script
cat > /opt/qui-browser/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/qui-browser"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup configuration
tar -czf $BACKUP_DIR/config-$DATE.tar.gz .env

# Backup logs
tar -czf $BACKUP_DIR/logs-$DATE.tar.gz logs/

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x /opt/qui-browser/backup.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /opt/qui-browser/backup.sh
```

### 4. Monitoring Dashboard

Access performance dashboard:
```
http://localhost:8000/dashboard
```

### 5. Health Monitoring Script

```bash
#!/bin/bash
# health-monitor.sh

ENDPOINT="http://localhost:8000/health"
ALERT_EMAIL="admin@example.com"

check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" $ENDPOINT)

    if [ "$response" != "200" ]; then
        echo "ALERT: Qui Browser health check failed (HTTP $response)" | \
            mail -s "Qui Browser Alert" $ALERT_EMAIL
    fi
}

check_health
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Find process using port 8000
sudo lsof -i :8000
# or
sudo netstat -tulpn | grep 8000

# Kill process
sudo kill -9 <PID>
```

#### 2. Permission Denied

```bash
# Check file ownership
ls -la /opt/qui-browser

# Fix permissions
sudo chown -R qui-browser:qui-browser /opt/qui-browser
```

#### 3. Module Not Found

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --production
```

#### 4. Memory Issues

```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 server-lightweight.js

# Or in systemd service:
Environment="NODE_OPTIONS=--max-old-space-size=4096"
```

#### 5. High CPU Usage

```bash
# Check process stats
top -p $(pgrep -f qui-browser)

# Enable profiling
node --prof server-lightweight.js

# Analyze profile
node --prof-process isolate-*.log
```

### Log Analysis

```bash
# Search for errors
grep -i error /var/log/qui-browser/*.log

# Count requests
grep "http_requests_total" logs/*.log | wc -l

# Check rate limits
grep "rate_limited" logs/audit/*.jsonl
```

## Rollback Procedures

### 1. Quick Rollback (Systemd)

```bash
# Stop current version
sudo systemctl stop qui-browser

# Restore from backup
cd /opt
sudo mv qui-browser qui-browser-failed
sudo tar -xzf /backup/qui-browser-previous.tar.gz
sudo chown -R qui-browser:qui-browser qui-browser

# Start service
sudo systemctl start qui-browser
```

### 2. Docker Rollback

```bash
# Stop current container
docker stop qui-browser
docker rm qui-browser

# Run previous version
docker run -d \
  --name qui-browser \
  --restart always \
  -p 8000:8000 \
  --env-file .env \
  qui-browser:1.1.0
```

### 3. Kubernetes Rollback

```bash
# Rollback to previous revision
kubectl rollout undo deployment/qui-browser -n qui-browser-prod

# Check status
kubectl rollout status deployment/qui-browser -n qui-browser-prod
```

## Security Checklist

Before going live:

- [ ] TLS certificates installed and valid
- [ ] Strong admin tokens generated
- [ ] Firewall rules configured
- [ ] SELinux/AppArmor policies applied
- [ ] File permissions set correctly
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] DDoS protection enabled
- [ ] Audit logging enabled
- [ ] Health monitoring setup
- [ ] Backup strategy implemented
- [ ] Incident response plan documented
- [ ] Security audit completed

## Performance Optimization

### 1. System Tuning

```bash
# Increase file descriptor limit
sudo nano /etc/security/limits.conf
```

```
qui-browser soft nofile 65536
qui-browser hard nofile 65536
```

### 2. Node.js Optimization

```bash
# Enable cluster mode for multi-core
# server-lightweight.js startup script
if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Start server
}
```

### 3. Caching Strategy

Adjust cache settings based on workload:

```ini
FILE_CACHE_MAX_SIZE=1000
FILE_CACHE_MAX_FILE_SIZE=102400
FILE_CACHE_TTL_MS=3600000
```

## Compliance & Audit

### GDPR Compliance

- Audit logs contain no PII by default
- Data retention policies configurable
- Right to erasure supported
- Data export functionality available

### SOC2 Requirements

- Audit logging with integrity verification
- Access controls via admin tokens
- Monitoring and alerting configured
- Incident response procedures documented

## Support & Resources

- **Documentation**: See `docs/` directory
- **Security Issues**: See `SECURITY.md`
- **Production Improvements**: See `PRODUCTION-IMPROVEMENTS.md`
- **API Reference**: See `docs/API.md`

---

**Deployment Completed**: `date`
**Deployed By**: `$USER`
**Version**: 1.2.0
**Environment**: Production
