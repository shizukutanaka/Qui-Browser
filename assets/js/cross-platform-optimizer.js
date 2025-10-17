/**
 * Qui Browser Cross-Platform Optimizer
 * Windows/macOS/Linux間での最適化と互換性確保
 *
 * 機能:
 * - OS検知とプラットフォーム特有の最適化
 * - キーボードショートカットのプラットフォーム対応
 * - ファイルパスのプラットフォーム対応
 * - システムフォントとUIの最適化
 * - プラットフォーム特有の機能活用
 * - 互換性テストの自動実行
 */

class CrossPlatformOptimizer {
  constructor() {
    this.platform = this.detectPlatform();
    this.os = this.detectOS();
    this.browser = this.detectBrowser();
    this.touchDevice = this.detectTouchDevice();
    this.highDPI = this.detectHighDPI();

    this.init();
  }

  init() {
    this.applyPlatformOptimizations();
    this.setupKeyboardShortcuts();
    this.optimizeUIForPlatform();
    this.setupPlatformSpecificFeatures();
    this.runCompatibilityTests();
  }

  // プラットフォーム検知
  detectPlatform() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;

    if (platform.includes('Mac')) return 'mac';
    if (platform.includes('Win')) return 'windows';
    if (platform.includes('Linux')) return 'linux';
    if (/Android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';

    return 'unknown';
  }

  detectOS() {
    const ua = navigator.userAgent;

    if (/Windows NT 10/.test(ua)) return 'windows-10';
    if (/Windows NT 6.3/.test(ua)) return 'windows-8.1';
    if (/Windows NT 6.1/.test(ua)) return 'windows-7';
    if (/Mac OS X 10_15/.test(ua)) return 'macos-10.15';
    if (/Mac OS X 10_14/.test(ua)) return 'macos-10.14';
    if (/Ubuntu|Linux/.test(ua)) return 'linux-ubuntu';

    return 'unknown';
  }

  detectBrowser() {
    const ua = navigator.userAgent;

    if (/Chrome/.test(ua) && /Google Inc/.test(ua)) return 'chrome';
    if (/Firefox/.test(ua)) return 'firefox';
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'safari';
    if (/Edge/.test(ua)) return 'edge';
    if (/Opera/.test(ua)) return 'opera';

    return 'unknown';
  }

  detectTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  detectHighDPI() {
    return window.devicePixelRatio > 1;
  }

  // プラットフォーム特有の最適化適用
  applyPlatformOptimizations() {
    this.optimizeFonts();
    this.optimizeColors();
    this.optimizeAnimations();
    this.optimizeScrollBehavior();
    this.optimizeInputMethods();
  }

  optimizeFonts() {
    const fontStack = this.getPlatformFontStack();

    // CSSカスタムプロパティとして設定
    document.documentElement.style.setProperty('--font-family-system', fontStack);

    // フォント読み込みの最適化
    this.preloadSystemFonts();
  }

  getPlatformFontStack() {
    switch (this.platform) {
      case 'mac':
        return '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif';
      case 'windows':
        return '"Segoe UI", system-ui, sans-serif';
      case 'linux':
        return '"Ubuntu", "DejaVu Sans", system-ui, sans-serif';
      case 'android':
        return '"Roboto", system-ui, sans-serif';
      case 'ios':
        return '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
      default:
        return 'system-ui, sans-serif';
    }
  }

  preloadSystemFonts() {
    // システムフォントのプリロード（必要に応じて）
    const fontsToPreload = [];

    switch (this.platform) {
      case 'mac':
        fontsToPreload.push('/fonts/sf-pro-text.woff2');
        break;
      case 'windows':
        fontsToPreload.push('/fonts/segoe-ui.woff2');
        break;
    }

    fontsToPreload.forEach(font => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = font;
      link.as = 'font';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }

  optimizeColors() {
    // プラットフォームに応じた色調整
    const colorAdjustments = this.getPlatformColorAdjustments();

    Object.entries(colorAdjustments).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value);
    });
  }

  getPlatformColorAdjustments() {
    const adjustments = {};

    // Windowsのハイコントラストモード対応
    if (this.platform === 'windows' && window.matchMedia('(prefers-contrast: high)').matches) {
      adjustments['--color-text-primary'] = '#ffffff';
      adjustments['--color-background-primary'] = '#000000';
    }

    // macOSのダークモード対応
    if (this.platform === 'mac' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      adjustments['--color-text-primary'] = '#f2f2f2';
      adjustments['--color-background-primary'] = '#1e1e1e';
    }

    return adjustments;
  }

  optimizeAnimations() {
    // プラットフォームに応じたアニメーション調整
    const animationSettings = this.getPlatformAnimationSettings();

    Object.entries(animationSettings).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value);
    });

    // モーション軽減設定の尊重
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.disableAnimations();
    }
  }

  getPlatformAnimationSettings() {
    switch (this.platform) {
      case 'mac':
        return {
          '--animation-duration-fast': '0.15s',
          '--animation-duration-normal': '0.25s',
          '--animation-easing': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        };
      case 'windows':
        return {
          '--animation-duration-fast': '0.2s',
          '--animation-duration-normal': '0.3s',
          '--animation-easing': 'cubic-bezier(0.1, 0.9, 0.2, 1)'
        };
      default:
        return {
          '--animation-duration-fast': '0.2s',
          '--animation-duration-normal': '0.3s',
          '--animation-easing': 'ease-out'
        };
    }
  }

  disableAnimations() {
    document.documentElement.style.setProperty('--animation-duration-fast', '0.01ms');
    document.documentElement.style.setProperty('--animation-duration-normal', '0.01ms');
  }

  optimizeScrollBehavior() {
    // プラットフォームに応じたスクロール最適化
    const scrollSettings = this.getPlatformScrollSettings();

    // CSSでのスクロール設定
    const style = document.createElement('style');
    style.textContent = scrollSettings;
    document.head.appendChild(style);

    // JavaScriptでのスクロール最適化
    this.setupSmoothScrolling();
  }

  getPlatformScrollSettings() {
    switch (this.platform) {
      case 'mac':
        return `
          * {
            -webkit-overflow-scrolling: touch;
          }
          .scrollable {
            scrollbar-width: thin;
            scrollbar-color: var(--color-border) transparent;
          }
        `;
      case 'windows':
        return `
          * {
            scrollbar-width: auto;
          }
          .scrollable {
            scrollbar-width: thin;
            scrollbar-color: var(--color-border) var(--color-background-subtle);
          }
          .scrollable::-webkit-scrollbar {
            width: 12px;
          }
          .scrollable::-webkit-scrollbar-track {
            background: var(--color-background-subtle);
          }
          .scrollable::-webkit-scrollbar-thumb {
            background: var(--color-border);
            border-radius: 6px;
          }
        `;
      case 'linux':
        return `
          * {
            scrollbar-width: thin;
          }
          .scrollable {
            scrollbar-width: thin;
            scrollbar-color: var(--color-border) transparent;
          }
        `;
      default:
        return `
          .scrollable {
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
          }
        `;
    }
  }

  setupSmoothScrolling() {
    // スムーススクロールの実装（プラットフォームに応じて）
    if ('scrollBehavior' in document.documentElement.style) {
      document.documentElement.style.scrollBehavior = 'smooth';
    } else {
      // ポリフィル適用
      this.loadScript('/assets/js/smooth-scroll-polyfill.js');
    }
  }

  optimizeInputMethods() {
    // プラットフォームに応じた入力方法の最適化
    if (this.touchDevice) {
      this.optimizeForTouch();
    } else {
      this.optimizeForMouse();
    }

    // IME対応
    this.setupIMEHandling();
  }

  optimizeForTouch() {
    // タッチデバイス向け最適化
    document.documentElement.classList.add('touch-device');

    // タッチターゲットの拡大
    const style = document.createElement('style');
    style.textContent = `
      button, .btn, input, select, textarea, [role="button"] {
        min-height: 44px;
        min-width: 44px;
      }

      .touch-target {
        position: relative;
      }

      .touch-target::after {
        content: '';
        position: absolute;
        top: -8px;
        left: -8px;
        right: -8px;
        bottom: -8px;
        background: transparent;
      }
    `;
    document.head.appendChild(style);
  }

  optimizeForMouse() {
    // マウスデバイス向け最適化
    document.documentElement.classList.add('mouse-device');

    // ホバー効果の最適化
    const style = document.createElement('style');
    style.textContent = `
      .hoverable:hover {
        transform: translateY(-1px);
        box-shadow: var(--shadow-raised);
      }

      @media (hover: none) {
        .hoverable:hover {
          transform: none;
          box-shadow: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  setupIMEHandling() {
    // IME入力時の最適化
    document.addEventListener('compositionstart', () => {
      document.documentElement.classList.add('ime-active');
    });

    document.addEventListener('compositionend', () => {
      document.documentElement.classList.remove('ime-active');
    });
  }

  // キーボードショートカットのプラットフォーム対応
  setupKeyboardShortcuts() {
    const shortcuts = this.getPlatformKeyboardShortcuts();

    document.addEventListener('keydown', (e) => {
      const key = this.normalizeKeyCombination(e);
      const action = shortcuts[key];

      if (action) {
        e.preventDefault();
        this.executeShortcutAction(action);
      }
    });

    // プラットフォーム別のショートカット表示
    this.displayKeyboardShortcuts(shortcuts);
  }

  getPlatformKeyboardShortcuts() {
    const baseShortcuts = {
      'Ctrl+N': 'new-tab',
      'Ctrl+T': 'new-tab',
      'Ctrl+W': 'close-tab',
      'Ctrl+R': 'reload',
      'Ctrl+F': 'find',
      'Alt+Left': 'back',
      'Alt+Right': 'forward'
    };

    // プラットフォーム固有のショートカット
    switch (this.platform) {
      case 'mac':
        return {
          ...baseShortcuts,
          'Cmd+N': 'new-tab',
          'Cmd+T': 'new-tab',
          'Cmd+W': 'close-tab',
          'Cmd+R': 'reload',
          'Cmd+F': 'find',
          'Cmd+Left': 'back',
          'Cmd+Right': 'forward',
          'Cmd+,': 'settings'
        };
      case 'windows':
        return {
          ...baseShortcuts,
          'Ctrl+H': 'history',
          'Ctrl+J': 'downloads',
          'F11': 'fullscreen'
        };
      default:
        return baseShortcuts;
    }
  }

  normalizeKeyCombination(e) {
    const modifiers = [];
    if (e.ctrlKey || e.metaKey) modifiers.push('Cmd');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');

    let key = e.key;
    if (key === ' ') key = 'Space';

    return [...modifiers, key].join('+');
  }

  executeShortcutAction(action) {
    // ショートカットアクションの実行
    switch (action) {
      case 'new-tab':
        this.dispatchEvent('shortcut-new-tab');
        break;
      case 'close-tab':
        this.dispatchEvent('shortcut-close-tab');
        break;
      case 'reload':
        window.location.reload();
        break;
      case 'find':
        this.focusSearchInput();
        break;
      case 'back':
        window.history.back();
        break;
      case 'forward':
        window.history.forward();
        break;
      case 'settings':
        this.openSettings();
        break;
    }
  }

  displayKeyboardShortcuts(shortcuts) {
    // ヘルプメニューにショートカットを表示
    const helpContent = Object.entries(shortcuts)
      .map(([key, action]) => `<div class="shortcut-item"><kbd>${key}</kbd> ${action}</div>`)
      .join('');

    // ヘルプコンテナの作成
    const helpContainer = document.createElement('div');
    helpContainer.id = 'keyboard-shortcuts-help';
    helpContainer.innerHTML = `
      <h3>キーボードショートカット</h3>
      ${helpContent}
    `;
    helpContainer.style.display = 'none';

    document.body.appendChild(helpContainer);
  }

  // UIのプラットフォーム別最適化
  optimizeUIForPlatform() {
    this.applyPlatformCSSClasses();
    this.optimizeDialogs();
    this.optimizeContextMenus();
    this.optimizeNotifications();
  }

  applyPlatformCSSClasses() {
    // プラットフォームに応じたCSSクラス適用
    document.documentElement.classList.add(`platform-${this.platform}`);
    document.documentElement.classList.add(`os-${this.os.replace(/\./g, '-')}`);
    document.documentElement.classList.add(`browser-${this.browser}`);

    if (this.touchDevice) {
      document.documentElement.classList.add('touch-device');
    }

    if (this.highDPI) {
      document.documentElement.classList.add('high-dpi');
    }
  }

  optimizeDialogs() {
    // プラットフォームに応じたダイアログの最適化
    const dialogStyle = this.getPlatformDialogStyle();

    const style = document.createElement('style');
    style.textContent = dialogStyle;
    document.head.appendChild(style);
  }

  getPlatformDialogStyle() {
    switch (this.platform) {
      case 'mac':
        return `
          .dialog, .modal {
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          }
          .dialog-header, .modal-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--color-border);
          }
          .dialog-footer, .modal-footer {
            padding: 16px 20px;
            border-top: 1px solid var(--color-border);
          }
        `;
      case 'windows':
        return `
          .dialog, .modal {
            border-radius: 4px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          }
          .dialog-header, .modal-header {
            padding: 12px 16px;
            background: var(--color-background-subtle);
            border-bottom: 1px solid var(--color-border);
          }
          .dialog-footer, .modal-footer {
            padding: 12px 16px;
            border-top: 1px solid var(--color-border);
            text-align: right;
          }
        `;
      default:
        return `
          .dialog, .modal {
            border-radius: 8px;
            box-shadow: var(--shadow-overlay);
          }
          .dialog-header, .modal-header {
            padding: 16px;
            border-bottom: 1px solid var(--color-border);
          }
          .dialog-footer, .modal-footer {
            padding: 16px;
            border-top: 1px solid var(--color-border);
          }
        `;
    }
  }

  optimizeContextMenus() {
    // プラットフォームに応じたコンテキストメニューの最適化
    const contextMenuStyle = this.getPlatformContextMenuStyle();

    const style = document.createElement('style');
    style.textContent = contextMenuStyle;
    document.head.appendChild(style);
  }

  getPlatformContextMenuStyle() {
    switch (this.platform) {
      case 'mac':
        return `
          .context-menu {
            background: var(--color-surface);
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            border: none;
            padding: 4px 0;
          }
          .context-menu-item {
            padding: 4px 16px;
            font-size: 13px;
          }
          .context-menu-separator {
            height: 1px;
            background: var(--color-border);
            margin: 4px 0;
          }
        `;
      case 'windows':
        return `
          .context-menu {
            background: var(--color-surface);
            border: 1px solid var(--color-border-strong);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            padding: 2px 0;
          }
          .context-menu-item {
            padding: 6px 12px;
            font-size: 12px;
          }
          .context-menu-separator {
            height: 1px;
            background: var(--color-border-strong);
            margin: 2px 0;
          }
        `;
      default:
        return `
          .context-menu {
            background: var(--color-surface);
            border-radius: 4px;
            box-shadow: var(--shadow-overlay);
            border: 1px solid var(--color-border);
            padding: 4px 0;
          }
          .context-menu-item {
            padding: 8px 12px;
          }
          .context-menu-separator {
            height: 1px;
            background: var(--color-border);
            margin: 4px 0;
          }
        `;
    }
  }

  optimizeNotifications() {
    // プラットフォームに応じた通知の最適化
    const notificationStyle = this.getPlatformNotificationStyle();

    const style = document.createElement('style');
    style.textContent = notificationStyle;
    document.head.appendChild(style);
  }

  getPlatformNotificationStyle() {
    switch (this.platform) {
      case 'mac':
        return `
          .notification {
            background: var(--color-surface);
            border-radius: 12px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            border: none;
          }
          .notification-title {
            font-weight: 600;
            font-size: 14px;
          }
          .notification-body {
            font-size: 13px;
            color: var(--color-text-secondary);
          }
        `;
      case 'windows':
        return `
          .notification {
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          }
          .notification-title {
            font-weight: 600;
            font-size: 13px;
          }
          .notification-body {
            font-size: 12px;
            color: var(--color-text-secondary);
          }
        `;
      default:
        return `
          .notification {
            background: var(--color-surface);
            border-radius: 8px;
            box-shadow: var(--shadow-raised);
            border: 1px solid var(--color-border);
          }
        `;
    }
  }

  // プラットフォーム特有の機能
  setupPlatformSpecificFeatures() {
    switch (this.platform) {
      case 'mac':
        this.setupMacFeatures();
        break;
      case 'windows':
        this.setupWindowsFeatures();
        break;
      case 'linux':
        this.setupLinuxFeatures();
        break;
    }

    this.setupBrowserSpecificFeatures();
  }

  setupMacFeatures() {
    // macOS特有の機能
    document.documentElement.classList.add('mac-features');

    // トラックパッドジェスチャー対応
    this.setupTrackpadGestures();

    // Touch Bar対応（利用可能な場合）
    this.setupTouchBarSupport();
  }

  setupWindowsFeatures() {
    // Windows特有の機能
    document.documentElement.classList.add('windows-features');

    // Windows Ink対応
    this.setupWindowsInkSupport();

    // 仮想デスクトップ対応
    this.setupVirtualDesktopSupport();
  }

  setupLinuxFeatures() {
    // Linux特有の機能
    document.documentElement.classList.add('linux-features');

    // Wayland対応
    this.setupWaylandSupport();
  }

  setupBrowserSpecificFeatures() {
    // ブラウザ特有の機能
    switch (this.browser) {
      case 'chrome':
        this.setupChromeFeatures();
        break;
      case 'firefox':
        this.setupFirefoxFeatures();
        break;
      case 'safari':
        this.setupSafariFeatures();
        break;
      case 'edge':
        this.setupEdgeFeatures();
        break;
    }
  }

  setupChromeFeatures() {
    // Chrome特有の機能
    if ('chrome' in window) {
      // Chrome拡張機能連携
      this.setupChromeExtensions();

      // Chrome DevTools連携
      this.setupChromeDevTools();
    }
  }

  setupFirefoxFeatures() {
    // Firefox特有の機能
    if (typeof browser !== 'undefined') {
      // Firefox拡張機能連携
      this.setupFirefoxExtensions();
    }
  }

  setupSafariFeatures() {
    // Safari特有の機能
    // Safari拡張機能連携など
  }

  setupEdgeFeatures() {
    // Edge特有の機能
    // Edge拡張機能連携など
  }

  // 互換性テスト
  runCompatibilityTests() {
    this.testPlatformCompatibility();
    this.testBrowserCompatibility();
    this.testFeatureSupport();
  }

  testPlatformCompatibility() {
    const tests = [
      { name: 'IntersectionObserver', test: () => 'IntersectionObserver' in window },
      { name: 'ResizeObserver', test: () => 'ResizeObserver' in window },
      { name: 'PerformanceObserver', test: () => 'PerformanceObserver' in window },
      { name: 'WebGL', test: () => {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch {
          return false;
        }
      }},
      { name: 'ServiceWorker', test: () => 'serviceWorker' in navigator },
      { name: 'WebRTC', test: () => 'RTCPeerConnection' in window },
      { name: 'IndexedDB', test: () => 'indexedDB' in window },
      { name: 'WebAssembly', test: () => 'WebAssembly' in window }
    ];

    const results = {};
    tests.forEach(({ name, test }) => {
      results[name] = test();
    });

    // テスト結果を保存
    localStorage.setItem('compatibility_tests', JSON.stringify({
      platform: this.platform,
      browser: this.browser,
      results,
      timestamp: new Date().toISOString()
    }));

    // 互換性の低い機能を警告
    const failedTests = Object.entries(results).filter(([, passed]) => !passed);
    if (failedTests.length > 0) {
      console.warn('Compatibility issues detected:', failedTests);
    }

    return results;
  }

  testBrowserCompatibility() {
    // ブラウザ特有の互換性テスト
    const browserTests = {
      chrome: [
        { name: 'Chrome Extensions API', test: () => 'chrome' in window },
        { name: 'Chrome DevTools', test: () => 'devtools' in window }
      ],
      firefox: [
        { name: 'Firefox Extensions API', test: () => typeof browser !== 'undefined' }
      ],
      safari: [
        { name: 'Safari Extensions API', test: () => 'safari' in window }
      ],
      edge: [
        { name: 'Edge Extensions API', test: () => 'chrome' in window }
      ]
    };

    const tests = browserTests[this.browser] || [];
    const results = {};

    tests.forEach(({ name, test }) => {
      results[name] = test();
    });

    return results;
  }

  testFeatureSupport() {
    // 機能サポートのテスト
    const featureTests = [
      { name: 'ES6 Modules', test: () => 'noModule' in document.createElement('script') },
      { name: 'CSS Grid', test: () => CSS.supports('display', 'grid') },
      { name: 'CSS Custom Properties', test: () => CSS.supports('--test', 'value') },
      { name: 'Async/Await', test: () => {
        try {
          eval('async function test() { await Promise.resolve(); }');
          return true;
        } catch {
          return false;
        }
      }},
      { name: 'Fetch API', test: () => 'fetch' in window },
      { name: 'Promise', test: () => 'Promise' in window },
      { name: 'Proxy', test: () => 'Proxy' in window }
    ];

    const results = {};
    featureTests.forEach(({ name, test }) => {
      results[name] = test();
    });

    return results;
  }

  // ユーティリティメソッド
  dispatchEvent(eventName, detail = {}) {
    const event = new CustomEvent(`cross-platform:${eventName}`, { detail });
    document.dispatchEvent(event);
  }

  loadScript(url) {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    document.head.appendChild(script);
  }

  focusSearchInput() {
    const searchInput = document.querySelector('input[type="search"], input[placeholder*="検索"], #search-input');
    if (searchInput) {
      searchInput.focus();
    }
  }

  openSettings() {
    // 設定ページを開く
    this.dispatchEvent('open-settings');
  }

  // プラットフォーム情報の取得
  getPlatformInfo() {
    return {
      platform: this.platform,
      os: this.os,
      browser: this.browser,
      touchDevice: this.touchDevice,
      highDPI: this.highDPI,
      userAgent: navigator.userAgent,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      online: navigator.onLine
    };
  }
}

// グローバルインスタンス作成
const crossPlatformOptimizer = new CrossPlatformOptimizer();

// グローバルアクセス用
window.crossPlatformOptimizer = crossPlatformOptimizer;

// プラットフォーム情報をグローバルに公開
window.platformInfo = crossPlatformOptimizer.getPlatformInfo();

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  crossPlatformOptimizer.dispatchEvent('initialized');

  // プラットフォーム情報をコンソールに出力（開発者向け）
  console.info('Platform Info:', window.platformInfo);
});
