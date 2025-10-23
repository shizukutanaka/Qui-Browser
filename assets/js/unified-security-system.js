/**
 * Unified Security System
 * 統合セキュリティ管理システム
 *
 * 統合対象：
 * - security-hardener.js (コアセキュリティ)
 * - enterprise-security.js (エンタープライズ機能)
 * - core/security-hardener.js (重複)
 *
 * @version 3.2.0
 */

class UnifiedSecuritySystem {
  constructor() {
    this.initialized = false;

    // セキュリティ設定
    this.config = {
      enforceHTTPS: true,
      enableCSP: true,
      enableHSTS: true,
      enableXFrameOptions: true,
      enableXSSProtection: true,
      enableContentTypeOptions: true,
      enableReferrerPolicy: true,
      enablePermissionsPolicy: true,
      enableSubresourceIntegrity: true,
      enableCertificatePinning: false, // Requires server setup
      maxLoginAttempts: 5,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      encryptionAlgorithm: 'AES-GCM',
      keyLength: 256
    };

    // セキュリティイベントログ
    this.securityEvents = [];
    this.maxEvents = 1000;

    // CSP違反ログ
    this.cspViolations = [];

    // 暗号化キー管理（Web Crypto API使用）
    this.cryptoKeys = new Map();

    // セッション管理
    this.sessions = new Map();

    // ログイン試行追跡
    this.loginAttempts = new Map();

    // セキュリティヘッダー
    this.securityHeaders = new Map();

    // 入力検証ルール
    this.validationRules = new Map();

    // セキュリティポリシー
    this.policies = {
      csp: null,
      permissions: null,
      cors: null
    };
  }

  /**
   * セキュリティシステムの初期化
   */
  async initialize() {
    if (this.initialized) {
      console.warn('UnifiedSecuritySystem: Already initialized');
      return this;
    }

    try {
      console.info('Initializing Unified Security System...');

      // 基本セキュリティの設定
      await this.setupBasicSecurity();

      // 暗号化システムの初期化
      await this.setupEncryption();

      // セキュリティヘッダーの設定
      this.setupSecurityHeaders();

      // Content Security Policy の設定
      this.setupContentSecurityPolicy();

      // 入力検証の設定
      this.setupInputValidation();

      // セキュリティ監視の設定
      this.setupSecurityMonitoring();

      // セッション管理の初期化
      this.setupSessionManagement();

      this.initialized = true;
      console.info('Unified Security System initialized successfully');

      return this;
    } catch (error) {
      console.error('Failed to initialize Unified Security System:', error);
      throw error;
    }
  }

  /**
   * 基本セキュリティの設定
   */
  async setupBasicSecurity() {
    // HTTPS強制
    if (this.config.enforceHTTPS) {
      this.enforceHTTPS();
    }

    // Mixed Content のブロック
    this.blockMixedContent();

    // Clickjacking 対策
    this.preventClickjacking();

    // XSS対策
    this.setupXSSProtection();
  }

  /**
   * HTTPS強制
   */
  enforceHTTPS() {
    if (window.location.protocol !== 'https:' &&
        window.location.hostname !== 'localhost' &&
        !window.location.hostname.startsWith('127.')) {

      console.warn('Redirecting to HTTPS...');
      window.location.href = 'https:' + window.location.href.substring(window.location.protocol.length);
      return true;
    }

    // HSTS (HTTP Strict Transport Security) の設定
    if (this.config.enableHSTS) {
      this.setSecurityHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    return false;
  }

  /**
   * Mixed Content のブロック
   */
  blockMixedContent() {
    // Meta tag でのアップグレード（すでにindex.htmlに存在）
    let meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = 'upgrade-insecure-requests';
      document.head.appendChild(meta);
    }
  }

  /**
   * Clickjacking 対策
   */
  preventClickjacking() {
    // Frame-busting code
    if (window.self !== window.top) {
      console.warn('Potential clickjacking attempt detected');
      this.logSecurityEvent('clickjacking_attempt', {
        referrer: document.referrer,
        timestamp: Date.now()
      });

      // オプション：フレーム内での実行を完全に防ぐ
      // window.top.location = window.self.location;
    }

    // X-Frame-Options の設定
    if (this.config.enableXFrameOptions) {
      this.setSecurityHeader('X-Frame-Options', 'SAMEORIGIN');
    }
  }

  /**
   * XSS対策
   */
  setupXSSProtection() {
    // X-XSS-Protection ヘッダー
    if (this.config.enableXSSProtection) {
      this.setSecurityHeader('X-XSS-Protection', '1; mode=block');
    }

    // DOM-based XSS対策：危険なメソッドをラップ
    this.wrapDangerousMethods();

    // HTML サニタイゼーション
    this.setupHTMLSanitizer();
  }

  /**
   * 危険なメソッドのラップ
   */
  wrapDangerousMethods() {
    // innerHTML のラップ
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (originalInnerHTML) {
      Object.defineProperty(Element.prototype, 'innerHTML', {
        set: function(value) {
          if (this.hasAttribute('data-safe-html')) {
            originalInnerHTML.set.call(this, value);
          } else {
            console.warn('Unsafe innerHTML usage detected. Consider using textContent or sanitized HTML.');
            // サニタイズ後に設定
            const sanitized = window.unifiedSecurity?.sanitizeHTML(value) || value;
            originalInnerHTML.set.call(this, sanitized);
          }
        },
        get: originalInnerHTML.get
      });
    }

    // eval のオーバーライド（本番環境では完全に無効化を推奨）
    window.eval = new Proxy(window.eval, {
      apply: (target, thisArg, args) => {
        console.error('eval() usage detected - this is a security risk!');
        this.logSecurityEvent('eval_usage', {
          code: args[0]?.substring(0, 100),
          timestamp: Date.now()
        });
        // 本番環境では実行しない
        if (this.isProduction()) {
          throw new Error('eval() is disabled for security reasons');
        }
        return target.apply(thisArg, args);
      }
    });
  }

  /**
   * HTML サニタイザーの設定
   */
  setupHTMLSanitizer() {
    // DOMPurify が利用可能な場合は使用
    if (window.DOMPurify) {
      this.sanitizer = window.DOMPurify;
    } else {
      // 基本的なサニタイゼーション実装
      this.sanitizer = {
        sanitize: (html) => this.basicSanitize(html)
      };
    }
  }

  /**
   * 基本的なHTMLサニタイゼーション
   */
  basicSanitize(html) {
    // 危険なタグとイベントハンドラを削除
    const div = document.createElement('div');
    div.textContent = html;
    let sanitized = div.innerHTML;

    // 危険なタグを削除
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'link', 'style'];
    dangerousTags.forEach(tag => {
      const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });

    // イベントハンドラを削除
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');

    return sanitized;
  }

  /**
   * セキュリティヘッダーの設定
   */
  setupSecurityHeaders() {
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
    };

    for (const [header, value] of Object.entries(headers)) {
      this.setSecurityHeader(header, value);
    }
  }

  /**
   * Content Security Policy の設定
   */
  setupContentSecurityPolicy() {
    if (!this.config.enableCSP) return;

    const cspDirectives = {
      'default-src': "'self'",
      'script-src': "'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      'style-src': "'self' 'unsafe-inline'",
      'img-src': "'self' data: https:",
      'font-src': "'self' data:",
      'connect-src': "'self' https:",
      'media-src': "'self'",
      'object-src': "'none'",
      'child-src': "'self'",
      'frame-src': "'self'",
      'worker-src': "'self' blob:",
      'form-action': "'self'",
      'frame-ancestors': "'self'",
      'base-uri': "'self'",
      'manifest-src': "'self'"
    };

    // CSPヘッダーを構築
    const cspHeader = Object.entries(cspDirectives)
      .map(([directive, value]) => `${directive} ${value}`)
      .join('; ');

    this.policies.csp = cspHeader;

    // CSP違反のレポート設定
    this.setupCSPReporting();

    // Meta tagでCSPを設定（既存のものを更新）
    let meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (meta) {
      // upgrade-insecure-requests を保持しつつCSPを追加
      meta.content = `upgrade-insecure-requests; ${cspHeader}`;
    }
  }

  /**
   * CSP違反レポートの設定
   */
  setupCSPReporting() {
    // CSP違反イベントをリッスン
    document.addEventListener('securitypolicyviolation', (event) => {
      const violation = {
        blockedURI: event.blockedURI,
        violatedDirective: event.violatedDirective,
        originalPolicy: event.originalPolicy,
        timestamp: Date.now(),
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber
      };

      this.cspViolations.push(violation);

      // 最大保存数を超えた場合は古いものを削除
      if (this.cspViolations.length > 100) {
        this.cspViolations.shift();
      }

      console.warn('CSP Violation:', violation);
      this.logSecurityEvent('csp_violation', violation);
    });
  }

  /**
   * 暗号化システムのセットアップ（Web Crypto API使用）
   */
  async setupEncryption() {
    if (!window.crypto || !window.crypto.subtle) {
      console.warn('Web Crypto API not available');
      return;
    }

    try {
      // マスターキーの生成または取得
      await this.initializeMasterKey();

      // 暗号化・復号化メソッドの設定
      this.encryptionReady = true;
    } catch (error) {
      console.error('Failed to setup encryption:', error);
      this.encryptionReady = false;
    }
  }

  /**
   * マスターキーの初期化
   */
  async initializeMasterKey() {
    const keyName = 'master_key';

    // IndexedDB からキーを取得または新規生成
    let key = await this.getStoredKey(keyName);

    if (!key) {
      // 新しいキーを生成
      key = await window.crypto.subtle.generateKey(
        {
          name: this.config.encryptionAlgorithm,
          length: this.config.keyLength
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );

      // キーを保存
      await this.storeKey(keyName, key);
    }

    this.cryptoKeys.set(keyName, key);
  }

  /**
   * IndexedDBからキーを取得
   */
  async getStoredKey(keyName) {
    return new Promise((resolve) => {
      const request = indexedDB.open('SecurityKeys', 1);

      request.onerror = () => resolve(null);

      request.onsuccess = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('keys')) {
          resolve(null);
          return;
        }

        const transaction = db.transaction(['keys'], 'readonly');
        const store = transaction.objectStore('keys');
        const getRequest = store.get(keyName);

        getRequest.onsuccess = () => {
          resolve(getRequest.result?.key || null);
        };

        getRequest.onerror = () => resolve(null);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'name' });
        }
      };
    });
  }

  /**
   * IndexedDBにキーを保存
   */
  async storeKey(keyName, key) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SecurityKeys', 1);

      request.onerror = () => reject(new Error('Failed to open database'));

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['keys'], 'readwrite');
        const store = transaction.objectStore('keys');

        const putRequest = store.put({ name: keyName, key: key });

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error('Failed to store key'));
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'name' });
        }
      };
    });
  }

  /**
   * データの暗号化
   */
  async encrypt(data) {
    if (!this.encryptionReady) {
      console.warn('Encryption not ready, returning plaintext');
      return data;
    }

    try {
      const key = this.cryptoKeys.get('master_key');
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(JSON.stringify(data));

      // IV (Initialization Vector) の生成
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // 暗号化
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: this.config.encryptionAlgorithm,
          iv: iv
        },
        key,
        dataBuffer
      );

      // IV と暗号化データを結合して返す
      const result = new Uint8Array(iv.byteLength + encryptedBuffer.byteLength);
      result.set(iv, 0);
      result.set(new Uint8Array(encryptedBuffer), iv.byteLength);

      // Base64エンコード
      return btoa(String.fromCharCode.apply(null, result));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw error;
    }
  }

  /**
   * データの復号化
   */
  async decrypt(encryptedData) {
    if (!this.encryptionReady) {
      console.warn('Encryption not ready, returning as-is');
      return encryptedData;
    }

    try {
      const key = this.cryptoKeys.get('master_key');

      // Base64デコード
      const dataArray = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));

      // IVと暗号化データを分離
      const iv = dataArray.slice(0, 12);
      const encrypted = dataArray.slice(12);

      // 復号化
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: this.config.encryptionAlgorithm,
          iv: iv
        },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decryptedBuffer);

      return JSON.parse(decryptedText);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw error;
    }
  }

  /**
   * 入力検証の設定
   */
  setupInputValidation() {
    // URL検証
    this.validationRules.set('url', (value) => {
      try {
        const url = new URL(value);
        // HTTPSのみ許可（開発環境を除く）
        if (this.isProduction() && url.protocol !== 'https:') {
          return { valid: false, error: 'HTTPS URLs only' };
        }
        return { valid: true };
      } catch {
        return { valid: false, error: 'Invalid URL format' };
      }
    });

    // Email検証
    this.validationRules.set('email', (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return {
        valid: emailRegex.test(value),
        error: 'Invalid email format'
      };
    });

    // XSS危険文字列の検出
    this.validationRules.set('xss', (value) => {
      const dangerous = /<script|javascript:|on\w+=/gi;
      return {
        valid: !dangerous.test(value),
        error: 'Potentially dangerous input detected'
      };
    });

    // SQLインジェクション対策
    this.validationRules.set('sql', (value) => {
      const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b|--|\/\*|\*\/)/gi;
      return {
        valid: !sqlPatterns.test(value),
        error: 'SQL patterns detected'
      };
    });

    // パスワード強度チェック
    this.validationRules.set('password', (value) => {
      const minLength = 8;
      const hasUpperCase = /[A-Z]/.test(value);
      const hasLowerCase = /[a-z]/.test(value);
      const hasNumbers = /\d/.test(value);
      const hasSpecialChar = /[!@#$%^&*]/.test(value);

      const strength = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;

      if (value.length < minLength) {
        return { valid: false, error: `Password must be at least ${minLength} characters` };
      }

      if (strength < 3) {
        return { valid: false, error: 'Password must contain uppercase, lowercase, numbers, and special characters' };
      }

      return { valid: true, strength };
    });
  }

  /**
   * 入力値の検証
   */
  validate(type, value) {
    const validator = this.validationRules.get(type);
    if (!validator) {
      console.warn(`No validation rule for type: ${type}`);
      return { valid: true };
    }

    return validator(value);
  }

  /**
   * セキュリティ監視の設定
   */
  setupSecurityMonitoring() {
    // 疑わしいアクティビティの検出
    this.monitorSuspiciousActivity();

    // ネットワークリクエストの監視
    this.monitorNetworkRequests();

    // DOM変更の監視
    this.monitorDOMChanges();

    // コンソールメッセージの監視
    this.monitorConsole();
  }

  /**
   * 疑わしいアクティビティの監視
   */
  monitorSuspiciousActivity() {
    // 右クリック無効化の試み
    let rightClickAttempts = 0;
    document.addEventListener('contextmenu', (e) => {
      rightClickAttempts++;
      if (rightClickAttempts > 10) {
        this.logSecurityEvent('excessive_rightclick_attempts', {
          count: rightClickAttempts,
          timestamp: Date.now()
        });
      }
    });

    // DevToolsの検出
    this.detectDevTools();

    // 複数タブでの同時操作検出
    this.detectMultipleTabActivity();
  }

  /**
   * DevToolsの検出
   */
  detectDevTools() {
    let devtools = { open: false, orientation: null };
    const threshold = 160;

    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold ||
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          this.logSecurityEvent('devtools_opened', {
            timestamp: Date.now()
          });
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }

  /**
   * 複数タブでの同時操作検出
   */
  detectMultipleTabActivity() {
    // LocalStorage を使用してタブ間通信
    const tabId = `tab_${Date.now()}_${Math.random()}`;
    const heartbeatKey = 'active_tabs';

    // タブのハートビート
    setInterval(() => {
      const activeTabs = JSON.parse(localStorage.getItem(heartbeatKey) || '{}');
      activeTabs[tabId] = Date.now();

      // 古いタブ情報を削除
      for (const [id, timestamp] of Object.entries(activeTabs)) {
        if (Date.now() - timestamp > 5000) {
          delete activeTabs[id];
        }
      }

      localStorage.setItem(heartbeatKey, JSON.stringify(activeTabs));

      // アクティブなタブ数をチェック
      const activeTabCount = Object.keys(activeTabs).length;
      if (activeTabCount > 3) {
        this.logSecurityEvent('multiple_tabs_detected', {
          count: activeTabCount,
          timestamp: Date.now()
        });
      }
    }, 1000);
  }

  /**
   * ネットワークリクエストの監視
   */
  monitorNetworkRequests() {
    // Fetch API のインターセプト
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [resource, config] = args;

      // リクエスト前の検証
      if (!this.validateRequest(resource, config)) {
        throw new Error('Request blocked by security policy');
      }

      // リクエストログ
      this.logNetworkRequest('fetch', resource, config);

      try {
        const response = await originalFetch.apply(window, args);

        // レスポンスの検証
        this.validateResponse(response);

        return response;
      } catch (error) {
        this.logSecurityEvent('network_error', {
          resource,
          error: error.message,
          timestamp: Date.now()
        });
        throw error;
      }
    };

    // XMLHttpRequest のインターセプト
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
      const xhr = new originalXHR();

      const originalOpen = xhr.open;
      xhr.open = function(...args) {
        const [method, url] = args;

        // リクエストログ
        window.unifiedSecurity?.logNetworkRequest('xhr', url, { method });

        return originalOpen.apply(xhr, args);
      };

      return xhr;
    };
  }

  /**
   * リクエストの検証
   */
  validateRequest(resource, config) {
    // URLの検証
    try {
      const url = new URL(resource, window.location.origin);

      // HTTPSチェック（開発環境を除く）
      if (this.isProduction() && url.protocol !== 'https:' && url.hostname !== 'localhost') {
        console.warn('Insecure request blocked:', resource);
        return false;
      }

      // ホワイトリストチェック（必要に応じて実装）
      // if (!this.isWhitelisted(url)) {
      //   return false;
      // }

      return true;
    } catch {
      // 相対URLの場合は許可
      return true;
    }
  }

  /**
   * レスポンスの検証
   */
  validateResponse(response) {
    // セキュリティヘッダーのチェック
    const securityHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Content-Security-Policy'
    ];

    securityHeaders.forEach(header => {
      if (!response.headers.get(header)) {
        console.warn(`Missing security header: ${header}`);
      }
    });
  }

  /**
   * DOM変更の監視
   */
  monitorDOMChanges() {
    // MutationObserver を使用してDOM変更を監視
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Script タグの挿入を検出
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.tagName === 'SCRIPT') {
              this.handleScriptInjection(node);
            }
          });
        }

        // 属性の変更を検出（イベントハンドラなど）
        if (mutation.type === 'attributes') {
          if (mutation.attributeName?.startsWith('on')) {
            this.handleEventHandlerChange(mutation.target, mutation.attributeName);
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['onclick', 'onload', 'onerror', 'onmouseover']
    });
  }

  /**
   * スクリプト注入の処理
   */
  handleScriptInjection(scriptNode) {
    console.warn('Script injection detected:', scriptNode);

    // インラインスクリプトのチェック
    if (scriptNode.innerHTML) {
      this.logSecurityEvent('inline_script_injection', {
        content: scriptNode.innerHTML.substring(0, 100),
        timestamp: Date.now()
      });
    }

    // 外部スクリプトのチェック
    if (scriptNode.src) {
      this.logSecurityEvent('external_script_injection', {
        src: scriptNode.src,
        timestamp: Date.now()
      });
    }
  }

  /**
   * イベントハンドラ変更の処理
   */
  handleEventHandlerChange(element, attribute) {
    console.warn('Event handler change detected:', attribute, element);

    this.logSecurityEvent('event_handler_change', {
      element: element.tagName,
      attribute,
      timestamp: Date.now()
    });
  }

  /**
   * コンソール出力の監視
   */
  monitorConsole() {
    const methods = ['log', 'warn', 'error', 'info'];

    methods.forEach(method => {
      const original = console[method];
      console[method] = (...args) => {
        // センシティブ情報の検出
        const message = args.map(arg => String(arg)).join(' ');
        if (this.containsSensitiveInfo(message)) {
          console.warn('Sensitive information detected in console output');
          this.logSecurityEvent('sensitive_console_output', {
            method,
            timestamp: Date.now()
          });
        }

        return original.apply(console, args);
      };
    });
  }

  /**
   * センシティブ情報の検出
   */
  containsSensitiveInfo(text) {
    const patterns = [
      /password\s*[:=]\s*['"]?[\w]+/i,
      /api[_-]?key\s*[:=]\s*['"]?[\w]+/i,
      /token\s*[:=]\s*['"]?[\w]+/i,
      /secret\s*[:=]\s*['"]?[\w]+/i,
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone
      /\b\d{3}-\d{2}-\d{4}\b/ // SSN
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * セッション管理の設定
   */
  setupSessionManagement() {
    // セッションの初期化
    this.initializeSession();

    // セッションタイムアウトの設定
    this.setupSessionTimeout();

    // セッションハイジャック対策
    this.protectAgainstSessionHijacking();
  }

  /**
   * セッションの初期化
   */
  initializeSession() {
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      created: Date.now(),
      lastActivity: Date.now(),
      fingerprint: this.generateFingerprint()
    };

    this.sessions.set(sessionId, session);
    sessionStorage.setItem('session_id', sessionId);
  }

  /**
   * セッションIDの生成
   */
  generateSessionId() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * デバイスフィンガープリントの生成
   */
  generateFingerprint() {
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      hardware: navigator.hardwareConcurrency || 'unknown'
    };

    return btoa(JSON.stringify(fingerprint));
  }

  /**
   * セッションタイムアウトの設定
   */
  setupSessionTimeout() {
    let timeout;

    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.handleSessionTimeout();
      }, this.config.sessionTimeout);

      // セッションのアクティビティを更新
      const sessionId = sessionStorage.getItem('session_id');
      const session = this.sessions.get(sessionId);
      if (session) {
        session.lastActivity = Date.now();
      }
    };

    // ユーザーアクティビティの監視
    ['mousedown', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetTimeout, { passive: true });
    });

    resetTimeout();
  }

  /**
   * セッションタイムアウトの処理
   */
  handleSessionTimeout() {
    console.warn('Session timeout');
    this.logSecurityEvent('session_timeout', {
      timestamp: Date.now()
    });

    // セッションのクリア
    this.clearSession();

    // ログイン画面へリダイレクト（必要に応じて）
    // window.location.href = '/login';
  }

  /**
   * セッションハイジャック対策
   */
  protectAgainstSessionHijacking() {
    // ページロード時にフィンガープリントを検証
    const sessionId = sessionStorage.getItem('session_id');
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        const currentFingerprint = this.generateFingerprint();
        if (session.fingerprint !== currentFingerprint) {
          console.warn('Session hijacking attempt detected');
          this.logSecurityEvent('session_hijacking_attempt', {
            original: session.fingerprint,
            current: currentFingerprint,
            timestamp: Date.now()
          });

          this.clearSession();
        }
      }
    }
  }

  /**
   * セッションのクリア
   */
  clearSession() {
    const sessionId = sessionStorage.getItem('session_id');
    if (sessionId) {
      this.sessions.delete(sessionId);
    }

    sessionStorage.removeItem('session_id');

    // その他のセッションデータもクリア
    sessionStorage.clear();
  }

  /**
   * ネットワークリクエストのログ
   */
  logNetworkRequest(type, resource, config) {
    const log = {
      type,
      resource,
      method: config?.method || 'GET',
      timestamp: Date.now()
    };

    // デバッグモードの場合のみログ出力
    if (!this.isProduction()) {
      console.debug('Network request:', log);
    }
  }

  /**
   * セキュリティイベントのログ
   */
  logSecurityEvent(type, details) {
    const event = {
      type,
      details,
      timestamp: Date.now(),
      sessionId: sessionStorage.getItem('session_id'),
      url: window.location.href
    };

    this.securityEvents.push(event);

    // 最大保存数を超えた場合は古いものを削除
    if (this.securityEvents.length > this.maxEvents) {
      this.securityEvents.shift();
    }

    // 重要なイベントは外部に送信（必要に応じて実装）
    if (this.isImportantEvent(type)) {
      this.reportSecurityEvent(event);
    }

    console.info('Security event:', event);
  }

  /**
   * 重要なセキュリティイベントの判定
   */
  isImportantEvent(type) {
    const importantEvents = [
      'xss_attempt',
      'sql_injection_attempt',
      'session_hijacking_attempt',
      'csp_violation',
      'eval_usage',
      'sensitive_console_output'
    ];

    return importantEvents.includes(type);
  }

  /**
   * セキュリティイベントの報告
   */
  async reportSecurityEvent(event) {
    // 実装: セキュリティイベントをサーバーに送信
    // try {
    //   await fetch('/api/security/events', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(event)
    //   });
    // } catch (error) {
    //   console.error('Failed to report security event:', error);
    // }
  }

  /**
   * セキュリティヘッダーの設定（サーバー側で設定すべきだが、メタタグで可能なものを設定）
   */
  setSecurityHeader(name, value) {
    this.securityHeaders.set(name, value);

    // メタタグで設定可能なヘッダーの処理
    if (name === 'Content-Security-Policy' || name === 'Referrer-Policy') {
      let meta = document.querySelector(`meta[http-equiv="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.httpEquiv = name;
        document.head.appendChild(meta);
      }
      meta.content = value;
    }
  }

  /**
   * HTMLのサニタイズ
   */
  sanitizeHTML(html) {
    if (this.sanitizer && this.sanitizer.sanitize) {
      return this.sanitizer.sanitize(html);
    }
    return this.basicSanitize(html);
  }

  /**
   * URLのサニタイズ
   */
  sanitizeURL(url) {
    try {
      const parsed = new URL(url, window.location.origin);

      // 危険なプロトコルをブロック
      const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];
      if (dangerousProtocols.includes(parsed.protocol)) {
        console.warn('Dangerous URL protocol blocked:', parsed.protocol);
        return 'about:blank';
      }

      return parsed.toString();
    } catch {
      return 'about:blank';
    }
  }

  /**
   * 本番環境かどうかの判定
   */
  isProduction() {
    return window.location.hostname !== 'localhost' &&
           !window.location.hostname.startsWith('127.') &&
           !window.location.hostname.includes('dev') &&
           !window.location.hostname.includes('staging');
  }

  /**
   * セキュリティ状態の取得
   */
  getSecurityStatus() {
    return {
      https: window.location.protocol === 'https:',
      csp: !!this.policies.csp,
      encryption: this.encryptionReady,
      sessionActive: !!sessionStorage.getItem('session_id'),
      securityHeaders: Array.from(this.securityHeaders.keys()),
      recentEvents: this.securityEvents.slice(-10),
      cspViolations: this.cspViolations.length
    };
  }

  /**
   * セキュリティレポートの生成
   */
  generateSecurityReport() {
    return {
      timestamp: Date.now(),
      status: this.getSecurityStatus(),
      events: {
        total: this.securityEvents.length,
        byType: this.securityEvents.reduce((acc, event) => {
          acc[event.type] = (acc[event.type] || 0) + 1;
          return acc;
        }, {})
      },
      cspViolations: {
        total: this.cspViolations.length,
        recent: this.cspViolations.slice(-5)
      },
      configuration: {
        enforceHTTPS: this.config.enforceHTTPS,
        cspEnabled: this.config.enableCSP,
        encryptionAlgorithm: this.config.encryptionAlgorithm,
        sessionTimeout: this.config.sessionTimeout / 1000 / 60 + ' minutes'
      }
    };
  }

  /**
   * 破棄処理
   */
  destroy() {
    // イベントリスナーのクリア
    this.securityEvents = [];
    this.cspViolations = [];
    this.sessions.clear();
    this.cryptoKeys.clear();
    this.validationRules.clear();
    this.securityHeaders.clear();

    console.info('Unified Security System destroyed');
  }
}

// シングルトンインスタンスの作成
const unifiedSecurity = new UnifiedSecuritySystem();

// DOMContentLoaded時に自動初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    unifiedSecurity.initialize();
  });
} else {
  unifiedSecurity.initialize();
}

// グローバルに公開
window.UnifiedSecuritySystem = UnifiedSecuritySystem;
window.unifiedSecurity = unifiedSecurity;

// 後方互換性のためのエイリアス
window.SecurityHardener = unifiedSecurity;
window.EnterpriseSecurityManager = unifiedSecurity;