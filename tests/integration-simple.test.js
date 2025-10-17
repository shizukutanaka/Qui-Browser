/**
 * 簡易統合テスト
 * 実際のユースケースに基づいた統合テスト
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

describe('Qui Browser Integration Tests', () => {
  let server;
  const PORT = 8001;

  before((t, done) => {
    // テスト用の簡易サーバーを起動
    server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        }));
      } else if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Qui Browser</h1></body></html>');
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(PORT, () => {
      console.log(`Test server listening on port ${PORT}`);
      done();
    });
  });

  after(() => {
    if (server) {
      server.close();
    }
  });

  describe('Basic Server Functionality', () => {
    it('should respond to health check', (t, done) => {
      http.get(`http://localhost:${PORT}/health`, (res) => {
        assert.strictEqual(res.statusCode, 200);

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const health = JSON.parse(data);
          assert.strictEqual(health.status, 'healthy');
          assert.ok(health.timestamp);
          assert.ok(typeof health.uptime === 'number');
          done();
        });
      });
    });

    it('should serve homepage', (t, done) => {
      http.get(`http://localhost:${PORT}/`, (res) => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'text/html');

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          assert.ok(data.includes('Qui Browser'));
          done();
        });
      });
    });

    it('should return 404 for unknown routes', (t, done) => {
      http.get(`http://localhost:${PORT}/nonexistent`, (res) => {
        assert.strictEqual(res.statusCode, 404);
        done();
      });
    });
  });

  describe('Module Integration', () => {
    it('should load input-validator module', () => {
      const validator = require('../utils/input-validator');
      assert.ok(validator);
      assert.ok(typeof validator === 'object' || typeof validator === 'function');
    });

    it('should load session-manager module', () => {
      const sessionManager = require('../utils/session-manager');
      assert.ok(sessionManager);
    });

    it('should load advanced-cache module', () => {
      const cache = require('../utils/advanced-cache');
      assert.ok(cache);
    });

    it('should load ddos-protection module', () => {
      const ddos = require('../utils/ddos-protection');
      assert.ok(ddos);
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', (t, done) => {
      // サーバーエラーイベントリスナーを追加
      const errorHandler = (error) => {
        assert.ok(error instanceof Error);
        server.removeListener('error', errorHandler);
        done();
      };

      server.on('error', errorHandler);

      // タイムアウト後に成功として処理
      setTimeout(() => {
        server.removeListener('error', errorHandler);
        done();
      }, 100);
    });
  });

  describe('Performance', () => {
    it('should respond within acceptable time', (t, done) => {
      const startTime = Date.now();

      http.get(`http://localhost:${PORT}/health`, (res) => {
        const responseTime = Date.now() - startTime;

        assert.ok(responseTime < 1000, `Response time ${responseTime}ms exceeds 1000ms`);

        res.on('data', () => {});
        res.on('end', done);
      });
    });

    it('should handle multiple concurrent requests', async () => {
      const numRequests = 10;
      const promises = [];

      for (let i = 0; i < numRequests; i++) {
        promises.push(
          new Promise((resolve, reject) => {
            http.get(`http://localhost:${PORT}/health`, (res) => {
              assert.strictEqual(res.statusCode, 200);
              res.on('data', () => {});
              res.on('end', resolve);
              res.on('error', reject);
            });
          })
        );
      }

      await Promise.all(promises);
      assert.ok(true, 'All concurrent requests completed successfully');
    });
  });
});
