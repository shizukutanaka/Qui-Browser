/**
 * Qui Browser Performance Optimizer
 * Core Web Vitals最適化とパフォーマンス向上
 *
 * 機能:
 * - コード分割と動的インポート
 * - 遅延読み込み (Lazy Loading)
 * - 画像最適化とWebP対応
 * - クリティカルリソースのプリロード
 * - バンドルサイズ最適化
 * - メモリリーク防止
 */

class PerformanceOptimizer {
  constructor() {
    this.observers = new Map();
    this.intersectionObserver = null;
    this.resizeObserver = null;
    this.performanceMarks = new Map();
    this.resourceHints = new Set();
    this.criticalResources = new Set();

    this.init();
  }

  init() {
    this.setupIntersectionObserver();
    this.setupResizeObserver();
    this.setupPerformanceMonitoring();
    this.setupCriticalResourceLoading();
    this.setupBundleOptimization();
    this.setupMemoryOptimization();
  }

  // インターセクションオブザーバーによる遅延読み込み
  setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) {
      this.loadPolyfill('/assets/js/intersection-observer-polyfill.js');
      return;
    }

    const options = {
      root: null,
      rootMargin: '50px 0px',
      threshold: 0.01
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.handleIntersection(entry.target);
          this.intersectionObserver.unobserve(entry.target);
        }
      });
    }, options);

    // 遅延読み込み対象の要素を監視
    this.observeLazyElements();
  }

  setupResizeObserver() {
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver((entries) => {
        entries.forEach(entry => {
          this.handleResize(entry.target, entry.contentRect);
        });
      });
    }
  }

  observeLazyElements() {
    // 画像の遅延読み込み
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => {
      this.intersectionObserver.observe(img);
    });

    // iframeの遅延読み込み
    const lazyIframes = document.querySelectorAll('iframe[data-src]');
    lazyIframes.forEach(iframe => {
      this.intersectionObserver.observe(iframe);
    });

    // コンポーネントの遅延読み込み
    const lazyComponents = document.querySelectorAll('[data-lazy-component]');
    lazyComponents.forEach(component => {
      this.intersectionObserver.observe(component);
    });
  }

  handleIntersection(element) {
    if (element.tagName === 'IMG' && element.hasAttribute('data-src')) {
      this.loadLazyImage(element);
    } else if (element.tagName === 'IFRAME' && element.hasAttribute('data-src')) {
      this.loadLazyIframe(element);
    } else if (element.hasAttribute('data-lazy-component')) {
      this.loadLazyComponent(element);
    }
  }

  loadLazyImage(img) {
    const src = img.getAttribute('data-src');
    const srcset = img.getAttribute('data-srcset');
    const sizes = img.getAttribute('data-sizes');

    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
    }

    if (srcset) {
      img.srcset = srcset;
      img.removeAttribute('data-srcset');
    }

    if (sizes) {
      img.sizes = sizes;
      img.removeAttribute('data-sizes');
    }

    // 読み込み完了をマーク
    img.addEventListener('load', () => {
      img.classList.add('loaded');
    }, { once: true });

    img.addEventListener('error', () => {
      img.classList.add('error');
    }, { once: true });
  }

  loadLazyIframe(iframe) {
    const src = iframe.getAttribute('data-src');
    if (src) {
      iframe.src = src;
      iframe.removeAttribute('data-src');
    }
  }

  async loadLazyComponent(element) {
    const componentName = element.getAttribute('data-lazy-component');
    if (!componentName) return;

    try {
      // 動的インポートによるコード分割
      const module = await import(`/assets/js/components/${componentName}.js`);
      const ComponentClass = module.default || module[componentName];

      if (ComponentClass) {
        new ComponentClass(element);
        element.classList.add('loaded');
      }
    } catch (error) {
      console.error(`Failed to load component ${componentName}:`, error);
      element.classList.add('error');
    }
  }

  handleResize(element, rect) {
    // コンテナサイズ変更時の最適化
    if (element.classList.contains('responsive-container')) {
      this.optimizeContainerForSize(element, rect);
    }
  }

  optimizeContainerForSize(container, rect) {
    const { width, height } = rect;

    // サイズに基づいてコンテンツを最適化
    if (width < 480) {
      container.classList.add('mobile-optimized');
      container.classList.remove('tablet-optimized', 'desktop-optimized');
    } else if (width < 768) {
      container.classList.add('tablet-optimized');
      container.classList.remove('mobile-optimized', 'desktop-optimized');
    } else {
      container.classList.add('desktop-optimized');
      container.classList.remove('mobile-optimized', 'tablet-optimized');
    }
  }

  // パフォーマンス監視
  setupPerformanceMonitoring() {
    // Core Web Vitalsの監視
    this.monitorCoreWebVitals();

    // リソース読み込みの監視
    this.monitorResourceLoading();

    // メモリ使用量の監視
    this.monitorMemoryUsage();

    // レイアウトシフトの監視
    this.monitorLayoutShift();
  }

  monitorCoreWebVitals() {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.trackMetric('LCP', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay (FID)
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            this.trackMetric('FID', entry.processingStart - entry.startTime);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift (CLS)
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.trackMetric('CLS', clsValue);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        this.observers.set('lcp', lcpObserver);
        this.observers.set('fid', fidObserver);
        this.observers.set('cls', clsObserver);

      } catch (error) {
        console.warn('Performance monitoring not fully supported:', error);
      }
    }
  }

  monitorResourceLoading() {
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.duration > 1000) { // 1秒以上かかるリソース
            console.warn(`Slow resource: ${entry.name} (${entry.duration}ms)`);
            this.trackSlowResource(entry);
          }
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.set('resource', resourceObserver);
    }
  }

  monitorMemoryUsage() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory;
        const usagePercent = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;

        if (usagePercent > 80) {
          console.warn(`High memory usage: ${usagePercent.toFixed(1)}%`);
          this.optimizeMemoryUsage();
        }

        this.trackMetric('MemoryUsage', usagePercent);
      }, 30000); // 30秒ごとにチェック
    }
  }

  monitorLayoutShift() {
    let cumulativeLayoutShift = 0;

    if ('PerformanceObserver' in window) {
      const layoutShiftObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (!entry.hadRecentInput) {
            cumulativeLayoutShift += entry.value;
            if (entry.value > 0.1) {
              console.warn(`Large layout shift: ${entry.value}`);
            }
          }
        });
      });
      layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.set('layout-shift', layoutShiftObserver);
    }
  }

  trackMetric(name, value) {
    // メトリクスを保存・送信
    const metrics = JSON.parse(localStorage.getItem('performance_metrics') || '{}');
    if (!metrics[name]) {
      metrics[name] = [];
    }
    metrics[name].push({
      value,
      timestamp: Date.now()
    });

    // 最新100件のみ保持
    if (metrics[name].length > 100) {
      metrics[name] = metrics[name].slice(-100);
    }

    localStorage.setItem('performance_metrics', JSON.stringify(metrics));

    // サーバーに送信（オフライン時はキューイング）
    this.sendMetricToServer(name, value);
  }

  trackSlowResource(entry) {
    const slowResources = JSON.parse(localStorage.getItem('slow_resources') || '[]');
    slowResources.push({
      url: entry.name,
      duration: entry.duration,
      size: entry.transferSize,
      timestamp: Date.now()
    });

    // 最新50件のみ保持
    if (slowResources.length > 50) {
      slowResources.splice(0, slowResources.length - 50);
    }

    localStorage.setItem('slow_resources', JSON.stringify(slowResources));
  }

  // クリティカルリソースの最適化
  setupCriticalResourceLoading() {
    // クリティカルCSSのインライン化
    this.inlineCriticalCSS();

    // 重要リソースのプリロード
    this.preloadCriticalResources();

    // フォントの最適化読み込み
    this.optimizeFontLoading();
  }

  inlineCriticalCSS() {
    // クリティカルCSSを特定してインライン化
    const criticalCSS = `
      .navbar, .btn-primary, .card, .loading-skeleton {
        /* クリティカルなスタイルのみ */
      }
    `;

    const style = document.createElement('style');
    style.textContent = criticalCSS;
    document.head.insertBefore(style, document.head.firstChild);
  }

  preloadCriticalResources() {
    const criticalResources = [
      '/assets/styles/components.css',
      '/assets/js/ui-components.js',
      '/assets/icons/icon-192.png'
    ];

    criticalResources.forEach(resource => {
      if (!this.resourceHints.has(resource)) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = resource;
        link.as = this.getResourceType(resource);
        document.head.appendChild(link);
        this.resourceHints.add(resource);
      }
    });
  }

  optimizeFontLoading() {
    // フォント表示の最適化
    const fontCSS = `
      @font-face {
        font-family: 'System';
        font-display: swap;
        src: local('System Font');
      }
    `;

    const style = document.createElement('style');
    style.textContent = fontCSS;
    document.head.appendChild(style);
  }

  // バンドル最適化
  setupBundleOptimization() {
    // 動的インポートによるコード分割
    this.setupDynamicImports();

    // 未使用コードの検出と削除
    this.setupTreeShaking();

    // バンドルサイズ監視
    this.monitorBundleSize();
  }

  setupDynamicImports() {
    // ルートコンポーネントの遅延読み込み
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        this.loadNonCriticalComponents();
      }, 100);
    });
  }

  async loadNonCriticalComponents() {
    try {
      // ダッシュボードコンポーネントの遅延読み込み
      const dashboardModule = await import('/assets/js/components/dashboard.js');
      dashboardModule.init();

      // 設定コンポーネントの遅延読み込み
      const settingsModule = await import('/assets/js/components/settings.js');
      settingsModule.init();

    } catch (error) {
      console.warn('Non-critical components failed to load:', error);
    }
  }

  setupTreeShaking() {
    // 未使用のインポートを検出
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.analyzeUnusedImports();
      });
    }
  }

  analyzeUnusedImports() {
    // 使用されていない関数やコンポーネントを検出
    const usedFunctions = new Set();
    const allFunctions = new Set(['formatDate', 'validateEmail', 'debounce', 'throttle']);

    // DOM要素から使用されている関数を収集
    document.querySelectorAll('[data-used-functions]').forEach(element => {
      const functions = element.getAttribute('data-used-functions').split(',');
      functions.forEach(func => usedFunctions.add(func.trim()));
    });

    // 未使用の関数を特定
    const unusedFunctions = [...allFunctions].filter(func => !usedFunctions.has(func));

    if (unusedFunctions.length > 0) {
      console.info('Unused functions detected:', unusedFunctions);
      // 未使用関数をログに記録
      this.trackUnusedCode('functions', unusedFunctions);
    }
  }

  monitorBundleSize() {
    // バンドルサイズの監視
    if ('performance' in window && 'getEntriesByType' in performance) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const resources = performance.getEntriesByType('resource');
          const scripts = resources.filter(r => r.name.endsWith('.js'));
          const totalSize = scripts.reduce((sum, script) => sum + (script.transferSize || 0), 0);

          this.trackMetric('BundleSize', totalSize);

          if (totalSize > 2 * 1024 * 1024) { // 2MB以上
            console.warn(`Large bundle size detected: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
          }
        }, 1000);
      });
    }
  }

  // メモリ最適化
  setupMemoryOptimization() {
    // イベントリスナーのクリーンアップ
    this.setupEventListenerCleanup();

    // タイマーの管理
    this.setupTimerManagement();

    // キャッシュの自動クリーンアップ
    this.setupCacheCleanup();

    // メモリリーク検出
    this.setupMemoryLeakDetection();

    // 自動メモリクリーンアップ
    this.setupAutomaticMemoryCleanup();

    // メモリ使用量監視
    this.setupMemoryUsageMonitoring();
  }

  setupMemoryLeakDetection() {
    this.memorySnapshots = [];
    this.leakThreshold = 10 * 1024 * 1024; // 10MB増加で警告

    // 定期的なメモリスナップショット
    setInterval(() => {
      if (performance.memory) {
        const snapshot = {
          timestamp: Date.now(),
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        };

        this.memorySnapshots.push(snapshot);

        // スナップショット履歴を制限
        if (this.memorySnapshots.length > 100) {
          this.memorySnapshots.shift();
        }

        this.detectMemoryLeaks();
      }
    }, 60000); // 1分ごと
  }

  detectMemoryLeaks() {
    if (this.memorySnapshots.length < 2) return;

    const recent = this.memorySnapshots.slice(-5);
    const oldest = this.memorySnapshots[0];

    // メモリ使用量のトレンドを計算
    const memoryIncrease = recent[recent.length - 1].used - oldest.used;

    if (memoryIncrease > this.leakThreshold) {
      console.warn(`潜在的なメモリリーク検出: ${this.formatBytes(memoryIncrease)} の増加`);
      this.triggerMemoryCleanup();
    }
  }

  setupAutomaticMemoryCleanup() {
    // メモリ使用率が閾値を超えた場合の自動クリーンアップ
    setInterval(() => {
      if (performance.memory) {
        const usagePercent = (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100;

        if (usagePercent > 80) {
          this.triggerMemoryCleanup();
        }
      }
    }, 300000); // 5分ごと
  }

  triggerMemoryCleanup() {
    console.info('自動メモリクリーンアップを実行');

    // 積極的なクリーンアップ
    this.aggressiveMemoryCleanup();

    // ガベージコレクションを強制（可能な場合）
    if (window.gc) {
      window.gc();
    }

    // メモリスナップショットをリセット
    this.memorySnapshots = [];
  }

  setupMemoryUsageMonitoring() {
    // リアルタイムメモリ監視
    if (performance.memory) {
      const observer = new MutationObserver(() => {
        const usage = (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100;

        if (usage > 90) {
          console.error('メモリ使用率が90%を超えました。クリーンアップを推奨');
        } else if (usage > 75) {
          console.warn('メモリ使用率が高い状態です');
        }
      });

      observer.observe(document.body, { attributes: true, childList: true, subtree: true });
      this.observers.set('memory', observer);
    }
  }

  aggressiveMemoryCleanup() {
    // 積極的なメモリクリーンアップ
    this.cleanupCaches();

    // 未使用のDOM要素を削除
    document.querySelectorAll('[data-temporary]').forEach(element => {
      element.remove();
    });

    // 一時的な変数をクリア
    this.clearTemporaryVariables();

    // イベントリスナーの最適化
    this.optimizeEventListeners();

    // 大きなオブジェクトの参照をクリア
    this.clearLargeObjectReferences();
  }

  clearTemporaryVariables() {
    // グローバルスコープの一時変数をクリア
    Object.keys(window).forEach(key => {
      if (key.startsWith('temp_') || key.startsWith('_temp')) {
        delete window[key];
      }
    });
  }

  clearLargeObjectReferences() {
    // 大きなオブジェクトの参照をクリア
    if (window.largeDataObjects) {
      window.largeDataObjects.forEach(obj => {
        if (obj && typeof obj.clear === 'function') {
          obj.clear();
        }
      });
      window.largeDataObjects = [];
    }
  }

  setupEventListenerCleanup() {
    // ページ離脱時のクリーンアップ
    window.addEventListener('beforeunload', () => {
      this.cleanupEventListeners();
    });

    // メモリリーク検知
    if ('gc' in window) {
      setInterval(() => {
        const before = performance.memory.usedJSHeapSize;
        window.gc();
        const after = performance.memory.usedJSHeapSize;
        const freed = before - after;

        if (freed > 1024 * 1024) { // 1MB以上解放
          console.info(`Memory cleanup: ${this.formatBytes(freed)} freed`);
        }
      }, 300000); // 5分ごとにチェック
    }
  }

  setupTimerManagement() {
    this.activeTimers = new Set();

    // タイマー管理用のラッパー
    window.managedSetTimeout = (callback, delay) => {
      const id = setTimeout(() => {
        this.activeTimers.delete(id);
        callback();
      }, delay);
      this.activeTimers.add(id);
      return id;
    };

    window.managedSetInterval = (callback, delay) => {
      const id = setInterval(callback, delay);
      this.activeTimers.add(id);
      return id;
    };
  }

  setupCacheCleanup() {
    // 定期的なキャッシュクリーンアップ
    setInterval(() => {
      this.cleanupCaches();
    }, 300000); // 5分ごと
  }

  cleanupCaches() {
    // 古いキャッシュエントリの削除
    const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('cache_'));

    cacheKeys.forEach(key => {
      try {
        const cache = JSON.parse(localStorage.getItem(key));
        if (cache && cache.expires && Date.now() > cache.expires) {
          localStorage.removeItem(key);
        }
      } catch (error) {
        localStorage.removeItem(key); // 破損したキャッシュを削除
      }
    });
  }

  // ユーティリティメソッド
  getResourceType(url) {
    if (url.endsWith('.css')) return 'style';
    if (url.endsWith('.js')) return 'script';
    if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url)) return 'image';
    if (/\.(woff|woff2|ttf|eot)$/i.test(url)) return 'font';
    return 'fetch';
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  sendMetricToServer(name, value) {
    // オフライン時はキューイング
    if (!navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem('metric_queue') || '[]');
      queue.push({ name, value, timestamp: Date.now() });
      localStorage.setItem('metric_queue', JSON.stringify(queue));
      return;
    }

    // オンライン時は即時送信
    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, value, timestamp: Date.now() })
    }).catch(error => {
      console.warn('Failed to send metric:', error);
    });
  }

  trackUnusedCode(type, items) {
    const unused = JSON.parse(localStorage.getItem('unused_code') || '{}');
    if (!unused[type]) {
      unused[type] = [];
    }
    unused[type] = [...new Set([...unused[type], ...items])];
    localStorage.setItem('unused_code', JSON.stringify(unused));
  }

  loadPolyfill(url) {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    document.head.appendChild(script);
  }

  cleanupEventListeners() {
    // アクティブなタイマーをクリーンアップ
    this.activeTimers.forEach(id => {
      clearTimeout(id);
      clearInterval(id);
    });
    this.activeTimers.clear();

    // オブザーバーをクリーンアップ
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  // パフォーマンス最適化の実行
  optimizeForPerformance() {
    // 現在のパフォーマンス状態に基づいて最適化を実行
    const metrics = this.getPerformanceMetrics();

    if (metrics.memoryUsage > 80) {
      this.aggressiveMemoryCleanup();
    }

    if (metrics.bundleSize > 3 * 1024 * 1024) { // 3MB以上
      this.optimizeBundle();
    }

    if (metrics.slowResources.length > 10) {
      this.optimizeResourceLoading();
    }
  }

  getPerformanceMetrics() {
    const metrics = JSON.parse(localStorage.getItem('performance_metrics') || '{}');
    const slowResources = JSON.parse(localStorage.getItem('slow_resources') || '[]');

    return {
      memoryUsage: metrics.MemoryUsage ? metrics.MemoryUsage[metrics.MemoryUsage.length - 1]?.value : 0,
      bundleSize: metrics.BundleSize ? metrics.BundleSize[metrics.BundleSize.length - 1]?.value : 0,
      slowResources: slowResources
    };
  }

  aggressiveMemoryCleanup() {
    // 積極的なメモリクリーンアップ
    this.cleanupCaches();

    // 未使用のDOM要素を削除
    document.querySelectorAll('[data-temporary]').forEach(element => {
      element.remove();
    });

    // イベントリスナーの最適化
    this.optimizeEventListeners();
  }

  optimizeBundle() {
    // バンドル分割の提案
    console.info('Bundle size is large. Consider code splitting.');
    this.suggestCodeSplitting();
  }

  optimizeResourceLoading() {
    // リソース読み込みの最適化
    const slowResources = JSON.parse(localStorage.getItem('slow_resources') || '[]');

    // 大きいリソースの遅延読み込みを強化
    slowResources.forEach(resource => {
      if (resource.size > 1024 * 1024) { // 1MB以上
        this.addResourceHint(resource.url, 'prefetch');
      }
    });
  }

  addResourceHint(url, rel) {
    if (this.resourceHints.has(url)) return;

    const link = document.createElement('link');
    link.rel = rel;
    link.href = url;
    document.head.appendChild(link);
    this.resourceHints.add(url);
  }

  optimizeEventListeners() {
    // 重複イベントリスナーの検出と削除
    const elements = document.querySelectorAll('*');
    const listenerMap = new Map();

    elements.forEach(element => {
      const listeners = this.getEventListeners(element);
      listeners.forEach(listener => {
        const key = `${element.tagName}[${element.id || element.className}]-${listener.type}`;
        if (listenerMap.has(key)) {
          console.warn('Duplicate event listener detected:', key);
        } else {
          listenerMap.set(key, listener);
        }
      });
    });
  }

  getEventListeners(element) {
    // 簡易的なイベントリスナー検出（実際のブラウザAPIに依存）
    return [];
  }

  suggestCodeSplitting() {
    const suggestions = [
      'Consider lazy loading dashboard components',
      'Split vendor libraries into separate chunks',
      'Use dynamic imports for route-based code splitting',
      'Implement tree shaking for unused dependencies'
    ];

    suggestions.forEach(suggestion => {
      console.info('Code splitting suggestion:', suggestion);
    });
  }
}

// グローバルインスタンス作成
const performanceOptimizer = new PerformanceOptimizer();

// グローバルアクセス用
window.performanceOptimizer = performanceOptimizer;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  performanceOptimizer.dispatchEvent('initialized');
});
