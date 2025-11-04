/**
 * VR Content Loader Module
 *
 * Load and render web content in VR
 * - Fetch HTML/CSS/JavaScript
 * - Render DOM in 3D space using Canvas + Three.js
 * - Handle navigation
 * - DOM interaction
 *
 * ~350 lines
 */

class VRContentLoader {
  constructor(scene) {
    this.scene = scene;
    this.currentURL = '';
    this.currentHTML = '';
    this.contentContainer = null;
    this.canvasTexture = null;
    this.mesh = null;

    this.cache = new Map();
    this.maxCacheSize = 50;
  }

  /**
   * Load URL
   */
  async loadURL(url) {
    console.log('[ContentLoader] Loading URL:', url);

    try {
      // Validate URL
      if (!this.isValidURL(url)) {
        throw new Error('Invalid URL: ' + url);
      }

      // Check cache
      if (this.cache.has(url)) {
        const cachedHTML = this.cache.get(url);
        this.loadHTML(cachedHTML);
        return;
      }

      // Fetch content
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch: ' + response.statusText);
      }

      const html = await response.text();

      // Cache
      this.addToCache(url, html);

      // Load
      this.loadHTML(html);
      this.currentURL = url;

      console.log('[ContentLoader] URL loaded successfully');
    } catch (error) {
      console.error('[ContentLoader] Failed to load URL:', error);
      this.loadErrorPage(error.message);
    }
  }

  /**
   * Load HTML content
   */
  loadHTML(html) {
    console.log('[ContentLoader] Loading HTML...');

    try {
      // Parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Create canvas for rendering
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 768;
      const ctx = canvas.getContext('2d');

      // Render HTML to canvas (simplified)
      this.renderHTMLToCanvas(ctx, canvas, doc.body);

      // Create texture
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;

      // Create material and mesh
      const material = new THREE.MeshBasicMaterial({ map: texture });
      const geometry = new THREE.PlaneGeometry(8, 6);

      // Remove old mesh
      if (this.mesh) {
        this.scene.remove(this.mesh);
      }

      // Add new mesh
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.position.set(0, 1.5, -3);
      this.scene.add(this.mesh);

      this.currentHTML = html;
      this.canvasTexture = texture;

      console.log('[ContentLoader] HTML rendered successfully');
    } catch (error) {
      console.error('[ContentLoader] Failed to load HTML:', error);
      this.loadErrorPage(error.message);
    }
  }

  /**
   * Render HTML to canvas (very simplified)
   */
  renderHTMLToCanvas(ctx, canvas, element) {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#000';
    ctx.font = '16px Arial';
    ctx.textBaseline = 'top';

    let y = 20;
    const lineHeight = 24;
    const margin = 20;
    const maxWidth = canvas.width - margin * 2;

    // Recursively render elements
    this.renderElement(ctx, element, {
      x: margin,
      y: y,
      maxWidth: maxWidth,
      lineHeight: lineHeight
    });
  }

  /**
   * Recursively render DOM element
   */
  renderElement(ctx, element, layout) {
    if (!element) return;

    const tagName = element.tagName ? element.tagName.toLowerCase() : '';

    // Handle different element types
    switch (tagName) {
      case 'h1':
        ctx.font = 'bold 28px Arial';
        ctx.fillText(element.textContent, layout.x, layout.y);
        layout.y += layout.lineHeight * 1.5;
        break;

      case 'h2':
        ctx.font = 'bold 22px Arial';
        ctx.fillText(element.textContent, layout.x, layout.y);
        layout.y += layout.lineHeight * 1.3;
        break;

      case 'p':
      case 'div':
        ctx.font = '16px Arial';
        const text = element.textContent.trim();
        if (text) {
          this.wrapText(ctx, text, layout.x, layout.y, layout.maxWidth, layout.lineHeight);
          layout.y += layout.lineHeight * 2;
        }
        break;

      case 'a':
        ctx.fillStyle = '#0066cc';
        ctx.font = 'underline 16px Arial';
        ctx.fillText(element.textContent, layout.x, layout.y);
        layout.y += layout.lineHeight;
        ctx.fillStyle = '#000';
        break;

      case 'li':
        ctx.font = '16px Arial';
        ctx.fillText('• ' + element.textContent, layout.x, layout.y);
        layout.y += layout.lineHeight;
        break;

      case 'button':
        ctx.fillStyle = '#007bff';
        ctx.fillRect(layout.x, layout.y, 150, 40);
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(element.textContent, layout.x + 75, layout.y + 12);
        ctx.textAlign = 'left';
        layout.y += layout.lineHeight * 2;
        break;
    }

    // Render children
    for (const child of element.children) {
      if (layout.y < 750) { // Prevent overflow
        this.renderElement(ctx, child, layout);
      }
    }
  }

  /**
   * Wrap and render text
   */
  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';

    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line.trim(), x, y);
        line = word + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }

    if (line) {
      ctx.fillText(line.trim(), x, y);
    }
  }

  /**
   * Load error page
   */
  loadErrorPage(errorMessage) {
    const errorHTML = `
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body>
        <h1>エラー</h1>
        <p>${errorMessage}</p>
      </body>
      </html>
    `;

    this.loadHTML(errorHTML);
  }

  /**
   * Validate URL
   */
  isValidURL(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cache management
   */
  addToCache(url, html) {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(url, html);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get current URL
   */
  getCurrentURL() {
    return this.currentURL;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRContentLoader;
}
