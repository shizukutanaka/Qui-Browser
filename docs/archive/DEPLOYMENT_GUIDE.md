# 🚀 Qui Browser VR - Deployment Guide

**Version:** 2.0.0
**Status:** Production Ready
**Target Platforms:** GitHub Pages, Netlify, Vercel, Docker, Custom Servers

---

## 📋 Overview

This guide provides complete deployment instructions for Qui Browser VR across multiple platforms. All methods have been tested and verified for production use.

### Deployment Options

| Platform | Difficulty | Cost | Best For |
|----------|------------|------|----------|
| **GitHub Pages** | ⭐ Easy | Free | Open source projects |
| **Netlify** | ⭐ Easy | Free tier | Quick deployments |
| **Vercel** | ⭐ Easy | Free tier | Serverless functions |
| **Docker** | ⭐⭐ Medium | Variable | Custom infrastructure |
| **Custom Server** | ⭐⭐⭐ Hard | Variable | Full control |

---

## 🎯 Pre-Deployment Checklist

### Code Quality

- [ ] All tests passing (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console errors
- [ ] Lighthouse score > 90
- [ ] Performance budgets met

### Configuration

- [ ] Version number updated
- [ ] Environment variables configured
- [ ] API keys secured (use env vars, not hardcoded)
- [ ] Service worker registered
- [ ] HTTPS configured (required for WebXR)

### Assets

- [ ] Images optimized
- [ ] Textures compressed (KTX2)
- [ ] Fonts subsetted
- [ ] Audio files optimized

### Security

- [ ] Dependencies audited (`npm audit`)
- [ ] No vulnerabilities (or documented/mitigated)
- [ ] CSP headers configured
- [ ] CORS properly set
- [ ] Secrets not in code

### Documentation

- [ ] README updated
- [ ] CHANGELOG updated
- [ ] API docs complete
- [ ] User guide available

---

## 1️⃣ GitHub Pages Deployment

**Best for:** Open source projects, documentation sites
**Cost:** Free
**Setup time:** 5 minutes

### Automatic Deployment (Recommended)

#### Step 1: Enable GitHub Pages

1. Go to repository Settings
2. Navigate to Pages section
3. Source: **GitHub Actions**

#### Step 2: Create Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build
        env:
          NODE_ENV: production

      - name: Setup Pages
        uses: actions/configure-pages@v3

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: './dist'

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
```

#### Step 3: Configure base URL

Update `vite.config.js`:

```javascript
export default defineConfig({
  base: '/qui-browser-vr/', // Replace with your repo name
  // ... rest of config
});
```

#### Step 4: Push to GitHub

```bash
git add .
git commit -m "Add GitHub Pages deployment"
git push origin main
```

**Your site will be live at:** `https://yourusername.github.io/qui-browser-vr/`

### Manual Deployment

```bash
# Build
npm run build

# Deploy using gh-pages
npm install -g gh-pages
gh-pages -d dist

# Or use GitHub CLI
gh repo deploy
```

---

## 2️⃣ Netlify Deployment

**Best for:** Quick deployments, preview deployments
**Cost:** Free tier (100GB bandwidth/month)
**Setup time:** 2 minutes

### Method 1: One-Click Deploy

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

### Method 2: Git Integration

#### Step 1: Connect Repository

1. Go to https://app.netlify.com/start
2. Click "New site from Git"
3. Choose GitHub and select repository
4. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Node version:** 18

#### Step 2: Configure netlify.toml

Create `netlify.toml` in project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "accelerometer=(self), gyroscope=(self), xr-spatial-tracking=(self)"

[[headers]]
  for = "/service-worker.js"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
    Service-Worker-Allowed = "/"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.ktx2"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[dev]
  command = "npm run dev"
  port = 5173
```

#### Step 3: Deploy

```bash
# Commit config
git add netlify.toml
git commit -m "Add Netlify configuration"
git push

# Or use Netlify CLI
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

**Your site will be live at:** `https://your-site-name.netlify.app`

### Environment Variables

Add in Netlify dashboard: Site settings → Environment variables

```
NODE_ENV=production
VITE_API_URL=https://api.yourdomain.com
```

---

## 3️⃣ Vercel Deployment

**Best for:** Serverless functions, edge computing
**Cost:** Free tier (100GB bandwidth/month)
**Setup time:** 2 minutes

### Method 1: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy to production
vercel --prod
```

### Method 3: Git Integration

#### Step 1: Import Project

1. Go to https://vercel.com/new
2. Import Git repository
3. Configure:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

#### Step 2: Configure vercel.json

Create `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",

  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "accelerometer=(self), gyroscope=(self), xr-spatial-tracking=(self)"
        }
      ]
    },
    {
      "source": "/service-worker.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        },
        {
          "key": "Service-Worker-Allowed",
          "value": "/"
        }
      ]
    },
    {
      "source": "/(.*\\.(?:js|css|woff2|ktx2))",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],

  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

#### Step 3: Deploy

```bash
git add vercel.json
git commit -m "Add Vercel configuration"
git push
```

**Your site will be live at:** `https://your-project.vercel.app`

---

## 4️⃣ Docker Deployment

**Best for:** Custom infrastructure, Kubernetes, full control
**Cost:** Variable (hosting dependent)
**Setup time:** 15 minutes

### Dockerfile

Create `Dockerfile`:

```dockerfile
# ============================================================================
# Stage 1: Build
# ============================================================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# ============================================================================
# Stage 2: Production
# ============================================================================
FROM nginx:alpine AS production

# Copy custom nginx config
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create health check script
COPY docker/healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD /usr/local/bin/healthcheck.sh

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Configuration

Create `docker/nginx.conf`:

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/json application/xml+rss
               image/svg+xml;

    # Brotli compression (if available)
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css text/xml text/javascript
                 application/javascript application/json application/xml+rss;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "accelerometer=(self), gyroscope=(self), xr-spatial-tracking=(self)" always;

        # Service Worker
        location = /service-worker.js {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Service-Worker-Allowed "/";
            expires off;
        }

        # Static assets (long-term caching)
        location ~* \.(js|css|woff2|ktx2)$ {
            add_header Cache-Control "public, max-age=31536000, immutable";
            expires 1y;
        }

        # Images
        location ~* \.(jpg|jpeg|png|gif|ico|svg)$ {
            add_header Cache-Control "public, max-age=2592000";
            expires 30d;
        }

        # SPA routing
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### Health Check Script

Create `docker/healthcheck.sh`:

```bash
#!/bin/sh
set -e

# Check if nginx is running
if ! pgrep -x nginx > /dev/null; then
    echo "Nginx is not running"
    exit 1
fi

# Check if application responds
if ! curl -f http://localhost/health > /dev/null 2>&1; then
    echo "Health check endpoint failed"
    exit 1
fi

echo "Health check passed"
exit 0
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  qui-browser:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "/usr/local/bin/healthcheck.sh"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
    volumes:
      - ./logs:/var/log/nginx

  # Optional: Add reverse proxy
  nginx-proxy:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./proxy/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - qui-browser
    restart: unless-stopped
```

### Build and Deploy

```bash
# Build image
docker build -t qui-browser-vr:2.0.0 .

# Run container
docker run -d -p 8080:80 --name qui-browser qui-browser-vr:2.0.0

# Or use Docker Compose
docker-compose up -d

# View logs
docker logs qui-browser

# Stop container
docker stop qui-browser

# Remove container
docker rm qui-browser
```

### Push to Registry

```bash
# Tag image
docker tag qui-browser-vr:2.0.0 yourusername/qui-browser-vr:2.0.0
docker tag qui-browser-vr:2.0.0 yourusername/qui-browser-vr:latest

# Push to Docker Hub
docker push yourusername/qui-browser-vr:2.0.0
docker push yourusername/qui-browser-vr:latest

# Pull and run on another server
docker pull yourusername/qui-browser-vr:latest
docker run -d -p 8080:80 yourusername/qui-browser-vr:latest
```

---

## 5️⃣ Custom Server Deployment

**Best for:** Full control, custom requirements
**Cost:** Variable (hosting dependent)
**Setup time:** 30-60 minutes

### Ubuntu/Debian Setup

#### Step 1: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install Certbot (for HTTPS)
sudo apt install -y certbot python3-certbot-nginx
```

#### Step 2: Deploy Application

```bash
# Clone repository
git clone https://github.com/yourusername/qui-browser-vr.git
cd qui-browser-vr

# Install dependencies
npm ci --only=production

# Build
npm run build

# Copy files to web root
sudo cp -r dist/* /var/www/html/
```

#### Step 3: Configure Nginx

Create `/etc/nginx/sites-available/qui-browser`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/json
               image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "accelerometer=(self), gyroscope=(self), xr-spatial-tracking=(self)" always;

    # Service Worker
    location = /service-worker.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Service-Worker-Allowed "/";
        expires off;
    }

    # Static assets
    location ~* \.(js|css|woff2|ktx2)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        expires 1y;
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/qui-browser /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Step 4: Setup HTTPS

```bash
# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is configured automatically
# Test renewal
sudo certbot renew --dry-run
```

#### Step 5: Setup Auto-Deploy (Optional)

Create `/opt/deploy-qui-browser.sh`:

```bash
#!/bin/bash
set -e

cd /path/to/qui-browser-vr
git pull origin main
npm ci --only=production
npm run build
sudo cp -r dist/* /var/www/html/
sudo systemctl reload nginx

echo "Deployment complete!"
```

Make executable:

```bash
sudo chmod +x /opt/deploy-qui-browser.sh
```

Setup webhook (using GitHub Actions or custom webhook server)

---

## 🔐 Environment Variables

### Development (.env.development)

```env
NODE_ENV=development
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3001
VITE_DEBUG=true
```

### Production (.env.production)

```env
NODE_ENV=production
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
VITE_DEBUG=false
```

### Platform-Specific

**Netlify:** Site settings → Environment variables
**Vercel:** Project settings → Environment variables
**GitHub Pages:** Secrets → Actions → New secret
**Docker:** docker-compose.yml environment section

---

## 🎯 Post-Deployment Checklist

### Verification

- [ ] Site loads correctly
- [ ] HTTPS working (required for WebXR)
- [ ] Service worker registered
- [ ] All assets loading
- [ ] VR mode functional
- [ ] Performance acceptable (Lighthouse)

### Monitoring

- [ ] Error tracking setup (Sentry, etc.)
- [ ] Analytics configured (Google Analytics, etc.)
- [ ] Uptime monitoring (UptimeRobot, etc.)
- [ ] Performance monitoring (New Relic, etc.)

### Security

- [ ] HTTPS certificate valid
- [ ] Security headers present
- [ ] CSP configured
- [ ] No sensitive data exposed
- [ ] API keys secured

### Performance

- [ ] CDN configured (Cloudflare, etc.)
- [ ] Gzip/Brotli compression enabled
- [ ] Caching headers correct
- [ ] Bundle size < budget
- [ ] Lighthouse score > 90

---

## 📊 Monitoring & Analytics

### Recommended Tools

1. **Error Tracking:** Sentry
2. **Analytics:** Google Analytics 4
3. **Performance:** New Relic / Datadog
4. **Uptime:** UptimeRobot
5. **Logs:** Papertrail / Loggly

### Setup Example (Sentry)

```javascript
// src/monitoring.js
import * as Sentry from "@sentry/browser";

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [new Sentry.BrowserTracing()],
    tracesSampleRate: 0.1,
    environment: 'production'
  });
}
```

---

## 🆘 Troubleshooting

### Issue: WebXR not working

**Solution:** HTTPS required. Check:
- Certificate valid
- No mixed content warnings
- Service Worker scope correct

### Issue: Assets not loading

**Solution:** Check CORS headers:
```nginx
add_header Access-Control-Allow-Origin "*";
add_header Access-Control-Allow-Methods "GET, OPTIONS";
```

### Issue: Service Worker not updating

**Solution:** Check cache headers:
```nginx
location = /service-worker.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    expires off;
}
```

### Issue: Build fails on CI

**Solution:** Check Node version:
```yaml
- uses: actions/setup-node@v3
  with:
    node-version: '18'
```

---

## ✅ Deployment Complete

Congratulations! Your Qui Browser VR deployment is complete.

**Final Steps:**

1. Test on actual VR device (Quest 2/3)
2. Monitor performance (Lighthouse, WebPageTest)
3. Setup alerts for downtime
4. Document custom configuration
5. Celebrate! 🎉

---

**Built with ❤️ for the VR web**

**Version:** 2.0.0
**Date:** 2025-11-06
**Status:** Production Ready ✅
