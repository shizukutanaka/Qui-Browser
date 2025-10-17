/**
 * Resource Hints Injector
 *
 * Automatically injects resource hints for optimal performance.
 * Lightweight utility for immediate performance gains.
 *
 * @module ResourceHintsInjector
 * @version 1.0.0
 */

class ResourceHintsInjector {
  constructor(options = {}) {
    this.options = {
      autoDnsPrefetch: options.autoDnsPrefetch !== false,
      autoPreconnect: options.autoPreconnect !== false,
      criticalOrigins: options.criticalOrigins || [],
      ...options
    };
  }

  inject() {
    // DNS prefetch for external domains
    if (this.options.autoDnsPrefetch) {
      this.injectDnsPrefetch();
    }

    // Preconnect to critical origins
    if (this.options.autoPreconnect) {
      this.injectPreconnect();
    }
  }

  injectDnsPrefetch() {
    const domains = this.extractExternalDomains();
    domains.forEach(domain => {
      if (!document.querySelector(`link[rel="dns-prefetch"][href="//${domain}"]`)) {
        const link = document.createElement('link');
        link.rel = 'dns-prefetch';
        link.href = `//${domain}`;
        document.head.appendChild(link);
      }
    });
  }

  injectPreconnect() {
    this.options.criticalOrigins.forEach(origin => {
      if (!document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    });
  }

  extractExternalDomains() {
    const domains = new Set();
    const currentHost = window.location.hostname;

    document.querySelectorAll('a[href], img[src], script[src], link[href]').forEach(el => {
      const url = el.href || el.src;
      if (url) {
        try {
          const urlObj = new URL(url, window.location.origin);
          if (urlObj.hostname !== currentHost && urlObj.protocol.startsWith('http')) {
            domains.add(urlObj.hostname);
          }
        } catch (e) {}
      }
    });

    return Array.from(domains);
  }
}

if (typeof window !== 'undefined') {
  window.ResourceHintsInjector = ResourceHintsInjector;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResourceHintsInjector;
}
