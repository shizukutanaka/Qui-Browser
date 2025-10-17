/**
 * Qui Browser VR Offline Storage
 * VRコンテンツ専用オフライン保存機能
 *
 * 機能:
 * - VRコンテンツのオフライン保存
 * - Service Workerによるキャッシュ管理
 * - 自動コンテンツ更新
 * - ストレージ使用量最適化
 * - オフライン時のフォールバック
 * - コンテンツ同期管理
 */

class VROfflineStorage {
  constructor() {
    this.cacheName = 'qui-vr-content-v1';
    this.maxCacheSize = 500 * 1024 * 1024; // 500MB
    this.currentCacheSize = 0;
    this.isOnline = navigator.onLine;
    this.syncQueue = new Set();
    this.contentRegistry = new Map();

    // VRコンテンツタイプ
    this.vrContentTypes = {
      model: ['.gltf', '.glb', '.obj', '.fbx'],
      texture: ['.png', '.jpg', '.jpeg', '.webp', '.hdr', '.exr'],
      audio: ['.mp3', '.wav', '.ogg', '.m4a'],
      script: ['.js', '.mjs'],
      config: ['.json', '.xml']
    };

    this.init();
  }

  init() {
    // Service Workerの登録確認
    this.checkServiceWorkerSupport();

    // オフラインイベントの監視
    this.setupOfflineEvents();

    // ストレージ監視
    this.setupStorageMonitoring();

    // VRコンテンツの自動キャッシュ設定
    this.setupVRContentCaching();

    console.log('[VR Offline] VR Offline Storage initialized');
  }

  /**
   * Service Workerサポート確認
   */
  async checkServiceWorkerSupport() {
    if ('serviceWorker' in navigator) {
      try {
        // Service Workerの登録
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[VR Offline] Service Worker registered:', registration.scope);

        // Service Workerメッセージの監視
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event);
        });

        this.serviceWorker = registration;

      } catch (error) {
        console.error('[VR Offline] Service Worker registration failed:', error);
        this.fallbackToCacheAPI();
      }
    } else {
      console.warn('[VR Offline] Service Worker not supported, using Cache API fallback');
      this.fallbackToCacheAPI();
    }
  }

  /**
   * Cache APIフォールバック
   */
  async fallbackToCacheAPI() {
    if ('caches' in window) {
      console.log('[VR Offline] Using Cache API for offline storage');
      this.useCacheAPI = true;

      // キャッシュの初期化
      await this.initializeCache();

    } else {
      console.warn('[VR Offline] Cache API not supported');
    }
  }

  /**
   * キャッシュ初期化
   */
  async initializeCache() {
    try {
      this.cache = await caches.open(this.cacheName);

      // 既存キャッシュのサイズ計算
      await this.calculateCacheSize();

      console.log(`[VR Offline] Cache initialized, current size: ${(this.currentCacheSize / 1024 / 1024).toFixed(2)}MB`);

    } catch (error) {
      console.error('[VR Offline] Cache initialization failed:', error);
    }
  }

  /**
   * オフラインイベントの設定
   */
  setupOfflineEvents() {
    window.addEventListener('online', () => {
      console.log('[VR Offline] Connection restored');
      this.isOnline = true;
      this.onConnectionRestored();
    });

    window.addEventListener('offline', () => {
      console.log('[VR Offline] Connection lost');
      this.isOnline = false;
      this.onConnectionLost();
    });

    // ページ表示時のオフラインコンテンツ読み込み
    window.addEventListener('load', () => {
      if (!this.isOnline) {
        this.loadOfflineContent();
      }
    });
  }

  /**
   * ストレージ監視の設定
   */
  setupStorageMonitoring() {
    // ストレージ使用量の定期監視
    setInterval(() => {
      this.monitorStorageUsage();
    }, 60000); // 1分ごと

    // ストレージ不足イベント
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.addEventListener('quotaexceeded', () => {
        console.warn('[VR Offline] Storage quota exceeded');
        this.handleStorageQuotaExceeded();
      });
    }
  }

  /**
   * VRコンテンツキャッシュの設定
   */
  setupVRContentCaching() {
    // VRコンテンツの自動キャッシュ戦略
    this.cachingStrategies = {
      essential: {
        priority: 'high',
        maxAge: 24 * 60 * 60 * 1000, // 24時間
        retryCount: 3
      },
      important: {
        priority: 'medium',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7日
        retryCount: 2
      },
      optional: {
        priority: 'low',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30日
        retryCount: 1
      }
    };

    console.log('[VR Offline] VR content caching strategies configured');
  }

  /**
   * VRコンテンツの保存
   */
  async storeVRContent(url, options = {}) {
    if (!url) return false;

    const contentId = this.generateContentId(url);
    const strategy = options.strategy || this.determineCachingStrategy(url);

    try {
      // コンテンツタイプの判定
      const contentType = this.determineContentType(url);

      // キャッシュエントリの作成
      const cacheEntry = {
        id: contentId,
        url: url,
        type: contentType,
        strategy: strategy,
        timestamp: Date.now(),
        size: 0,
        metadata: options.metadata || {}
      };

      // コンテンツのダウンロードと保存
      const success = await this.downloadAndCache(url, cacheEntry);

      if (success) {
        // レジストリに登録
        this.contentRegistry.set(contentId, cacheEntry);
        console.log(`[VR Offline] VR content stored: ${url} (${contentType})`);

        return contentId;
      }

    } catch (error) {
      console.error(`[VR Offline] Failed to store VR content ${url}:`, error);
    }

    return false;
  }

  /**
   * コンテンツのダウンロードとキャッシュ
   */
  async downloadAndCache(url, cacheEntry) {
    try {
      const response = await fetch(url, {
        cache: 'force-cache',
        priority: 'high'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // レスポンスのクローン作成
      const responseClone = response.clone();

      // サイズ計算
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        cacheEntry.size = parseInt(contentLength, 10);
      }

      // キャッシュサイズチェック
      if (!await this.checkCacheSpace(cacheEntry.size)) {
        console.warn('[VR Offline] Insufficient cache space');
        await this.makeCacheSpace(cacheEntry.size);
      }

      // Service Worker経由でのキャッシュ
      if (this.serviceWorker) {
        await this.cacheViaServiceWorker(url, responseClone, cacheEntry);
      } else if (this.useCacheAPI) {
        await this.cache.put(url, responseClone);
        this.currentCacheSize += cacheEntry.size;
      }

      return true;

    } catch (error) {
      console.error(`[VR Offline] Download failed for ${url}:`, error);
      return false;
    }
  }

  /**
   * Service Worker経由でのキャッシュ
   */
  async cacheViaServiceWorker(url, response, cacheEntry) {
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          this.currentCacheSize += cacheEntry.size;
          resolve(true);
        } else {
          resolve(false);
        }
      };

      // Service Workerにキャッシュ要求を送信
      this.serviceWorker.active.postMessage({
        type: 'CACHE_CONTENT',
        url: url,
        response: response,
        entry: cacheEntry
      }, [messageChannel.port2]);
    });
  }

  /**
   * VRコンテンツの取得
   */
  async getVRContent(contentId) {
    try {
      const cacheEntry = this.contentRegistry.get(contentId);

      if (!cacheEntry) {
        console.warn(`[VR Offline] Content not found: ${contentId}`);
        return null;
      }

      // キャッシュの有効性チェック
      if (!this.isCacheEntryValid(cacheEntry)) {
        console.log(`[VR Offline] Cache entry expired: ${contentId}`);
        await this.removeVRContent(contentId);
        return null;
      }

      // Service Worker経由での取得
      if (this.serviceWorker) {
        return await this.getFromServiceWorker(cacheEntry.url);
      } else if (this.useCacheAPI) {
        const response = await this.cache.match(cacheEntry.url);
        return response || null;
      }

    } catch (error) {
      console.error(`[VR Offline] Failed to get VR content ${contentId}:`, error);
    }

    return null;
  }

  /**
   * Service Workerからのコンテンツ取得
   */
  async getFromServiceWorker(url) {
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.response || null);
      };

      this.serviceWorker.active.postMessage({
        type: 'GET_CACHED_CONTENT',
        url: url
      }, [messageChannel.port2]);
    });
  }

  /**
   * VRコンテンツの削除
   */
  async removeVRContent(contentId) {
    try {
      const cacheEntry = this.contentRegistry.get(contentId);

      if (!cacheEntry) return false;

      // Service Worker経由での削除
      if (this.serviceWorker) {
        await this.removeViaServiceWorker(cacheEntry.url);
      } else if (this.useCacheAPI) {
        await this.cache.delete(cacheEntry.url);
        this.currentCacheSize -= cacheEntry.size;
      }

      // レジストリから削除
      this.contentRegistry.delete(contentId);

      console.log(`[VR Offline] VR content removed: ${contentId}`);

      return true;

    } catch (error) {
      console.error(`[VR Offline] Failed to remove VR content ${contentId}:`, error);
      return false;
    }
  }

  /**
   * Service Worker経由での削除
   */
  async removeViaServiceWorker(url) {
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          // サイズ更新（Service Workerからの応答に基づく）
          this.currentCacheSize -= event.data.sizeRemoved || 0;
        }
        resolve(event.data.success || false);
      };

      this.serviceWorker.active.postMessage({
        type: 'REMOVE_CACHED_CONTENT',
        url: url
      }, [messageChannel.port2]);
    });
  }

  /**
   * キャッシュエントリの有効性チェック
   */
  isCacheEntryValid(cacheEntry) {
    const now = Date.now();
    const maxAge = this.cachingStrategies[cacheEntry.strategy]?.maxAge || 24 * 60 * 60 * 1000;

    return (now - cacheEntry.timestamp) < maxAge;
  }

  /**
   * キャッシュスペースのチェック
   */
  async checkCacheSpace(requiredSize) {
    const availableSpace = this.maxCacheSize - this.currentCacheSize;
    return availableSpace >= requiredSize;
  }

  /**
   * キャッシュスペースの確保
   */
  async makeCacheSpace(requiredSize) {
    const entries = Array.from(this.contentRegistry.values())
      .sort((a, b) => {
        // 優先度と使用頻度でソート
        const priorityOrder = { low: 1, medium: 2, high: 3 };
        const aPriority = priorityOrder[a.strategy] || 1;
        const bPriority = priorityOrder[b.strategy] || 1;

        if (aPriority !== bPriority) return aPriority - bPriority;

        return a.timestamp - b.timestamp; // 古いものから削除
      });

    let freedSpace = 0;

    for (const entry of entries) {
      if (freedSpace >= requiredSize) break;

      await this.removeVRContent(entry.id);
      freedSpace += entry.size;
    }

    console.log(`[VR Offline] Freed ${(freedSpace / 1024 / 1024).toFixed(2)}MB of cache space`);
  }

  /**
   * キャッシュサイズの計算
   */
  async calculateCacheSize() {
    if (this.serviceWorker) {
      // Service Workerにサイズ計算を依頼
      return new Promise((resolve) => {
        const messageChannel = new MessageChannel();

        messageChannel.port1.onmessage = (event) => {
          this.currentCacheSize = event.data.totalSize || 0;
          resolve(this.currentCacheSize);
        };

        this.serviceWorker.active.postMessage({
          type: 'CALCULATE_CACHE_SIZE'
        }, [messageChannel.port2]);
      });
    } else if (this.useCacheAPI) {
      // Cache APIでサイズ計算
      const keys = await this.cache.keys();
      let totalSize = 0;

      for (const request of keys) {
        try {
          const response = await this.cache.match(request);
          if (response) {
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
              totalSize += parseInt(contentLength, 10);
            }
          }
        } catch (error) {
          console.warn('[VR Offline] Error calculating cache size:', error);
        }
      }

      this.currentCacheSize = totalSize;
      return totalSize;
    }

    return 0;
  }

  /**
   * キャッシュ戦略の決定
   */
  determineCachingStrategy(url) {
    // URLパターンに基づく戦略決定
    if (url.includes('/essential/') || url.includes('environment')) {
      return 'essential';
    } else if (url.includes('/models/') || url.includes('/textures/')) {
      return 'important';
    } else {
      return 'optional';
    }
  }

  /**
   * コンテンツタイプの判定
   */
  determineContentType(url) {
    const extension = url.split('.').pop()?.toLowerCase();

    for (const [type, extensions] of Object.entries(this.vrContentTypes)) {
      if (extensions.some(ext => ext === `.${extension}`)) {
        return type;
      }
    }

    return 'unknown';
  }

  /**
   * コンテンツID生成
   */
  generateContentId(url) {
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * ストレージ使用量監視
   */
  async monitorStorageUsage() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();

        const usedPercent = (estimate.usage / estimate.quota) * 100;

        if (usedPercent > 90) {
          console.warn(`[VR Offline] Storage usage high: ${usedPercent.toFixed(1)}%`);
          await this.optimizeStorage();
        }

        // 現在のキャッシュサイズも更新
        await this.calculateCacheSize();

      }
    } catch (error) {
      console.warn('[VR Offline] Storage monitoring failed:', error);
    }
  }

  /**
   * ストレージ最適化
   */
  async optimizeStorage() {
    // 古いコンテンツの削除
    const oldEntries = Array.from(this.contentRegistry.values())
      .filter(entry => (Date.now() - entry.timestamp) > 7 * 24 * 60 * 60 * 1000); // 7日以上前

    for (const entry of oldEntries) {
      await this.removeVRContent(entry.id);
    }

    console.log(`[VR Offline] Optimized storage, removed ${oldEntries.length} old entries`);
  }

  /**
   * ストレージクォータ超過処理
   */
  async handleStorageQuotaExceeded() {
    console.warn('[VR Offline] Storage quota exceeded, cleaning up');

    // 最も古いコンテンツから削除
    const entries = Array.from(this.contentRegistry.values())
      .sort((a, b) => a.timestamp - b.timestamp);

    let removedCount = 0;
    let freedSpace = 0;
    const targetFreeSpace = this.maxCacheSize * 0.2; // 20%空ける

    for (const entry of entries) {
      if (freedSpace >= targetFreeSpace) break;

      await this.removeVRContent(entry.id);
      removedCount++;
      freedSpace += entry.size;
    }

    console.log(`[VR Offline] Storage cleanup completed, removed ${removedCount} entries, freed ${(freedSpace / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * 接続回復時の処理
   */
  async onConnectionRestored() {
    console.log('[VR Offline] Connection restored, syncing offline changes');

    // オフライン時にキューイングされた操作の実行
    await this.syncOfflineChanges();

    // コンテンツの更新チェック
    await this.checkContentUpdates();
  }

  /**
   * 接続切断時の処理
   */
  onConnectionLost() {
    console.log('[VR Offline] Connection lost, enabling offline mode');

    // オフラインコンテンツの読み込み
    this.loadOfflineContent();
  }

  /**
   * オフラインコンテンツの読み込み
   */
  async loadOfflineContent() {
    try {
      // キャッシュされたVRコンテンツのリストを取得
      const cachedContent = Array.from(this.contentRegistry.values());

      if (cachedContent.length > 0) {
        console.log(`[VR Offline] Loading ${cachedContent.length} cached VR contents for offline use`);

        // オフライン使用可能なコンテンツを通知
        if (window.UIComponents && window.UIComponents.Toast) {
          const toast = new window.UIComponents.Toast();
          toast.show({
            type: 'info',
            title: 'オフライン対応',
            message: `${cachedContent.length}件のVRコンテンツがオフラインで利用可能です`,
            duration: 5000
          });
        }
      }

    } catch (error) {
      console.error('[VR Offline] Failed to load offline content:', error);
    }
  }

  /**
   * オフライン変更の同期
   */
  async syncOfflineChanges() {
    if (this.syncQueue.size === 0) return;

    console.log(`[VR Offline] Syncing ${this.syncQueue.size} offline changes`);

    // 同期キューを処理
    for (const change of this.syncQueue) {
      try {
        await this.processSyncChange(change);
      } catch (error) {
        console.error('[VR Offline] Sync failed for change:', change, error);
      }
    }

    this.syncQueue.clear();
  }

  /**
   * コンテンツ更新チェック
   */
  async checkContentUpdates() {
    const entries = Array.from(this.contentRegistry.values());

    for (const entry of entries) {
      try {
        const response = await fetch(entry.url, {
          method: 'HEAD',
          cache: 'no-cache'
        });

        if (response.ok) {
          const lastModified = response.headers.get('last-modified');
          const contentLength = response.headers.get('content-length');

          // 更新チェック（簡易）
          if (contentLength && parseInt(contentLength) !== entry.size) {
            console.log(`[VR Offline] Content updated: ${entry.url}`);
            // 必要に応じて再キャッシュ
          }
        }

      } catch (error) {
        // ネットワークエラーは無視
      }
    }
  }

  /**
   * Service Workerメッセージ処理
   */
  handleServiceWorkerMessage(event) {
    const { type, data } = event.data;

    switch (type) {
      case 'CACHE_SIZE_UPDATE':
        this.currentCacheSize = data.totalSize;
        break;

      case 'CONTENT_CACHED':
        console.log('[VR Offline] Content cached via Service Worker:', data.url);
        break;

      case 'CACHE_ERROR':
        console.error('[VR Offline] Cache error via Service Worker:', data.error);
        break;

      default:
        console.log('[VR Offline] Unknown Service Worker message:', type);
    }
  }

  /**
   * 同期変更処理
   */
  async processSyncChange(change) {
    // 同期処理の実装（必要に応じて拡張）
    console.log('[VR Offline] Processing sync change:', change);
  }

  /**
   * VRコンテンツの事前キャッシュ
   */
  async precacheVRContent(contentList, priority = 'medium') {
    console.log(`[VR Offline] Precaching ${contentList.length} VR contents with ${priority} priority`);

    const results = await Promise.allSettled(
      contentList.map(url => this.storeVRContent(url, { strategy: priority }))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[VR Offline] Precaching completed: ${successful} success, ${failed} failed`);

    return { successful, failed, total: contentList.length };
  }

  /**
   * キャッシュ統計取得
   */
  getCacheStats() {
    return {
      totalSize: this.currentCacheSize,
      totalSizeMB: (this.currentCacheSize / 1024 / 1024).toFixed(2),
      maxSize: this.maxCacheSize,
      maxSizeMB: (this.maxCacheSize / 1024 / 1024).toFixed(2),
      usagePercent: ((this.currentCacheSize / this.maxCacheSize) * 100).toFixed(1),
      contentCount: this.contentRegistry.size,
      isOnline: this.isOnline,
      cacheType: this.serviceWorker ? 'service-worker' : (this.useCacheAPI ? 'cache-api' : 'none')
    };
  }

  /**
   * キャッシュコンテンツ一覧取得
   */
  getCachedContent() {
    return Array.from(this.contentRegistry.values()).map(entry => ({
      id: entry.id,
      url: entry.url,
      type: entry.type,
      strategy: entry.strategy,
      timestamp: entry.timestamp,
      size: entry.size,
      sizeMB: (entry.size / 1024 / 1024).toFixed(2)
    }));
  }

  /**
   * キャッシュクリア
   */
  async clearCache() {
    try {
      if (this.serviceWorker) {
        await new Promise((resolve) => {
          const messageChannel = new MessageChannel();

          messageChannel.port1.onmessage = (event) => {
            resolve(event.data.success);
          };

          this.serviceWorker.active.postMessage({
            type: 'CLEAR_CACHE'
          }, [messageChannel.port2]);
        });
      } else if (this.useCacheAPI) {
        await this.cache.delete(this.cacheName);
        await this.initializeCache();
      }

      this.contentRegistry.clear();
      this.currentCacheSize = 0;

      console.log('[VR Offline] Cache cleared');

    } catch (error) {
      console.error('[VR Offline] Cache clear failed:', error);
    }
  }
}

// グローバルインスタンス作成
const vrOfflineStorage = new VROfflineStorage();

// グローバルアクセス用
window.vrOfflineStorage = vrOfflineStorage;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[VR Offline] VR Offline Storage initialized');
});
