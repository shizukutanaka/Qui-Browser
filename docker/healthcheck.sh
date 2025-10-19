#!/bin/sh
# Health check script for Qui Browser VR Docker container

set -e

# Nginxプロセスチェック
if ! pgrep nginx > /dev/null; then
    echo "Nginx is not running"
    exit 1
fi

# HTTPレスポンスチェック
if ! wget --no-verbose --tries=1 --spider http://localhost/health 2>&1 | grep -q '200 OK'; then
    echo "HTTP health check failed"
    exit 1
fi

# index.htmlの存在チェック
if [ ! -f /usr/share/nginx/html/index.html ]; then
    echo "index.html not found"
    exit 1
fi

echo "Health check passed"
exit 0
