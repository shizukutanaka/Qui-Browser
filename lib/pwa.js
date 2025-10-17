/**
 * Qui Browser - PWA Integration Module
 *
 * Handles PWA-related routes and functionality
 */

const fs = require('fs').promises;
const path = require('path');

class PWAIntegration {
  constructor(config) {
    this.config = config;
    this.pwaEnabled = config.pwa?.enabled !== false;
    this.publicPath = path.join(__dirname, '..', 'public');
  }

  /**
   * Initialize PWA integration
   */
  async initialize() {
    if (!this.pwaEnabled) {
      console.log('PWA integration disabled');
      return;
    }

    console.log('PWA integration enabled');

    // Ensure PWA files exist
    await this.ensurePWAFiles();
  }

  /**
   * Ensure PWA files exist
   */
  async ensurePWAFiles() {
    const requiredFiles = [
      'manifest.json',
      'sw.js',
      'offline.html',
      'js/pwa.js'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.publicPath, file);
      try {
        await fs.access(filePath);
      } catch (error) {
        console.warn(`PWA file missing: ${file}`);
      }
    }
  }

  /**
   * Handle PWA-related requests
   */
  async handlePWARequest(req, res, pathname) {
    if (!this.pwaEnabled) {
      return false;
    }

    // Handle manifest.json
    if (pathname === '/manifest.json') {
      return this.serveManifest(req, res);
    }

    // Handle service worker
    if (pathname === '/sw.js') {
      return this.serveServiceWorker(req, res);
    }

    // Handle offline page
    if (pathname === '/offline.html') {
      return this.serveOfflinePage(req, res);
    }

    // Handle PWA JavaScript
    if (pathname === '/js/pwa.js') {
      return this.servePWAJS(req, res);
    }

    // Handle icon requests
    if (pathname.startsWith('/icons/')) {
      return this.serveIcon(req, res, pathname);
    }

    return false;
  }

  /**
   * Serve web app manifest
   */
  async serveManifest(req, res) {
    try {
      const manifestPath = path.join(this.publicPath, 'manifest.json');
      const manifest = await fs.readFile(manifestPath, 'utf8');

      // Customize manifest based on request
      let manifestData = JSON.parse(manifest);

      // Add dynamic values
      manifestData.start_url = `${req.protocol || 'http'}://${req.headers.host}/`;
      manifestData.scope = `${req.protocol || 'http'}://${req.headers.host}/`;

      res.writeHead(200, {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(JSON.stringify(manifestData, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to serve manifest:', error);
      return false;
    }
  }

  /**
   * Serve service worker
   */
  async serveServiceWorker(req, res) {
    try {
      const swPath = path.join(this.publicPath, 'sw.js');
      const swContent = await fs.readFile(swPath, 'utf8');

      res.writeHead(200, {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache',
        'Service-Worker-Allowed': '/'
      });
      res.end(swContent);
      return true;
    } catch (error) {
      console.error('Failed to serve service worker:', error);
      return false;
    }
  }

  /**
   * Serve offline page
   */
  async serveOfflinePage(req, res) {
    try {
      const offlinePath = path.join(this.publicPath, 'offline.html');
      const offlineContent = await fs.readFile(offlinePath, 'utf8');

      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(offlineContent);
      return true;
    } catch (error) {
      console.error('Failed to serve offline page:', error);
      return false;
    }
  }

  /**
   * Serve PWA JavaScript
   */
  async servePWAJS(req, res) {
    try {
      const pwaJSPath = path.join(this.publicPath, 'js', 'pwa.js');
      const pwaJSContent = await fs.readFile(pwaJSPath, 'utf8');

      res.writeHead(200, {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(pwaJSContent);
      return true;
    } catch (error) {
      console.error('Failed to serve PWA JS:', error);
      return false;
    }
  }

  /**
   * Serve icons (placeholder for now)
   */
  async serveIcon(req, res, pathname) {
    // For now, return a simple SVG icon
    // In production, you'd serve actual PNG icons
    const iconName = path.basename(pathname, path.extname(pathname));
    const size = iconName.split('-')[1] || '192';

    const svgIcon = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#2563eb">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>`;

    const contentType = pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400'
    });

    if (pathname.endsWith('.svg')) {
      res.end(svgIcon);
    } else {
      // For PNG, you'd serve actual PNG data
      // For now, redirect to a default icon or return 404
      res.writeHead(404);
      res.end('Icon not found');
    }

    return true;
  }

  /**
   * Add PWA headers to HTML responses
   */
  addPWAHeaders(res) {
    if (!this.pwaEnabled) return;

    // Add theme color
    res.setHeader('theme-color', '#2563eb');

    // Add Apple touch icon
    res.setHeader('apple-touch-icon', '/icons/icon-192.png');

    // Add viewport meta tag suggestion (can't set meta tags in headers)
    // This would need to be added to HTML templates
  }

  /**
   * Generate PWA install HTML snippet
   */
  getPWAInstallSnippet() {
    if (!this.pwaEnabled) return '';

    return `
      <!-- PWA Install Prompt -->
      <link rel="manifest" href="/manifest.json">
      <meta name="theme-color" content="#2563eb">
      <meta name="apple-mobile-web-app-capable" content="yes">
      <meta name="apple-mobile-web-app-status-bar-style" content="default">
      <meta name="apple-mobile-web-app-title" content="Qui Browser">
      <link rel="apple-touch-icon" href="/icons/icon-192.png">

      <!-- PWA Scripts -->
      <script src="/js/pwa.js"></script>
    `;
  }

  /**
   * Get PWA status
   */
  getPWAStatus() {
    return {
      enabled: this.pwaEnabled,
      manifest: '/manifest.json',
      serviceWorker: '/sw.js',
      offlinePage: '/offline.html',
      installSnippet: this.getPWAInstallSnippet()
    };
  }

  /**
   * Handle PWA-related API requests
   */
  async handlePWAApiRequest(req, res, pathname, query) {
    if (!this.pwaEnabled) {
      return false;
    }

    // Handle push subscription endpoint
    if (pathname === '/api/push-subscription' && req.method === 'POST') {
      return this.handlePushSubscription(req, res);
    }

    // Handle PWA status endpoint
    if (pathname === '/api/pwa/status' && req.method === 'GET') {
      return this.handlePWAStatus(req, res);
    }

    return false;
  }

  /**
   * Handle push subscription
   */
  async handlePushSubscription(req, res) {
    try {
      // Parse request body
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }

      const subscription = JSON.parse(body);

      // Store subscription (in a real app, you'd save to database)
      console.log('Push subscription received:', subscription);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));

      return true;
    } catch (error) {
      console.error('Push subscription error:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid subscription' }));
      return true;
    }
  }

  /**
   * Handle PWA status request
   */
  async handlePWAStatus(req, res) {
    const status = this.getPWAStatus();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return true;
  }
}

module.exports = PWAIntegration;
