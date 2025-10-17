/**
 * Advanced Service Worker for Qui Browser
 *
 * 高度なオフライン戦略とバックグラウンド同期を実装したService Worker。
 * PWAのオフライン機能を大幅に強化し、VRデバイスでの安定性を向上。
 *
 * 機能:
 * - 複数のキャッシュ戦略（Cache First, Network First, Stale While Revalidate）
 * - バックグラウンド同期（オフライン時のリクエストキューイング）
 * - プッシュ通知
 * - 定期的なバックグラウンド同期
 * - インテリジェントなキャッシュ管理
 *
 * @version 2.0.0
 */

importScripts('/assets/js/service-workers/cache-strategies.js');
importScripts('/assets/js/service-workers/background-sync.js');

const CACHE_VERSION = 'v2.0.0';
const CACHES = {
  static: `static-${CACHE_VERSION}`,
  dynamic: `dynamic-${CACHE_VERSION}`,
  images: `images-${CACHE_VERSION}`,
  api: `api-${CACHE_VERSION}`,
  vr: `vr-${CACHE_VERSION}`,
  fonts: `fonts-${CACHE_VERSION}`
};

// 事前キャッシュするURL（アプリケーションシェル）
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/assets/styles/design-system.css',
  '/assets/styles/components.css',
  '/assets/js/browser-core.js',
  '/assets/images/logo.svg',
  '/assets/images/offline-placeholder.svg',
  '/manifest.json'
];

// VR専用のプリキャッシュ（オプション）
const VR_PRECACHE_URLS = [
  '/assets/js/webxr-integration.js',
  '/assets/js/vr-renderer.js',
  '/assets/styles/vr-ui.css'
];

// バックグラウンド同期マネージャー
const syncManager = new BackgroundSyncManager();

/**
 * Service Workerのインストール
 * 必須アセットを事前キャッシュ
 */
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing...');

  event.waitUntil(
    Promise.all([
      // 静的アセットをキャッシュ
      caches.open(CACHES.static).then(cache => {
        console.log('[ServiceWorker] Precaching static assets');
        return cache.addAll(PRECACHE_URLS);
      }),

      // オフラインフォールバックキャッシュを作成
      caches.open('offline-fallbacks-v1').then(cache => {
        return cache.addAll([
          '/offline.html',
          '/assets/images/offline-placeholder.svg'
        ]);
      })
    ])
    .then(() => {
      console.log('[ServiceWorker] Installation complete');
      return self.skipWaiting(); // 即座にアクティブ化
    })
    .catch(error => {
      console.error('[ServiceWorker] Installation failed:', error);
    })
  );
});

/**
 * Service Workerのアクティベーション
 * 古いキャッシュを削除
 */
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activating...');

  event.waitUntil(
    Promise.all([
      // 古いキャッシュを削除
      caches.keys().then(keys => {
        const currentCaches = Object.values(CACHES).concat(['offline-fallbacks-v1']);
        return Promise.all(
          keys.filter(key => !currentCaches.includes(key))
            .map(key => {
              console.log('[ServiceWorker] Deleting old cache:', key);
              return caches.delete(key);
            })
        );
      }),

      // すべてのクライアントを即座に制御
      self.clients.claim()
    ])
    .then(() => {
      console.log('[ServiceWorker] Activation complete');
    })
  );
});

/**
 * フェッチイベント
 * リクエストに応じた最適なキャッシュ戦略を適用
 */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 非GETリクエストの処理
  if (request.method !== 'GET') {
    event.respondWith(
      handleNonGetRequest(request)
    );
    return;
  }

  // ルーティング戦略に基づいてレスポンスを返す
  event.respondWith(
    routeRequest(request, url)
  );
});

/**
 * リクエストをルーティング
 *
 * @param {Request} request - リクエストオブジェクト
 * @param {URL} url - URLオブジェクト
 * @returns {Promise<Response>} レスポンス
 */
async function routeRequest(request, url) {
  // 静的アセット: Cache First
  if (url.pathname.startsWith('/assets/styles/') ||
      url.pathname.startsWith('/assets/js/') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js')) {
    return CacheStrategies.cacheFirst(request, CACHES.static);
  }

  // 画像: Cache First
  if (request.destination === 'image' ||
      url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/i)) {
    return CacheStrategies.cacheFirst(request, CACHES.images);
  }

  // フォント: Cache First
  if (request.destination === 'font' ||
      url.pathname.match(/\.(woff|woff2|ttf|otf|eot)$/i)) {
    return CacheStrategies.cacheFirst(request, CACHES.fonts);
  }

  // VRコンテンツ: Cache First（大容量のため優先的にキャッシュ）
  if (url.pathname.includes('/vr/') ||
      url.pathname.match(/\.(glb|gltf|bin|hdr)$/i)) {
    return CacheStrategies.cacheFirst(request, CACHES.vr);
  }

  // APIリクエスト: Network First（3秒タイムアウト）
  if (url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/graphql')) {
    return CacheStrategies.networkFirst(request, CACHES.api, 3000);
  }

  // HTMLページ: Stale While Revalidate
  if (request.destination === 'document' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/') {
    return CacheStrategies.staleWhileRevalidate(request, CACHES.dynamic);
  }

  // その他: Network First（5秒タイムアウト）
  return CacheStrategies.networkFirst(request, CACHES.dynamic, 5000);
}

/**
 * 非GETリクエストを処理
 *
 * @param {Request} request - リクエストオブジェクト
 * @returns {Promise<Response>} レスポンス
 */
async function handleNonGetRequest(request) {
  try {
    // ネットワークリクエストを試行
    const response = await fetch(request);
    return response;
  } catch (error) {
    console.warn('[ServiceWorker] Non-GET request failed, queuing:', request.url);

    // オフライン時: バックグラウンド同期キューに追加
    try {
      const body = await request.clone().text();
      await syncManager.addToQueue(request, body);

      // キューイング成功レスポンス
      return new Response(
        JSON.stringify({
          queued: true,
          message: 'リクエストをキューに追加しました。オンライン復帰時に自動送信されます。'
        }),
        {
          status: 202, // Accepted
          statusText: 'Queued for sync',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (queueError) {
      console.error('[ServiceWorker] Failed to queue request:', queueError);
      return new Response(
        JSON.stringify({
          error: 'オフラインです。後でもう一度お試しください。'
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
  }
}

/**
 * バックグラウンド同期イベント
 * オンライン復帰時にキューイングされたリクエストを送信
 */
self.addEventListener('sync', event => {
  console.log('[ServiceWorker] Sync event:', event.tag);

  if (event.tag === 'sync-requests') {
    event.waitUntil(
      syncManager.processQueue()
        .then(results => {
          console.log('[ServiceWorker] Sync complete:', results.length, 'requests processed');
        })
        .catch(error => {
          console.error('[ServiceWorker] Sync failed:', error);
        })
    );
  }
});

/**
 * 定期的なバックグラウンド同期
 * 古いキャッシュエントリとキューアイテムをクリーンアップ
 */
self.addEventListener('periodicsync', event => {
  console.log('[ServiceWorker] Periodic sync event:', event.tag);

  if (event.tag === 'cleanup-cache') {
    event.waitUntil(
      Promise.all([
        // 古いキューアイテムを削除
        syncManager.cleanupOldQueue(),

        // 各キャッシュをクリーンアップ
        CacheStrategies.cleanupCache(CACHES.images, 86400000, 100), // 画像: 24時間, 100件
        CacheStrategies.cleanupCache(CACHES.dynamic, 3600000, 50),   // 動的: 1時間, 50件
        CacheStrategies.cleanupCache(CACHES.api, 1800000, 30)        // API: 30分, 30件
      ])
      .then(() => {
        console.log('[ServiceWorker] Periodic cleanup complete');
      })
    );
  }
});

/**
 * プッシュ通知イベント
 * サーバーからのプッシュ通知を表示
 */
self.addEventListener('push', event => {
  console.log('[ServiceWorker] Push notification received');

  let data = {
    title: 'Qui Browser',
    body: '新しい通知があります',
    icon: '/assets/images/icon-192.png',
    badge: '/assets/images/badge-72.png',
    tag: 'default'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      console.error('[ServiceWorker] Invalid push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/assets/images/icon-192.png',
      badge: data.badge || '/assets/images/badge-72.png',
      tag: data.tag || 'default',
      data: data.url || '/',
      vibrate: [200, 100, 200], // バイブレーションパターン
      actions: data.actions || [
        { action: 'open', title: '開く' },
        { action: 'close', title: '閉じる' }
      ]
    })
  );
});

/**
 * 通知クリックイベント
 * 通知をクリックした時の動作
 */
self.addEventListener('notificationclick', event => {
  console.log('[ServiceWorker] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const url = event.notification.data || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // 既に開いているウィンドウがあればフォーカス
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }

        // なければ新しいウィンドウを開く
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

/**
 * メッセージイベント
 * クライアントからのメッセージを処理
 */
self.addEventListener('message', event => {
  console.log('[ServiceWorker] Message received:', event.data);

  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(
        Promise.all(
          Object.values(CACHES).map(cacheName => caches.delete(cacheName))
        ).then(() => {
          event.ports[0].postMessage({ success: true });
        })
      );
      break;

    case 'GET_CACHE_STATS':
      event.waitUntil(
        Promise.all([
          caches.keys(),
          syncManager.getQueueStats()
        ]).then(([cacheNames, queueStats]) => {
          event.ports[0].postMessage({
            cacheNames,
            queueStats
          });
        })
      );
      break;

    case 'PREFETCH':
      // リソースをプリフェッチ
      if (payload && payload.url) {
        event.waitUntil(
          fetch(payload.url)
            .then(response => {
              if (response.ok) {
                return caches.open(CACHES.dynamic).then(cache => {
                  cache.put(payload.url, response);
                });
              }
            })
            .catch(error => {
              console.error('[ServiceWorker] Prefetch failed:', error);
            })
        );
      }
      break;

    default:
      console.warn('[ServiceWorker] Unknown message type:', type);
  }
});

/**
 * エラーハンドリング
 */
self.addEventListener('error', event => {
  console.error('[ServiceWorker] Error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[ServiceWorker] Unhandled rejection:', event.reason);
});

console.log('[ServiceWorker] Loaded successfully (v' + CACHE_VERSION + ')');
