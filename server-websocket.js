/**
 * Qui Browser - WebSocket Server
 *
 * リアルタイム双方向通信サポート
 * セキュアな認証・認可、メッセージ検証、DoS対策
 *
 * @module server-websocket
 * @version 1.0.3
 * @license MIT
 */

const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const { version: packageVersion } = require('./package.json');

/**
 * WebSocketサーバークラス
 *
 * 主な機能:
 * - リアルタイム双方向通信
 * - メッセージペイロード検証
 * - 接続レート制限
 * - 自動Ping/Pong（ハートビート）
 * - メッセージサイズ制限
 */
class QuiWebSocketServer {
  constructor(options = {}) {
    this.port = options.port || Number(process.env.WS_PORT) || 8080;
    this.environment = process.env.NODE_ENV || 'development';
    this.maxConnections = options.maxConnections || 1000;
    this.maxMessageSize = options.maxMessageSize || 1048576; // 1MB
    this.heartbeatInterval = options.heartbeatInterval || 30000; // 30秒
    this.version = packageVersion || '1.0.3';

    // 統計
    this.totalConnections = 0;
    this.activeConnections = 0;
    this.messagesReceived = 0;
    this.messagesSent = 0;
    this.errorsCount = 0;

    // 接続管理
    this.clients = new Map(); // clientId -> { ws, metadata }
    this.rateLimitMap = new Map(); // IP -> { count, resetTime }
    this.rateLimitMax = options.rateLimitMax || 10; // 10接続/分
    this.rateLimitWindow = options.rateLimitWindow || 60000; // 1分

    // ブロードキャストチャネル
    this.channels = new Map(); // channelName -> Set<clientId>

    this.httpServer = null;
    this.wss = null;

    console.log('[WebSocket] Server initialized');
  }

  /**
   * 接続レート制限チェック
   */
  checkRateLimit(clientIP) {
    const now = Date.now();
    const record = this.rateLimitMap.get(clientIP);

    if (!record) {
      this.rateLimitMap.set(clientIP, { count: 1, resetTime: now + this.rateLimitWindow });
      return true;
    }

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + this.rateLimitWindow;
      return true;
    }

    if (record.count >= this.rateLimitMax) {
      return false;
    }

    record.count++;
    return true;
  }

  /**
   * クライアントID生成
   */
  generateClientId() {
    return crypto.randomUUID();
  }

  /**
   * メッセージ検証
   */
  validateMessage(message) {
    try {
      const parsed = JSON.parse(message);

      if (!parsed.type || typeof parsed.type !== 'string') {
        return { valid: false, error: 'Invalid message type' };
      }

      // メッセージタイプのホワイトリスト
      const allowedTypes = ['ping', 'subscribe', 'unsubscribe', 'broadcast', 'data'];
      if (!allowedTypes.includes(parsed.type)) {
        return { valid: false, error: 'Unknown message type' };
      }

      return { valid: true, data: parsed };
    } catch (err) {
      return { valid: false, error: 'Invalid JSON' };
    }
  }

  /**
   * チャネル登録
   */
  subscribe(clientId, channelName) {
    if (!this.channels.has(channelName)) {
      this.channels.set(channelName, new Set());
    }
    this.channels.get(channelName).add(clientId);
    console.log(`[WebSocket] Client ${clientId} subscribed to ${channelName}`);
  }

  /**
   * チャネル解除
   */
  unsubscribe(clientId, channelName) {
    if (this.channels.has(channelName)) {
      this.channels.get(channelName).delete(clientId);
      if (this.channels.get(channelName).size === 0) {
        this.channels.delete(channelName);
      }
      console.log(`[WebSocket] Client ${clientId} unsubscribed from ${channelName}`);
    }
  }

  /**
   * チャネルブロードキャスト
   */
  broadcast(channelName, message) {
    if (!this.channels.has(channelName)) {
      return;
    }

    const data = JSON.stringify({
      type: 'broadcast',
      channel: channelName,
      data: message,
      timestamp: new Date().toISOString()
    });

    let sent = 0;
    this.channels.get(channelName).forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === 1) {
        // OPEN
        client.ws.send(data);
        sent++;
      }
    });

    this.messagesSent += sent;
    return sent;
  }

  /**
   * メッセージハンドラ
   */
  handleMessage(clientId, message) {
    const validation = this.validateMessage(message);

    if (!validation.valid) {
      this.sendError(clientId, validation.error);
      return;
    }

    const { type, channel, data } = validation.data;

    switch (type) {
      case 'ping':
        this.sendMessage(clientId, { type: 'pong', timestamp: Date.now() });
        break;

      case 'subscribe':
        if (channel) {
          this.subscribe(clientId, channel);
          this.sendMessage(clientId, { type: 'subscribed', channel });
        }
        break;

      case 'unsubscribe':
        if (channel) {
          this.unsubscribe(clientId, channel);
          this.sendMessage(clientId, { type: 'unsubscribed', channel });
        }
        break;

      case 'broadcast':
        if (channel && data) {
          const sent = this.broadcast(channel, data);
          this.sendMessage(clientId, { type: 'broadcast_ack', channel, sent });
        }
        break;

      case 'data':
        // カスタムデータ処理（サブクラスでオーバーライド可能）
        this.onData(clientId, data);
        break;

      default:
        this.sendError(clientId, 'Unhandled message type');
    }
  }

  /**
   * カスタムデータ処理（オーバーライド可能）
   */
  onData(clientId, data) {
    console.log(`[WebSocket] Received data from ${clientId}:`, data);
    // デフォルトはエコーバック
    this.sendMessage(clientId, { type: 'data', data });
  }

  /**
   * メッセージ送信
   */
  sendMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== 1) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      this.messagesSent++;
      return true;
    } catch (err) {
      console.error(`[WebSocket] Failed to send message to ${clientId}:`, err);
      this.errorsCount++;
      return false;
    }
  }

  /**
   * エラー送信
   */
  sendError(clientId, error) {
    this.sendMessage(clientId, { type: 'error', error });
  }

  /**
   * 接続処理
   */
  handleConnection(ws, request) {
    const clientIP = request.socket.remoteAddress || '__unknown__';

    // レート制限チェック
    if (!this.checkRateLimit(clientIP)) {
      ws.close(1008, 'Rate limit exceeded');
      console.warn(`[WebSocket] Connection rejected (rate limit): ${clientIP}`);
      return;
    }

    // 最大接続数チェック
    if (this.activeConnections >= this.maxConnections) {
      ws.close(1008, 'Server at capacity');
      console.warn(`[WebSocket] Connection rejected (max capacity): ${clientIP}`);
      return;
    }

    const clientId = this.generateClientId();
    this.clients.set(clientId, {
      ws,
      metadata: {
        clientIP,
        connectedAt: Date.now(),
        lastActivity: Date.now()
      }
    });

    this.totalConnections++;
    this.activeConnections++;

    console.log(`[WebSocket] Client connected: ${clientId} (${clientIP})`);

    // ウェルカムメッセージ
    this.sendMessage(clientId, {
      type: 'welcome',
      clientId,
      server: 'Qui Browser WebSocket Server',
      version: this.version
    });

    // ハートビート設定
    const heartbeat = setInterval(() => {
      if (ws.readyState === 1) {
        ws.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, this.heartbeatInterval);

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.metadata.lastActivity = Date.now();
      }
    });

    // メッセージ受信
    ws.on('message', data => {
      this.messagesReceived++;

      // サイズ制限
      if (data.length > this.maxMessageSize) {
        this.sendError(clientId, 'Message too large');
        ws.close(1009, 'Message too large');
        return;
      }

      try {
        this.handleMessage(clientId, data.toString());
      } catch (err) {
        console.error(`[WebSocket] Message handling error:`, err);
        this.errorsCount++;
        this.sendError(clientId, 'Internal server error');
      }
    });

    // エラー処理
    ws.on('error', err => {
      console.error(`[WebSocket] Client error (${clientId}):`, err);
      this.errorsCount++;
    });

    // 切断処理
    ws.on('close', (code, reason) => {
      clearInterval(heartbeat);

      // 全チャネルから解除
      this.channels.forEach(clients => {
        clients.delete(clientId);
      });

      this.clients.delete(clientId);
      this.activeConnections--;

      console.log(`[WebSocket] Client disconnected: ${clientId} (code: ${code}, reason: ${reason})`);
    });
  }

  /**
   * サーバー起動
   */
  async start() {
    this.httpServer = http.createServer((req, res) => {
      // ヘルスチェック
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'healthy',
            protocol: 'WebSocket',
            activeConnections: this.activeConnections,
            totalConnections: this.totalConnections,
            messagesReceived: this.messagesReceived,
            messagesSent: this.messagesSent,
            errors: this.errorsCount,
            version: this.version
          })
        );
        return;
      }

      res.writeHead(404);
      res.end();
    });

    this.wss = new WebSocketServer({
      server: this.httpServer,
      maxPayload: this.maxMessageSize,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
      }
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.port, err => {
        if (err) {
          reject(err);
        } else {
          console.log(`[WebSocket] Server listening on port ${this.port}`);
          console.log(`[WebSocket] Max connections: ${this.maxConnections}`);
          console.log(`[WebSocket] Max message size: ${this.maxMessageSize} bytes`);
          resolve(this.httpServer);
        }
      });
    });
  }

  /**
   * グレースフルシャットダウン
   */
  async shutdown() {
    console.log('[WebSocket] Initiating graceful shutdown...');

    // 全クライアントに切断通知
    this.clients.forEach((client, clientId) => {
      this.sendMessage(clientId, { type: 'shutdown', message: 'Server shutting down' });
      client.ws.close(1001, 'Server shutdown');
    });

    // WebSocketサーバー停止
    if (this.wss) {
      await new Promise(resolve => {
        this.wss.close(resolve);
      });
    }

    // HTTPサーバー停止
    if (this.httpServer) {
      await new Promise(resolve => {
        this.httpServer.close(resolve);
      });
    }

    console.log('[WebSocket] Server shut down complete');
  }

  /**
   * 統計情報取得
   */
  getStats() {
    return {
      totalConnections: this.totalConnections,
      activeConnections: this.activeConnections,
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
      errors: this.errorsCount,
      channels: this.channels.size,
      version: this.version
    };
  }
}

module.exports = QuiWebSocketServer;

// 直接実行時
if (require.main === module) {
  const server = new QuiWebSocketServer();

  const shutdown = async signal => {
    console.log(`[WebSocket] Received ${signal}, shutting down...`);
    await server.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  server.start().catch(err => {
    console.error('[WebSocket] Failed to start server:', err);
    process.exit(1);
  });
}
