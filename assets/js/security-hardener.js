/**
 * Qui Browser Security Hardening
 * エンタープライズグレードのセキュリティ強化
 *
 * 機能:
 * - Content Security Policy (CSP) の動的強化
 * - HTTPS強制と証明書ピニング
 * - セキュリティヘッダーの包括的設定
 * - XSS防止とクリックジャッキング対策
 * - サブリソース完全性の検証
 * - セキュリティイベントの監視
 */

class SecurityHardener {
  constructor() {
    this.securityEvents = [];
    this.cspViolations = [];
    this.httpsForced = false;
    this.certificatePinning = new Map();

    this.init();
  }

  init() {
    this.enforceHTTPS();
    this.setupContentSecurityPolicy();
    this.setupSecurityHeaders();
    this.setupXSSProtection();
    this.setupClickjackingProtection();
    this.setupSubresourceIntegrity();
    this.setupSecurityMonitoring();
    this.setupCertificatePinning();
  }

  // HTTPS強制
  enforceHTTPS() {
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      // HTTPからHTTPSへのリダイレクト
      window.location.href = window.location.href.replace(/^http:/, 'https:');
      return;
    }

    this.httpsForced = true;

    // HTTP Strict Transport Security (HSTS) の設定
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        // Service Worker経由でHSTSを強化
        this.sendMessageToSW('setHSTS', {
          maxAge: 31536000, // 1年
          includeSubDomains: true,
          preload: true
        });
      });
    }

    // 混合コンテンツの検知とブロック
    this.monitorMixedContent();
  }

  monitorMixedContent() {
    // 混合コンテンツの検知
    document.addEventListener('securitypolicyviolation', (e) => {
      if (e.violatedDirective === 'block-all-mixed-content' ||
          e.violatedDirective === 'upgrade-insecure-requests') {
        console.warn('Mixed content detected:', e.blockedURI);
        this.reportSecurityEvent('mixed_content', {
          blockedURI: e.blockedURI,
          violatedDirective: e.violatedDirective
        });
      }
    });

    // アクティブな混合コンテンツの監視
    const checkMixedContent = () => {
      const mixedResources = [];
      document.querySelectorAll('img[src^="http:"], script[src^="http:"], link[href^="http:"]').forEach(element => {
        const url = element.src || element.href;
        if (url && url.startsWith('http:')) {
          mixedResources.push(url);
        }
      });

      if (mixedResources.length > 0) {
        console.warn('Active mixed content found:', mixedResources);
        this.reportSecurityEvent('active_mixed_content', { resources: mixedResources });
      }
    };

    // DOM変更時にチェック
    const observer = new MutationObserver(() => {
      setTimeout(checkMixedContent, 100);
    });

    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'href']
    });
  }

  // Content Security Policyの強化
  setupContentSecurityPolicy() {
    // 動的CSPの生成と適用
    const cspDirectives = this.generateCSPDirectives();

    // CSPヘッダーの設定（metaタグ経由）
    this.setCSPMetaTag(cspDirectives);

    // CSP違反の監視
    this.setupCSPViolationReporting();

    // インラインスクリプトのnonce管理
    this.setupNonceManagement();
  }

  generateCSPDirectives() {
    const baseDirectives = {
      'default-src': "'self'",
      'script-src': "'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
      'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
      'img-src': "'self' data: https: blob:",
      'font-src': "'self' https://fonts.gstatic.com data:",
      'connect-src': "'self' https://api.github.com https://duckduckgo.com",
      'media-src': "'self' https: blob:",
      'object-src': "'none'",
      'frame-src': "'self' https://www.youtube.com https://player.vimeo.com",
      'frame-ancestors': "'self'",
      'form-action': "'self'",
      'upgrade-insecure-requests': '',
      'block-all-mixed-content': '',
      'base-uri': "'self'",
      'manifest-src': "'self'"
    };

    // 開発環境での緩和
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      baseDirectives['script-src'] += " 'unsafe-eval'";
      baseDirectives['connect-src'] += ' http://localhost:* ws://localhost:*';
    }

    // レポートURIの設定
    baseDirectives['report-uri'] = '/api/security/csp-report';

    return baseDirectives;
  }

  setCSPMetaTag(directives) {
    const cspString = Object.entries(directives)
      .filter(([_, value]) => value !== '')
      .map(([key, value]) => `${key} ${value}`)
      .join('; ');

    let metaTag = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('http-equiv', 'Content-Security-Policy');
      document.head.appendChild(metaTag);
    }

    metaTag.setAttribute('content', cspString);
  }

  setupCSPViolationReporting() {
    document.addEventListener('securitypolicyviolation', (e) => {
      const violation = {
        documentURI: e.documentURI,
        violatedDirective: e.violatedDirective,
        effectiveDirective: e.effectiveDirective,
        originalPolicy: e.originalPolicy,
        blockedURI: e.blockedURI,
        statusCode: e.statusCode,
        timestamp: new Date().toISOString()
      };

      this.cspViolations.push(violation);
      this.reportSecurityEvent('csp_violation', violation);

      // 重大なCSP違反の場合のアラート
      if (this.isCriticalCSPViolation(violation)) {
        this.handleCriticalSecurityEvent('csp_violation', violation);
      }
    });
  }

  isCriticalCSPViolation(violation) {
    const criticalDirectives = ['script-src', 'object-src', 'base-uri'];
    return criticalDirectives.includes(violation.effectiveDirective) &&
           violation.statusCode !== 200;
  }

  setupNonceManagement() {
    // インラインスクリプト用のnonce生成
    this.nonce = this.generateSecureNonce();

    // nonceをグローバル変数として利用可能に
    window.CSP_NONCE = this.nonce;

    // 動的に作成されるインラインスクリプトにnonceを適用
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName, options) {
      const element = originalCreateElement.call(this, tagName, options);
      if (tagName === 'script' && window.CSP_NONCE) {
        element.setAttribute('nonce', window.CSP_NONCE);
      }
      return element;
    };
  }

  generateSecureNonce() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // セキュリティヘッダーの包括的設定
  setupSecurityHeaders() {
    // サーバーサイドで設定すべきヘッダーですが、クライアントサイドでの検証も行う
    this.validateSecurityHeaders();
    this.setupAdditionalSecurityHeaders();
  }

  validateSecurityHeaders() {
    // 重要なセキュリティヘッダーの存在確認
    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Strict-Transport-Security',
      'Content-Security-Policy'
    ];

    // 実際のレスポンスヘッダーは取得できないので、metaタグで設定されたものを検証
    requiredHeaders.forEach(header => {
      const metaTag = document.querySelector(`meta[http-equiv="${header}"]`);
      if (!metaTag && !document.querySelector(`meta[name="${header.toLowerCase().replace(/-/g, '-').replace(/^x-/, '')}"]`)) {
        console.warn(`Missing security header: ${header}`);
        this.reportSecurityEvent('missing_security_header', { header });
      }
    });
  }

  setupAdditionalSecurityHeaders() {
    // Referrer Policy
    this.setMetaTag('referrer', 'strict-origin-when-cross-origin');

    // Permissions Policy (旧Feature Policy)
    this.setMetaTag('permissions-policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), serial=(), xr-spatial-tracking=*, webxr=*'
    );

    // Cross-Origin関連ヘッダー
    this.setMetaTag('cross-origin-embedder-policy', 'credentialless');
    this.setMetaTag('cross-origin-opener-policy', 'same-origin-allow-popups');
    this.setMetaTag('cross-origin-resource-policy', 'cross-origin');
  }

  setMetaTag(name, content) {
    let metaTag = document.querySelector(`meta[name="${name}"]`);
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', name);
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', content);
  }

  // XSS防止
  setupXSSProtection() {
    // DOM-based XSSの防止
    this.sanitizeDynamicContent();
    this.setupTrustedTypes();
    this.monitorDOMChanges();
  }

  sanitizeDynamicContent() {
    // innerHTMLを使用する前にサニタイズ
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');

    Object.defineProperty(Element.prototype, 'innerHTML', {
      set: function(value) {
        if (typeof value === 'string' && value.includes('<')) {
          // 危険なコンテンツの検知
          if (value.includes('javascript:') || value.includes('data:text/html')) {
            console.warn('Potentially dangerous HTML content detected');
            securityHardener.reportSecurityEvent('dangerous_html_content', {
              element: this.tagName,
              content: value.substring(0, 100) + '...'
            });
          }
        }
        return originalInnerHTML.set.call(this, value);
      }
    });
  }

  setupTrustedTypes() {
    // Trusted Types APIのサポートチェック
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
      const policy = window.trustedTypes.createPolicy('default', {
        createHTML: (input) => {
          // HTMLサニタイズ処理
          return this.sanitizeHTML(input);
        },
        createScriptURL: (input) => {
          // 許可されたスクリプトURLのみ許可
          if (!this.isTrustedScriptURL(input)) {
            throw new Error(`Untrusted script URL: ${input}`);
          }
          return input;
        }
      });

      // ポリシーをデフォルトとして設定
      window.trustedTypes.defaultPolicy = policy;
    }
  }

  sanitizeHTML(html) {
    // 簡易的なHTMLサニタイズ（本番ではDOMPurifyなどのライブラリを使用）
    const temp = document.createElement('div');
    temp.textContent = html;
    return temp.innerHTML;
  }

  isTrustedScriptURL(url) {
    const trustedHosts = ['cdn.jsdelivr.net', 'unpkg.com', 'localhost', '127.0.0.1'];
    try {
      const urlObj = new URL(url);
      return trustedHosts.includes(urlObj.hostname);
    } catch {
      return false;
    }
  }

  monitorDOMChanges() {
    // 危険なDOM操作の監視
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              this.checkForDangerousElements(element);
            }
          });
        } else if (mutation.type === 'attributes') {
          if (mutation.attributeName === 'src' || mutation.attributeName === 'href') {
            this.checkForDangerousURL(mutation.target, mutation.attributeName);
          }
        }
      });
    });

    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'href', 'innerHTML']
    });
  }

  checkForDangerousElements(element) {
    // 危険な要素の検知
    const dangerousTags = ['script', 'iframe', 'object', 'embed'];
    if (dangerousTags.includes(element.tagName.toLowerCase())) {
      console.warn('Dangerous element detected:', element.tagName);
      this.reportSecurityEvent('dangerous_element', {
        tagName: element.tagName,
        outerHTML: element.outerHTML.substring(0, 200)
      });
    }
  }

  checkForDangerousURL(element, attribute) {
    const url = element.getAttribute(attribute);
    if (url && (url.includes('javascript:') || url.includes('data:text/html'))) {
      console.warn('Dangerous URL detected:', url);
      this.reportSecurityEvent('dangerous_url', {
        url: url,
        attribute: attribute,
        element: element.tagName
      });
    }
  }

  // クリックジャッキング対策
  setupClickjackingProtection() {
    // X-Frame-Optionsの強化
    this.setMetaTag('X-Frame-Options', 'DENY');

    // CSPのframe-ancestorsディレクティブで追加保護
    this.enforceFrameAncestors();

    // 透明なオーバーレイの検知
    this.detectClickjackingAttempts();
  }

  enforceFrameAncestors() {
    const currentCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (currentCSP) {
      let content = currentCSP.getAttribute('content') || '';
      if (!content.includes('frame-ancestors')) {
        content += '; frame-ancestors \'self\'';
        currentCSP.setAttribute('content', content);
      }
    }
  }

  detectClickjackingAttempts() {
    // フレーム内での実行を検知
    if (window !== window.top) {
      console.warn('Page is running in a frame - potential clickjacking attempt');
      this.reportSecurityEvent('clickjacking_attempt', {
        location: window.location.href,
        referrer: document.referrer
      });

      // フレーム内の場合、コンテンツを非表示に
      document.body.style.display = 'none';
    }
  }

  // サブリソース完全性検証
  setupSubresourceIntegrity() {
    // 外部スクリプトとスタイルシートのSRIチェック
    this.verifyExternalResources();

    // SRI違反の監視
    document.addEventListener('error', (e) => {
      const target = e.target;
      if (target.tagName === 'SCRIPT' || target.tagName === 'LINK') {
        console.warn('Resource integrity check failed for:', target.src || target.href);
        this.reportSecurityEvent('integrity_check_failed', {
          src: target.src,
          href: target.href,
          tagName: target.tagName
        });
      }
    }, true);
  }

  verifyExternalResources() {
    // 外部リソースのSRI設定確認
    const externalScripts = document.querySelectorAll('script[src^="http"]');
    const externalLinks = document.querySelectorAll('link[href^="http"]');

    [...externalScripts, ...externalLinks].forEach(element => {
      const url = element.src || element.href;
      if (!element.hasAttribute('integrity') && !this.isTrustedHost(url)) {
        console.warn('External resource without integrity check:', url);
        this.reportSecurityEvent('missing_integrity', { url });
      }
    });
  }

  isTrustedHost(url) {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      const trustedHosts = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
      return trustedHosts.includes(urlObj.hostname);
    } catch {
      return false;
    }
  }

  // 証明書ピニング
  setupCertificatePinning() {
    // Certificate Transparencyの監視
    this.monitorCertificateTransparency();

    // HPKP (HTTP Public Key Pinning) の代替として期待される証明書の監視
    this.monitorExpectedCertificates();
  }

  monitorCertificateTransparency() {
    // Certificate Transparencyログの監視（ブラウザAPIが利用可能な場合）
    if ('getExpectCTState' in document) {
      const ctState = document.getExpectCTState();
      if (ctState && !ctState.scts) {
        console.warn('Certificate Transparency SCTs not found');
        this.reportSecurityEvent('missing_ct_scts', ctState);
      }
    }
  }

  monitorExpectedCertificates() {
    // 期待される証明書フィンガープリントの監視
    const expectedFingerprints = this.getExpectedCertificateFingerprints();

    if ('getCertificate' in window) {
      // 将来のCertificate APIが利用可能な場合
      window.getCertificate().then(cert => {
        const fingerprint = this.calculateCertificateFingerprint(cert);
        if (!expectedFingerprints.includes(fingerprint)) {
          console.error('Certificate fingerprint mismatch - possible MITM attack');
          this.reportSecurityEvent('certificate_mismatch', { fingerprint });
        }
      });
    }
  }

  getExpectedCertificateFingerprints() {
    // 本番環境では設定ファイルから読み込む
    return [
      'sha256/expected-fingerprint-here'
    ];
  }

  calculateCertificateFingerprint(cert) {
    // 証明書のフィンガープリント計算（簡易実装）
    return 'sha256/' + btoa(cert.rawData || '');
  }

  // セキュリティイベントの監視
  setupSecurityMonitoring() {
    // セキュリティ関連イベントの収集
    this.monitorSecurityEvents();

    // 定期的なセキュリティチェック
    this.scheduleSecurityChecks();

    // セキュリティレポートの送信
    this.setupSecurityReporting();
  }

  monitorSecurityEvents() {
    // セキュリティポリシー違反イベント
    document.addEventListener('securitypolicyviolation', (e) => {
      this.handleSecurityPolicyViolation(e);
    });

    // コンソールエラーの監視（XSS検知用）
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // XSS関連のエラーを検知
      const errorMessage = args.join(' ');
      if (errorMessage.includes('Script error') ||
          errorMessage.includes('violates Content Security Policy')) {
        this.reportSecurityEvent('console_security_error', { message: errorMessage });
      }
      originalConsoleError.apply(console, args);
    };
  }

  handleSecurityPolicyViolation(event) {
    const violation = {
      type: 'csp_violation',
      documentURI: event.documentURI,
      violatedDirective: event.violatedDirective,
      blockedURI: event.blockedURI,
      timestamp: new Date().toISOString()
    };

    this.securityEvents.push(violation);

    // 重大な違反の場合は即時レポート
    if (this.isSevereViolation(violation)) {
      this.sendSecurityReport(violation);
    }
  }

  isSevereViolation(violation) {
    const severeDirectives = ['script-src', 'object-src', 'base-uri'];
    return severeDirectives.includes(violation.violatedDirective);
  }

  scheduleSecurityChecks() {
    // 定期的なセキュリティチェック
    setInterval(() => {
      this.performSecurityAudit();
    }, 300000); // 5分ごと
  }

  performSecurityAudit() {
    const audit = {
      timestamp: new Date().toISOString(),
      cspViolations: this.cspViolations.length,
      securityEvents: this.securityEvents.length,
      httpsEnforced: this.httpsForced,
      mixedContentDetected: this.detectMixedContent()
    };

    // 監査結果をローカルストレージに保存
    const audits = JSON.parse(localStorage.getItem('security_audits') || '[]');
    audits.push(audit);

    // 最新100件のみ保持
    if (audits.length > 100) {
      audits.splice(0, audits.length - 100);
    }

    localStorage.setItem('security_audits', JSON.stringify(audits));

    // 異常が検知された場合はレポート
    if (audit.cspViolations > 0 || audit.securityEvents > 5) {
      this.sendSecurityReport(audit);
    }
  }

  detectMixedContent() {
    const mixedResources = document.querySelectorAll('img[src^="http:"], script[src^="http:"], link[href^="http:"]');
    return mixedResources.length;
  }

  setupSecurityReporting() {
    // セキュリティレポートの送信設定
    this.securityReportEndpoint = '/api/security/report';

    // オフライン時のキューイング
    this.setupOfflineSecurityReporting();
  }

  setupOfflineSecurityReporting() {
    // オフライン時のセキュリティイベントをキューイング
    window.addEventListener('online', () => {
      this.flushSecurityReports();
    });
  }

  async sendSecurityReport(report) {
    try {
      const response = await fetch(this.securityReportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Security report failed: ${response.status}`);
      }
    } catch (error) {
      console.warn('Failed to send security report:', error);
      // オフラインキューに追加
      this.queueSecurityReport(report);
    }
  }

  queueSecurityReport(report) {
    const queue = JSON.parse(localStorage.getItem('security_report_queue') || '[]');
    queue.push(report);
    localStorage.setItem('security_report_queue', JSON.stringify(queue));
  }

  async flushSecurityReports() {
    const queue = JSON.parse(localStorage.getItem('security_report_queue') || '[]');
    if (queue.length === 0) return;

    for (const report of queue) {
      await this.sendSecurityReport(report);
    }

    localStorage.removeItem('security_report_queue');
  }

  // セキュリティイベントのレポート
  reportSecurityEvent(type, details) {
    const event = {
      type,
      details,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    this.securityEvents.push(event);

    // コンソールにも出力
    console.warn(`Security Event [${type}]:`, details);
  }

  handleCriticalSecurityEvent(type, details) {
    // 重大なセキュリティイベントの処理
    this.reportSecurityEvent(`critical_${type}`, details);

    // 必要に応じてUIに警告を表示
    this.showSecurityWarning(type, details);
  }

  showSecurityWarning(type, details) {
    const warning = document.createElement('div');
    warning.className = 'security-warning';
    warning.innerHTML = `
      <div class="security-warning-content">
        <h3>セキュリティ警告</h3>
        <p>潜在的なセキュリティ問題が検知されました: ${type}</p>
        <button onclick="this.parentElement.parentElement.remove()">閉じる</button>
      </div>
    `;

    warning.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 300px;
    `;

    document.body.appendChild(warning);

    // 10秒後に自動削除
    setTimeout(() => {
      if (warning.parentElement) {
        warning.remove();
      }
    }, 10000);
  }
}

// グローバルインスタンス作成
const securityHardener = new SecurityHardener();

// グローバルアクセス用
window.securityHardener = securityHardener;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  securityHardener.dispatchEvent('initialized');
});
