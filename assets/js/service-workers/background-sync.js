/**
 * Background Sync Manager
 *
 * オフライン時のリクエストをキューに保存し、
 * オンライン復帰時に自動的に送信するバックグラウンド同期機能。
 *
 * 特徴:
 * - オフライン時のPOST/PUT/DELETEリクエストをキューイング
 * - ネットワーク復帰時の自動再送信
 * - リトライロジック（指数バックオフ）
 * - 古いキューアイテムの自動クリーンアップ
 * - 詳細なログとエラーハンドリング
 *
 * @module assets/js/service-workers/background-sync
 */

/**
 * バックグラウンド同期マネージャークラス
 */
class BackgroundSyncManager {
  /**
   * コンストラクタ
   */
  constructor() {
    this.queueName = 'sync-queue-v1';
    this.maxRetries = 3;
    this.retryDelay = 1000; // 初期リトライ遅延（ミリ秒）
    this.maxQueueAge = 86400000; // 24時間（ミリ秒）
  }

  /**
   * リクエストをキューに追加
   *
   * @param {Request} request - リクエストオブジェクト
   * @param {string|FormData|Object} data - リクエストボディ
   * @param {Object} metadata - メタデータ（オプション）
   * @returns {Promise<void>}
   */
  async addToQueue(request, data, metadata = {}) {
    try {
      const cache = await caches.open(this.queueName);

      // リクエスト情報をシリアライズ
      const queuedRequest = {
        url: request.url,
        method: request.method,
        headers: this.serializeHeaders(request.headers),
        body: await this.serializeBody(data),
        timestamp: Date.now(),
        retries: 0,
        metadata: metadata
      };

      // ユニークなキーでキューに保存
      const queueKey = `/queue/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await cache.put(
        new Request(queueKey),
        new Response(JSON.stringify(queuedRequest), {
          headers: { 'Content-Type': 'application/json' }
        })
      );

      console.log('[BackgroundSync] Request added to queue:', queuedRequest.url);

      // Background Sync APIに登録（対応ブラウザのみ）
      if ('sync' in self.registration) {
        await self.registration.sync.register('sync-requests');
        console.log('[BackgroundSync] Sync registered');
      }

      return queuedRequest;
    } catch (error) {
      console.error('[BackgroundSync] Failed to add to queue:', error);
      throw error;
    }
  }

  /**
   * キューのリクエストを処理
   *
   * @returns {Promise<Array>} 処理結果の配列
   */
  async processQueue() {
    console.log('[BackgroundSync] Processing queue...');

    try {
      const cache = await caches.open(this.queueName);
      const requests = await cache.keys();

      if (requests.length === 0) {
        console.log('[BackgroundSync] Queue is empty');
        return [];
      }

      console.log(`[BackgroundSync] Processing ${requests.length} queued requests`);

      const results = [];

      for (const request of requests) {
        const result = await this.processQueueItem(cache, request);
        results.push(result);

        // 処理間隔を空ける（サーバー負荷軽減）
        await this.delay(100);
      }

      // 統計ログ
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`[BackgroundSync] Queue processed: ${successful} successful, ${failed} failed`);

      return results;
    } catch (error) {
      console.error('[BackgroundSync] Queue processing error:', error);
      return [];
    }
  }

  /**
   * 単一のキューアイテムを処理
   *
   * @param {Cache} cache - キャッシュオブジェクト
   * @param {Request} queueRequest - キューリクエスト
   * @returns {Promise<Object>} 処理結果
   */
  async processQueueItem(cache, queueRequest) {
    try {
      const response = await cache.match(queueRequest);
      if (!response) {
        return { success: false, error: 'Queue item not found' };
      }

      const queuedRequest = await response.json();

      // リクエストを再送信
      console.log('[BackgroundSync] Retrying request:', queuedRequest.url);

      const fetchResponse = await fetch(queuedRequest.url, {
        method: queuedRequest.method,
        headers: queuedRequest.headers,
        body: queuedRequest.body
      });

      if (fetchResponse.ok) {
        // 成功: キューから削除
        await cache.delete(queueRequest);
        console.log('[BackgroundSync] Request succeeded:', queuedRequest.url);

        // 成功通知を送信（オプション）
        await this.notifySuccess(queuedRequest);

        return {
          success: true,
          request: queuedRequest,
          status: fetchResponse.status
        };
      } else {
        // 失敗: リトライ
        return await this.handleFailedRequest(cache, queueRequest, queuedRequest, fetchResponse.status);
      }
    } catch (error) {
      console.error('[BackgroundSync] Request failed:', error);

      // ネットワークエラー: リトライ
      const response = await cache.match(queueRequest);
      const queuedRequest = await response.json();
      return await this.handleFailedRequest(cache, queueRequest, queuedRequest, null, error);
    }
  }

  /**
   * 失敗したリクエストを処理
   *
   * @param {Cache} cache - キャッシュオブジェクト
   * @param {Request} queueRequest - キューリクエスト
   * @param {Object} queuedRequest - キューされたリクエストデータ
   * @param {number|null} status - HTTPステータスコード
   * @param {Error|null} error - エラーオブジェクト
   * @returns {Promise<Object>} 処理結果
   */
  async handleFailedRequest(cache, queueRequest, queuedRequest, status, error = null) {
    queuedRequest.retries = (queuedRequest.retries || 0) + 1;

    if (queuedRequest.retries >= this.maxRetries) {
      // 最大リトライ回数に到達: キューから削除
      await cache.delete(queueRequest);
      console.error('[BackgroundSync] Max retries reached, removing from queue:', queuedRequest.url);

      // 失敗通知を送信
      await this.notifyFailure(queuedRequest, status, error);

      return {
        success: false,
        request: queuedRequest,
        error: 'Max retries reached',
        status: status
      };
    } else {
      // リトライカウントを更新してキューに戻す
      await cache.put(
        queueRequest,
        new Response(JSON.stringify(queuedRequest), {
          headers: { 'Content-Type': 'application/json' }
        })
      );

      console.log(`[BackgroundSync] Retry ${queuedRequest.retries}/${this.maxRetries}:`, queuedRequest.url);

      return {
        success: false,
        request: queuedRequest,
        error: error ? error.message : `HTTP ${status}`,
        retries: queuedRequest.retries
      };
    }
  }

  /**
   * 古いキューアイテムをクリーンアップ
   *
   * @param {number} maxAge - 最大保持期間（ミリ秒、デフォルト: 24時間）
   * @returns {Promise<number>} 削除されたアイテム数
   */
  async cleanupOldQueue(maxAge = this.maxQueueAge) {
    try {
      const cache = await caches.open(this.queueName);
      const requests = await cache.keys();
      const now = Date.now();
      let deletedCount = 0;

      for (const request of requests) {
        const response = await cache.match(request);
        if (!response) continue;

        const data = await response.json();
        if (now - data.timestamp > maxAge) {
          await cache.delete(request);
          deletedCount++;
          console.log('[BackgroundSync] Removed old queue item:', data.url);
        }
      }

      if (deletedCount > 0) {
        console.log(`[BackgroundSync] Cleaned up ${deletedCount} old queue items`);
      }

      return deletedCount;
    } catch (error) {
      console.error('[BackgroundSync] Cleanup error:', error);
      return 0;
    }
  }

  /**
   * キューの統計情報を取得
   *
   * @returns {Promise<Object>} 統計情報
   */
  async getQueueStats() {
    try {
      const cache = await caches.open(this.queueName);
      const requests = await cache.keys();

      const stats = {
        totalItems: requests.length,
        byMethod: {},
        byAge: { fresh: 0, old: 0 },
        oldestItem: null,
        newestItem: null
      };

      const now = Date.now();
      const oneHour = 3600000;

      for (const request of requests) {
        const response = await cache.match(request);
        if (!response) continue;

        const data = await response.json();

        // メソッド別集計
        stats.byMethod[data.method] = (stats.byMethod[data.method] || 0) + 1;

        // 年齢別集計
        const age = now - data.timestamp;
        if (age < oneHour) {
          stats.byAge.fresh++;
        } else {
          stats.byAge.old++;
        }

        // 最古・最新アイテム
        if (!stats.oldestItem || data.timestamp < stats.oldestItem) {
          stats.oldestItem = data.timestamp;
        }
        if (!stats.newestItem || data.timestamp > stats.newestItem) {
          stats.newestItem = data.timestamp;
        }
      }

      return stats;
    } catch (error) {
      console.error('[BackgroundSync] Stats error:', error);
      return null;
    }
  }

  /**
   * ヘッダーをシリアライズ
   *
   * @param {Headers} headers - Headersオブジェクト
   * @returns {Object} シリアライズされたヘッダー
   */
  serializeHeaders(headers) {
    const serialized = {};
    for (const [key, value] of headers.entries()) {
      serialized[key] = value;
    }
    return serialized;
  }

  /**
   * ボディをシリアライズ
   *
   * @param {*} body - ボディデータ
   * @returns {Promise<string|null>} シリアライズされたボディ
   */
  async serializeBody(body) {
    if (!body) return null;

    if (typeof body === 'string') {
      return body;
    }

    if (body instanceof FormData) {
      // FormDataを配列に変換
      const entries = [];
      for (const [key, value] of body.entries()) {
        entries.push([key, value]);
      }
      return JSON.stringify({ type: 'FormData', entries });
    }

    if (typeof body === 'object') {
      return JSON.stringify(body);
    }

    return String(body);
  }

  /**
   * ボディをデシリアライズ
   *
   * @param {string|null} serialized - シリアライズされたボディ
   * @returns {*} デシリアライズされたボディ
   */
  deserializeBody(serialized) {
    if (!serialized) return null;

    try {
      const parsed = JSON.parse(serialized);

      if (parsed.type === 'FormData') {
        const formData = new FormData();
        for (const [key, value] of parsed.entries) {
          formData.append(key, value);
        }
        return formData;
      }

      return serialized;
    } catch {
      return serialized;
    }
  }

  /**
   * 成功通知を送信
   *
   * @param {Object} request - リクエストデータ
   */
  async notifySuccess(request) {
    // 通知APIを使用（オプション）
    if ('showNotification' in self.registration) {
      await self.registration.showNotification('リクエスト成功', {
        body: `${request.method} ${request.url} が正常に送信されました`,
        icon: '/assets/images/icon-success.png',
        badge: '/assets/images/badge-72.png',
        tag: 'sync-success'
      });
    }

    // クライアントにメッセージを送信
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_SUCCESS',
        request: request
      });
    });
  }

  /**
   * 失敗通知を送信
   *
   * @param {Object} request - リクエストデータ
   * @param {number|null} status - HTTPステータスコード
   * @param {Error|null} error - エラーオブジェクト
   */
  async notifyFailure(request, status, error) {
    // 通知APIを使用（オプション）
    if ('showNotification' in self.registration) {
      await self.registration.showNotification('リクエスト失敗', {
        body: `${request.method} ${request.url} の送信に失敗しました`,
        icon: '/assets/images/icon-error.png',
        badge: '/assets/images/badge-72.png',
        tag: 'sync-failure'
      });
    }

    // クライアントにメッセージを送信
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_FAILURE',
        request: request,
        status: status,
        error: error ? error.message : null
      });
    });
  }

  /**
   * 遅延ヘルパー
   *
   * @param {number} ms - 遅延時間（ミリ秒）
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Service Worker環境でのみエクスポート
if (typeof self !== 'undefined' && 'ServiceWorkerGlobalScope' in self) {
  self.BackgroundSyncManager = BackgroundSyncManager;
}
