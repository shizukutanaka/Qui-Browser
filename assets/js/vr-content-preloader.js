/**
 * Qui Browser VR Content Preloader
 * VRコンテンツのプリロードとパフォーマンス最適化
 *
 * 機能:
 * - VRコンテンツの事前読み込み
 * - 3Dモデルの最適化ロード
 * - テクスチャの事前展開
 * - WebXRスクリプトのキャッシュ
 * - ネットワーク要求の並列処理
 */

class VRContentPreloader {
  constructor() {
    this.preloadedContent = new Map();
    this.loadingQueue = new Set();
    this.preloadQueue = [];
    this.maxConcurrentLoads = 3;
    this.currentLoads = 0;
    this.preloadStrategies = {
      eager: 'eager',      // 積極的プリロード
      lazy: 'lazy',        // 遅延プリロード
      predictive: 'predictive'  // 予測的プリロード
    };

    this.init();
  }

  init() {
    // VRコンテンツのプリロード設定
    this.setupPreloadStrategies();
    this.setupNetworkOptimization();

    // WebXRセッション開始時のプリロード
    if (window.WebXRManager) {
      window.WebXRManager.addEventListener('sessionstart', () => this.onVRSessionStart());
      window.WebXRManager.addEventListener('sessionend', () => this.onVRSessionEnd());
    }

    console.log('[VR Preloader] VR Content Preloader initialized');
  }

  /**
   * プリロード戦略の設定
   */
  setupPreloadStrategies() {
    // 予測的プリロード: ユーザーの行動パターンに基づく
    this.setupPredictivePreloading();

    // ネットワーク状態に応じたプリロード調整
    this.setupNetworkAwarePreloading();

    // メモリ使用量の監視と調整
    this.setupMemoryAwarePreloading();
  }

  /**
   * ネットワーク最適化の設定
   */
  setupNetworkOptimization() {
    // Service Workerを使用したキャッシュ戦略
    if ('serviceWorker' in navigator) {
      this.setupServiceWorkerCache();
    }

    // HTTP/2 Server Pushの活用
    this.setupServerPush();

    // CDN最適化
    this.setupCDNOptimization();
  }

  /**
   * VRコンテンツのプリロード
   */
  async preloadVRContent(contentList, strategy = 'eager') {
    if (!Array.isArray(contentList)) {
      contentList = [contentList];
    }

    const preloadPromises = contentList.map(content => this.preloadSingleContent(content, strategy));

    try {
      const results = await Promise.allSettled(preloadPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`[VR Preloader] Preloaded ${successful} contents successfully, ${failed} failed`);

      return { successful, failed, total: contentList.length };
    } catch (error) {
      console.error('[VR Preloader] Preload failed:', error);
      throw error;
    }
  }

  /**
   * 単一コンテンツのプリロード
   */
  async preloadSingleContent(content, strategy) {
    const contentId = this.getContentId(content);

    // 既にプリロード済みかチェック
    if (this.preloadedContent.has(contentId)) {
      return this.preloadedContent.get(contentId);
    }

    // 同時ロード数の制限
    if (this.currentLoads >= this.maxConcurrentLoads) {
      await this.waitForLoadSlot();
    }

    this.currentLoads++;
    this.loadingQueue.add(contentId);

    try {
      const preloadedData = await this.performPreload(content, strategy);

      // プリロード結果の保存
      this.preloadedContent.set(contentId, {
        content,
        data: preloadedData,
        strategy,
        timestamp: Date.now(),
        size: this.estimateContentSize(preloadedData)
      });

      return preloadedData;

    } finally {
      this.currentLoads--;
      this.loadingQueue.delete(contentId);
    }
  }

  /**
   * プリロード実行
   */
  async performPreload(content, strategy) {
    const contentType = this.detectContentType(content);

    switch (contentType) {
      case 'model':
        return this.preload3DModel(content);
      case 'texture':
        return this.preloadTexture(content);
      case 'script':
        return this.preloadScript(content);
      case 'audio':
        return this.preloadAudio(content);
      default:
        return this.preloadGeneric(content);
    }
  }

  /**
   * 3Dモデルのプリロード
   */
  async preload3DModel(modelUrl) {
    try {
      // GLTF/GLBモデルのプリロード
      const response = await fetch(modelUrl, {
        priority: 'high',
        cache: 'force-cache'
      });

      if (!response.ok) {
        throw new Error(`Failed to preload model: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();

      // WebGLコンテキストでの事前処理（利用可能時）
      if (this.hasWebGLContext()) {
        await this.preprocessModel(buffer);
      }

      return {
        type: 'model',
        buffer,
        url: modelUrl,
        processed: true
      };

    } catch (error) {
      console.warn(`[VR Preloader] Failed to preload 3D model ${modelUrl}:`, error);
      throw error;
    }
  }

  /**
   * テクスチャのプリロード
   */
  async preloadTexture(textureUrl) {
    try {
      const response = await fetch(textureUrl, {
        priority: 'high',
        cache: 'force-cache'
      });

      if (!response.ok) {
        throw new Error(`Failed to preload texture: ${response.status}`);
      }

      const blob = await response.blob();

      // ImageBitmapへの変換（利用可能時）
      let imageBitmap = null;
      if ('createImageBitmap' in window) {
        imageBitmap = await createImageBitmap(blob);
      }

      return {
        type: 'texture',
        blob,
        imageBitmap,
        url: textureUrl,
        processed: true
      };

    } catch (error) {
      console.warn(`[VR Preloader] Failed to preload texture ${textureUrl}:`, error);
      throw error;
    }
  }

  /**
   * スクリプトのプリロード
   */
  async preloadScript(scriptUrl) {
    try {
      const response = await fetch(scriptUrl, {
        priority: 'high',
        cache: 'force-cache'
      });

      if (!response.ok) {
        throw new Error(`Failed to preload script: ${response.status}`);
      }

      const text = await response.text();

      // 構文チェック（オプション）
      if (this.shouldValidateScript(text)) {
        this.validateScriptSyntax(text);
      }

      return {
        type: 'script',
        text,
        url: scriptUrl,
        processed: true
      };

    } catch (error) {
      console.warn(`[VR Preloader] Failed to preload script ${scriptUrl}:`, error);
      throw error;
    }
  }

  /**
   * オーディオのプリロード
   */
  async preloadAudio(audioUrl) {
    try {
      const response = await fetch(audioUrl, {
        priority: 'high',
        cache: 'force-cache'
      });

      if (!response.ok) {
        throw new Error(`Failed to preload audio: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // Web Audio APIでの事前デコード（利用可能時）
      let audioBuffer = null;
      if (window.AudioContext || window.webkitAudioContext) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice());
      }

      return {
        type: 'audio',
        arrayBuffer,
        audioBuffer,
        url: audioUrl,
        processed: true
      };

    } catch (error) {
      console.warn(`[VR Preloader] Failed to preload audio ${audioUrl}:`, error);
      throw error;
    }
  }

  /**
   * 汎用コンテンツのプリロード
   */
  async preloadGeneric(contentUrl) {
    try {
      const response = await fetch(contentUrl, {
        priority: 'high',
        cache: 'force-cache'
      });

      if (!response.ok) {
        throw new Error(`Failed to preload content: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      const data = await response.arrayBuffer();

      return {
        type: 'generic',
        contentType,
        data,
        url: contentUrl,
        processed: true
      };

    } catch (error) {
      console.warn(`[VR Preloader] Failed to preload content ${contentUrl}:`, error);
      throw error;
    }
  }

  /**
   * 予測的プリロードの設定
   */
  setupPredictivePreloading() {
    // ユーザーの行動パターンを学習
    this.userPatterns = {
      commonTransitions: new Map(),
      frequentContent: new Set(),
      sessionFlow: []
    };

    // 予測的プリロードの有効化
    document.addEventListener('click', (e) => this.trackUserInteraction(e));
    document.addEventListener('scroll', () => this.trackScrollBehavior());
  }

  /**
   * ネットワーク対応プリロードの設定
   */
  setupNetworkAwarePreloading() {
    // ネットワーク状態の監視
    if ('connection' in navigator) {
      const connection = navigator.connection;

      const updatePreloadStrategy = () => {
        const effectiveType = connection.effectiveType;
        const downlink = connection.downlink;

        // ネットワーク品質に応じたプリロード調整
        if (effectiveType === '4g' && downlink > 5) {
          this.maxConcurrentLoads = 5;
        } else if (effectiveType === '3g' || downlink < 2) {
          this.maxConcurrentLoads = 1;
        } else {
          this.maxConcurrentLoads = 3;
        }
      };

      connection.addEventListener('change', updatePreloadStrategy);
      updatePreloadStrategy();
    }
  }

  /**
   * メモリ対応プリロードの設定
   */
  setupMemoryAwarePreloading() {
    // メモリ使用量の監視
    if ('memory' in performance) {
      setInterval(() => {
        const memoryInfo = performance.memory;
        const usedPercent = (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;

        // メモリ使用率が高い場合はプリロードを制限
        if (usedPercent > 80) {
          this.maxConcurrentLoads = Math.max(1, this.maxConcurrentLoads - 1);
          this.cleanupOldContent();
        } else if (usedPercent < 50) {
          this.maxConcurrentLoads = Math.min(5, this.maxConcurrentLoads + 1);
        }
      }, 10000); // 10秒ごと
    }
  }

  /**
   * Service Workerキャッシュの設定
   */
  setupServiceWorkerCache() {
    // VRコンテンツ用のキャッシュ戦略
    if ('caches' in window) {
      this.cacheName = 'qui-vr-content-cache-v1';

      // キャッシュの定期クリーンアップ
      setInterval(() => this.cleanupCache(), 300000); // 5分ごと
    }
  }

  /**
   * Server Pushの設定
   */
  setupServerPush() {
    // Linkヘッダーを使用したServer Push
    this.pushResources = [
      '/assets/models/default-avatar.glb',
      '/assets/textures/environment.hdr',
      '/assets/scripts/webxr-polyfill.js'
    ];
  }

  /**
   * CDN最適化の設定
   */
  setupCDNOptimization() {
    // CDNエッジロケーションの検出と最適化
    this.detectOptimalCDN();
  }

  /**
   * VRセッション開始時の処理
   */
  onVRSessionStart() {
    console.log('[VR Preloader] VR session started, starting eager preload');

    // VRセッション開始時に重要なコンテンツを積極的にプリロード
    const essentialVRContent = [
      '/assets/models/vr-environment.glb',
      '/assets/textures/vr-ui-atlas.png',
      '/assets/scripts/vr-controls.js'
    ];

    this.preloadVRContent(essentialVRContent, 'eager');
  }

  /**
   * VRセッション終了時の処理
   */
  onVRSessionEnd() {
    console.log('[VR Preloader] VR session ended, cleaning up');

    // セッション終了時にVR固有のコンテンツをクリーンアップ
    this.cleanupVRSpecificContent();
  }

  /**
   * ユーザーインタラクションの追跡
   */
  trackUserInteraction(event) {
    // クリックパターンの学習
    const target = event.target;
    const contentUrl = this.extractContentUrl(target);

    if (contentUrl) {
      this.userPatterns.frequentContent.add(contentUrl);
      this.predictivePreload(contentUrl);
    }
  }

  /**
   * スクロール行動の追跡
   */
  trackScrollBehavior() {
    // スクロールパターンの学習
    // （実装は簡略化）
  }

  /**
   * 予測的プリロード
   */
  predictivePreload(currentContent) {
    // 現在のコンテンツに基づいて次に必要なコンテンツを予測
    const predictedContent = this.predictNextContent(currentContent);

    if (predictedContent) {
      this.preloadVRContent(predictedContent, 'predictive');
    }
  }

  /**
   * 次のコンテンツを予測
   */
  predictNextContent(currentContent) {
    // 簡易的な予測ロジック
    // （実際の実装ではより複雑なアルゴリズムを使用）
    return null;
  }

  /**
   * ロードスロットの待機
   */
  waitForLoadSlot() {
    return new Promise(resolve => {
      const checkSlot = () => {
        if (this.currentLoads < this.maxConcurrentLoads) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  /**
   * コンテンツIDの生成
   */
  getContentId(content) {
    if (typeof content === 'string') {
      return btoa(content).replace(/[^a-zA-Z0-9]/g, '');
    }
    return JSON.stringify(content);
  }

  /**
   * コンテンツタイプの検出
   */
  detectContentType(content) {
    const url = typeof content === 'string' ? content : content.url;

    if (/\.(gltf|glb|obj|fbx)$/i.test(url)) return 'model';
    if (/\.(png|jpg|jpeg|webp|hdr|exr)$/i.test(url)) return 'texture';
    if (/\.(js|mjs)$/i.test(url)) return 'script';
    if (/\.(mp3|wav|ogg|m4a)$/i.test(url)) return 'audio';

    return 'generic';
  }

  /**
   * WebGLコンテキストの確認
   */
  hasWebGLContext() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  /**
   * 3Dモデルの事前処理
   */
  async preprocessModel(buffer) {
    // モデルの基本的な検証と最適化
    // （実際の実装ではthree.jsやbabylon.jsなどのライブラリを使用）
    return buffer;
  }

  /**
   * スクリプト構文の検証
   */
  shouldValidateScript(text) {
    return text.length < 100000; // 100KB未満のみ検証
  }

  /**
   * スクリプト構文の検証
   */
  validateScriptSyntax(text) {
    try {
      new Function(text);
      return true;
    } catch (error) {
      console.warn('[VR Preloader] Script syntax validation failed:', error);
      return false;
    }
  }

  /**
   * コンテンツサイズの推定
   */
  estimateContentSize(data) {
    if (data.buffer) return data.buffer.byteLength;
    if (data.blob) return data.blob.size;
    if (data.text) return data.text.length * 2; // UTF-16推定
    if (data.arrayBuffer) return data.arrayBuffer.byteLength;
    if (data.data) return data.data.byteLength;

    return 0;
  }

  /**
   * コンテンツURLの抽出
   */
  extractContentUrl(element) {
    if (element.tagName === 'A') return element.href;
    if (element.tagName === 'IMG') return element.src;
    if (element.tagName === 'VIDEO') return element.src;
    if (element.tagName === 'SOURCE') return element.src;

    // data属性からの抽出
    return element.dataset?.vrContent || element.dataset?.preload;
  }

  /**
   * キャッシュのクリーンアップ
   */
  async cleanupCache() {
    if (!('caches' in window)) return;

    try {
      const cache = await caches.open(this.cacheName);
      const keys = await cache.keys();

      // 古いエントリの削除（1時間以上前）
      const oneHourAgo = Date.now() - 3600000;

      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const date = response.headers.get('date');
          if (date && new Date(date).getTime() < oneHourAgo) {
            await cache.delete(request);
          }
        }
      }

      console.log('[VR Preloader] Cache cleanup completed');
    } catch (error) {
      console.warn('[VR Preloader] Cache cleanup failed:', error);
    }
  }

  /**
   * 古いコンテンツのクリーンアップ
   */
  cleanupOldContent() {
    const oneHourAgo = Date.now() - 3600000;
    const toDelete = [];

    for (const [id, content] of this.preloadedContent) {
      if (content.timestamp < oneHourAgo) {
        toDelete.push(id);
      }
    }

    toDelete.forEach(id => this.preloadedContent.delete(id));

    if (toDelete.length > 0) {
      console.log(`[VR Preloader] Cleaned up ${toDelete.length} old content items`);
    }
  }

  /**
   * VR固有コンテンツのクリーンアップ
   */
  cleanupVRSpecificContent() {
    // VRセッション固有のコンテンツをクリーンアップ
    const vrContentIds = Array.from(this.preloadedContent.keys())
      .filter(id => id.includes('vr-') || id.includes('webxr'));

    vrContentIds.forEach(id => this.preloadedContent.delete(id));

    console.log(`[VR Preloader] Cleaned up ${vrContentIds.length} VR-specific content items`);
  }

  /**
   * 最適CDNの検出
   */
  async detectOptimalCDN() {
    // CDNパフォーマンスの測定と最適化
    // （実装は簡略化）
    this.optimalCDN = 'default';
  }

  /**
   * プリロード統計の取得
   */
  getStats() {
    return {
      preloadedContent: this.preloadedContent.size,
      loadingQueue: this.loadingQueue.size,
      currentLoads: this.currentLoads,
      maxConcurrentLoads: this.maxConcurrentLoads,
      totalPreloadedSize: Array.from(this.preloadedContent.values())
        .reduce((total, content) => total + (content.size || 0), 0)
    };
  }

  /**
   * プリロードされたコンテンツの取得
   */
  getPreloadedContent(contentId) {
    return this.preloadedContent.get(contentId);
  }

  /**
   * 全てのプリロードコンテンツのクリア
   */
  clearAll() {
    this.preloadedContent.clear();
    this.loadingQueue.clear();
    this.preloadQueue.length = 0;
    this.currentLoads = 0;

    console.log('[VR Preloader] All preloaded content cleared');
  }
}

// グローバルインスタンス作成
const vrContentPreloader = new VRContentPreloader();

// グローバルアクセス用
window.vrContentPreloader = vrContentPreloader;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[VR Preloader] VR Content Preloader initialized');
});
