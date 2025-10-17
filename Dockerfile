# Qui Browser - Production Dockerfile
# Optimized for security, performance, and minimal size
# 国家レベルのセキュリティとパフォーマンスを実現

# Stage 1: Build dependencies
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /build

# Install build dependencies (minimal set)
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Install production dependencies only with strict security
RUN npm ci --only=production --ignore-scripts --no-audit

# Stage 2: Production image
FROM node:20-alpine

# Add labels for metadata
LABEL maintainer="Qui Browser Team"
LABEL version="1.1.0"
LABEL description="Enterprise-grade lightweight web browser server"

# Set environment variables
ENV NODE_ENV=production \
    PORT=8000 \
    HOST=0.0.0.0

# Create non-root user
RUN addgroup -g 1001 -S quibrowser && \
    adduser -u 1001 -S quibrowser -G quibrowser

# Set working directory
WORKDIR /app

# Install security updates
RUN apk upgrade --no-cache && \
    apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates

# Copy dependencies from builder
COPY --from=builder --chown=quibrowser:quibrowser /build/node_modules ./node_modules

# Copy application files
COPY --chown=quibrowser:quibrowser . .

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/logs/audit /app/data /app/backups /app/tmp && \
    chown -R quibrowser:quibrowser /app/logs /app/data /app/backups /app/tmp

# Remove unnecessary files to reduce image size
RUN rm -rf \
    .git* \
    .github \
    .vscode \
    .editorconfig \
    .prettierrc \
    .dockerignore \
    Jenkinsfile \
    .gitlab-ci.yml \
    types \
    backups

# Switch to non-root user
USER quibrowser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "const http = require('http'); \
    http.get('http://localhost:8000/health', (res) => { \
        if (res.statusCode === 200) process.exit(0); \
        else process.exit(1); \
    }).on('error', () => process.exit(1));"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start server
CMD ["node", "server-lightweight.js"]

# Security: Run as non-root, read-only root filesystem
# Usage: docker run --read-only --tmpfs /tmp --tmpfs /app/logs -p 8000:8000 qui-browser