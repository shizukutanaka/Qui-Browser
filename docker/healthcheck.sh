#!/bin/sh
# Health check script for Qui Browser VR Docker container

set -e

# Nginxプロセスチェック
if ! pgrep nginx > /dev/null; then
    echo "Nginx is not running"
    exit 1
fi

# HTTPレスポンスチェック (exit code reflects HTTP success; --spider output is unreliable)
if ! wget --quiet --tries=1 --timeout=5 -O /dev/null http://localhost/health; then
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
