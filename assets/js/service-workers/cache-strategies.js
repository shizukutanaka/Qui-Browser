/**
 * Cache Strategies for Service Workers
 *
 * 高度なキャッシュ戦略を提供するクラス群。
 * PWAのオフライン機能を強化し、様々なコンテンツタイプに最適な戦略を適用。
 *
 * サポートされる戦略:
 * - Cache First: 静的アセット向け（即座にレスポンス）
 * - Network First: APIリクエスト向け（最新データ優先）
 * - Stale While Revalidate: 頻繁に更新されるが古いデータも許容
 * - Network Only: 常に最新が必要
 * - Cache Only: 事前キャッシュ済みリソース
 *
 * @module assets/js/service-workers/cache-strategies
 */

/**
 * キャッシュ戦略管理クラス
 */
class CacheStrategies {
  /**
   * Cache First 戦略
   *
   * キャッシュを優先的に確認し、存在する場合はすぐに返す。
   * キャッシュにない場合のみネットワークからフェッチ。
   *
   * 用途: 静的アセット、変更頻度の低いコンテンツ
   * - CSS, JavaScript, フォント
   * - 画像、アイコン
   * - VRコンテンツ（3Dモデル、テクスチャ）
   *
   * @param {Request} request - リクエストオブジェクト
   * @param {string} cacheName - キャッシュ名
   * @returns {Promise<Response>} レスポンス
   */
  static async cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
      // キャッシュヒット
      return cached;
    }

    // キャッシュミス: ネットワークからフェッチ
    try {
      const response = await fetch(request);

      // 成功したレスポンスのみキャッシュ
      if (response.ok) {
        cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      console.error('[CacheFirst] Fetch failed:', error);
      // オフライン時のフォールバック
      return this.getOfflineFallback(request);
    }
  }

  /**
   * Network First 戦略
   *
   * ネットワークを優先的に試行し、失敗した場合のみキャッシュを使用。
   * タイムアウトを設定して、遅いネットワークでもUX低下を防止。
   *
   * 用途: APIリクエスト、動的コンテンツ
   * - REST API呼び出し
   * - GraphQL クエリ
   * - リアルタイムデータ
   *
   * @param {Request} request - リクエストオブジェクト
   * @param {string} cacheName - キャッシュ名
   * @param {number} timeout - タイムアウト（ミリ秒、デフォルト: 3000）
   * @returns {Promise<Response>} レスポンス
   */
  static async networkFirst(request, cacheName, timeout = 3000) {
    const cache = await caches.open(cacheName);

    try {
      // タイムアウト付きフェッチ
      const response = await this.fetchWithTimeout(request, timeout);

      // 成功したレスポンスをキャッシュ
      if (response.ok) {
        cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      console.warn('[NetworkFirst] Network failed, trying cache:', error.message);

      // ネットワーク失敗: キャッシュを確認
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }

      // キャッシュもない: オフラインフォールバック
      return this.getOfflineFallback(request);
    }
  }

  /**
   * Stale While Revalidate 戦略
   *
   * キャッシュがあればすぐに返し、バックグラウンドでネットワークから更新。
   * ユーザーには即座にレスポンスを返しつつ、次回のために最新版を取得。
   *
   * 用途: 頻繁に更新されるが、古いデータでも許容されるコンテンツ
   * - ニュースフィード
   * - ソーシャルメディア投稿
   * - 製品カタログ
   *
   * @param {Request} request - リクエストオブジェクト
   * @param {string} cacheName - キャッシュ名
   * @returns {Promise<Response>} レスポンス
   */
  static async staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    // バックグラウンドでネットワークから更新
    const fetchPromise = fetch(request)
      .then(response => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(error => {
        console.warn('[StaleWhileRevalidate] Background update failed:', error.message);
        return null;
      });

    // キャッシュがあればすぐ返す、なければネットワークを待つ
    return cached || fetchPromise || this.getOfflineFallback(request);
  }

  /**
   * Network Only 戦略
   *
   * 常にネットワークから取得し、キャッシュを使用しない。
   *
   * 用途: 常に最新が必要なリクエスト
   * - POST, PUT, DELETE リクエスト
   * - リアルタイム通知
   * - セキュリティトークン
   *
   * @param {Request} request - リクエストオブジェクト
   * @returns {Promise<Response>} レスポンス
   */
  static async networkOnly(request) {
    try {
      return await fetch(request);
    } catch (error) {
      console.error('[NetworkOnly] Fetch failed:', error);
      // オフライン時は503を返す
      return new Response('Service Unavailable', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    }
  }

  /**
   * Cache Only 戦略
   *
   * キャッシュのみを確認し、ネットワークを使用しない。
   *
   * 用途: 事前キャッシュされた必須アセット
   * - アプリケーションシェル
   * - オフラインページ
   * - 必須アイコン
   *
   * @param {Request} request - リクエストオブジェクト
   * @param {string} cacheName - キャッシュ名
   * @returns {Promise<Response>} レスポンス
   */
  static async cacheOnly(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    // キャッシュにない場合は404
    return new Response('Not Found', {
      status: 404,
      statusText: 'Not Found'
    });
  }

  /**
   * タイムアウト付きフェッチ
   *
   * @param {Request} request - リクエストオブジェクト
   * @param {number} timeout - タイムアウト（ミリ秒）
   * @returns {Promise<Response>} レスポンス
   */
  static fetchWithTimeout(request, timeout) {
    return Promise.race([
      fetch(request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      )
    ]);
  }

  /**
   * オフラインフォールバックを取得
   *
   * @param {Request} request - リクエストオブジェクト
   * @returns {Promise<Response>} フォールバックレスポンス
   */
  static async getOfflineFallback(request) {
    const cache = await caches.open('offline-fallbacks-v1');
    const url = new URL(request.url);

    // リクエストタイプに応じたフォールバック
    if (request.destination === 'document') {
      // HTMLページ: オフラインページを表示
      const offlinePage = await cache.match('/offline.html');
      if (offlinePage) {
        return offlinePage;
      }
      return new Response(this.getOfflineHTML(), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (request.destination === 'image') {
      // 画像: プレースホルダー画像を表示
      const placeholder = await cache.match('/assets/images/offline-placeholder.svg');
      if (placeholder) {
        return placeholder;
      }
      return new Response(this.getOfflineSVG(), {
        headers: { 'Content-Type': 'image/svg+xml' }
      });
    }

    if (request.destination === 'script' || request.destination === 'style') {
      // JavaScript/CSS: 空のレスポンス（エラー防止）
      return new Response('', {
        status: 200,
        headers: {
          'Content-Type': request.destination === 'script'
            ? 'application/javascript'
            : 'text/css'
        }
      });
    }

    // その他: 一般的なオフラインメッセージ
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }

  /**
   * オフラインHTMLを生成
   *
   * @returns {string} オフラインページHTML
   */
  static getOfflineHTML() {
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>オフライン - Qui Browser</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #fff;
      text-align: center;
      padding: 20px;
    }
    .container {
      max-width: 500px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    h1 { font-size: 3em; margin-bottom: 20px; }
    p { font-size: 1.2em; margin-bottom: 30px; line-height: 1.6; }
    .icon {
      width: 120px;
      height: 120px;
      margin: 0 auto 30px;
      opacity: 0.9;
    }
    button {
      background: #fff;
      color: #667eea;
      border: none;
      padding: 15px 40px;
      font-size: 1.1em;
      font-weight: bold;
      border-radius: 50px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
  </style>
</head>
<body>
  <div class="container">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
    <h1>オフライン</h1>
    <p>インターネット接続が利用できません。<br>接続を確認して、もう一度お試しください。</p>
    <button onclick="location.reload()">再読み込み</button>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * オフラインSVGプレースホルダーを生成
   *
   * @returns {string} SVG文字列
   */
  static getOfflineSVG() {
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f0f0f0"/>
  <path d="M200 100 L250 150 L200 200 L150 150 Z" fill="#d0d0d0"/>
  <text x="200" y="250" font-family="Arial" font-size="18" text-anchor="middle" fill="#999">
    オフライン
  </text>
</svg>
    `.trim();
  }

  /**
   * キャッシュのクリーンアップ
   *
   * @param {string} cacheName - キャッシュ名
   * @param {number} maxAge - 最大保持期間（ミリ秒）
   * @param {number} maxItems - 最大アイテム数
   */
  static async cleanupCache(cacheName, maxAge = 86400000, maxItems = 100) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    // 古いエントリを削除
    const now = Date.now();
    let deletedCount = 0;

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const age = now - new Date(dateHeader).getTime();
          if (age > maxAge) {
            await cache.delete(request);
            deletedCount++;
          }
        }
      }
    }

    // アイテム数制限（LRU削除）
    const remainingRequests = await cache.keys();
    if (remainingRequests.length > maxItems) {
      const toDelete = remainingRequests.length - maxItems;
      for (let i = 0; i < toDelete; i++) {
        await cache.delete(remainingRequests[i]);
        deletedCount++;
      }
    }

    console.log(`[CacheStrategies] Cleaned up ${deletedCount} entries from ${cacheName}`);
  }
}

// Service Worker環境でのみエクスポート
if (typeof self !== 'undefined' && 'ServiceWorkerGlobalScope' in self) {
  self.CacheStrategies = CacheStrategies;
}
