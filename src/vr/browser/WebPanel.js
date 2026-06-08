/**
 * FR-1.1 / FR-1.2: In-VR web panel with URL bar, back/forward, and reload.
 *
 * Architecture:
 *   Three.js plane mesh (the "panel chrome") + a hidden <iframe> composited
 *   on top via WebXR dom-overlay or positioned absolutely over the canvas.
 *   The URL bar and navigation controls are drawn on a CanvasTexture and
 *   registered as interactables so controller rays can interact with them.
 *
 * Limitations (documented honestly):
 *   - Cross-origin iframes are sandboxed: no cookies/autofill, no JS access.
 *   - On platforms without dom-overlay the iframe is not visible in VR;
 *     the panel shows a "Cannot render external content" placeholder.
 *   - This class provides the shell; FR-1.5 quad/cylinder Layers are a
 *     separate enhancement for text clarity.
 */

import * as THREE from 'three';

const PANEL_W = 1.6;    // metres
const PANEL_H = 1.0;
const CHROME_H = 0.08;  // URL bar height fraction of total

export class WebPanel {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {Function} opts.registerInteractable   — from VRApp
   * @param {Function} opts.unregisterInteractable — from VRApp
   * @param {Function} [opts.onNavigate]           — called with (url, title)
   */
  constructor({ scene, registerInteractable, unregisterInteractable, onNavigate }) {
    this.scene = scene;
    this.registerInteractable = registerInteractable;
    this.unregisterInteractable = unregisterInteractable;
    this.onNavigate = onNavigate || (() => {});

    // Panel state
    this.currentUrl  = '';
    this.history     = [];
    this.historyIdx  = -1;
    this.loading     = false;
    this.domOverlaySupported = false;

    // Three.js objects
    this.group       = new THREE.Group();
    this.chromeMesh  = null;   // URL bar + controls
    this.contentMesh = null;   // web content area

    // 2D resources
    this.chromeCanvas  = null;
    this.chromeTex     = null;
    this.iframe        = null;

    this._build();
  }

  // ── Construction ──────────────────────────────────────────────────────────

  _build() {
    // ── Chrome bar (URL bar + back/forward/reload) ──────────────────────────
    this.chromeCanvas = document.createElement('canvas');
    this.chromeCanvas.width  = 1024;
    this.chromeCanvas.height = Math.round(1024 * CHROME_H);

    this.chromeTex = new THREE.CanvasTexture(this.chromeCanvas);

    const chromeGeo = new THREE.PlaneGeometry(PANEL_W, PANEL_H * CHROME_H);
    const chromeMat = new THREE.MeshBasicMaterial({
      map: this.chromeTex,
      transparent: false,
      side: THREE.FrontSide
    });
    this.chromeMesh = new THREE.Mesh(chromeGeo, chromeMat);
    this.chromeMesh.position.y = (PANEL_H - PANEL_H * CHROME_H) / 2;
    this.chromeMesh.name = 'webPanelChrome';
    this.group.add(this.chromeMesh);

    // ── Content area placeholder ────────────────────────────────────────────
    const contentCanvas = document.createElement('canvas');
    contentCanvas.width  = 1024;
    contentCanvas.height = Math.round(1024 * (1 - CHROME_H));
    const contentCtx = contentCanvas.getContext('2d');
    contentCtx.fillStyle = '#1a1a2e';
    contentCtx.fillRect(0, 0, contentCanvas.width, contentCanvas.height);
    contentCtx.fillStyle = '#a0a0b8';
    contentCtx.font = '28px sans-serif';
    contentCtx.textAlign = 'center';
    contentCtx.fillText('Enter a URL to navigate', contentCanvas.width / 2, contentCanvas.height / 2 - 20);
    contentCtx.font = '18px sans-serif';
    contentCtx.fillText('(WebXR dom-overlay required for external content)', contentCanvas.width / 2, contentCanvas.height / 2 + 20);

    const contentTex = new THREE.CanvasTexture(contentCanvas);
    const contentGeo = new THREE.PlaneGeometry(PANEL_W, PANEL_H * (1 - CHROME_H));
    const contentMat = new THREE.MeshBasicMaterial({ map: contentTex, side: THREE.FrontSide });
    this.contentMesh = new THREE.Mesh(contentGeo, contentMat);
    this.contentMesh.position.y = -PANEL_H * CHROME_H / 2;
    this.contentMesh.name = 'webPanelContent';
    this.group.add(this.contentMesh);

    this._drawChrome();

    // ── iframe for actual content (when dom-overlay is available) ───────────
    this.iframe = document.createElement('iframe');
    this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
    this.iframe.style.cssText = `
      position: fixed; display: none; border: none;
      width: 960px; height: 540px;
      pointer-events: auto; z-index: 999;
    `;
    document.body.appendChild(this.iframe);

    // ── Register chrome bar as interactable for controller ray ──────────────
    this.registerInteractable(this.chromeMesh, {
      onSelect: (point) => this._onChromeSelect(point),
      onHover: () => this._onChromeHover(true),
      onHoverEnd: () => this._onChromeHover(false)
    });
  }

  // ── Chrome drawing ────────────────────────────────────────────────────────

  _drawChrome() {
    const c = this.chromeCanvas;
    const ctx = c.getContext('2d');
    const w = c.width;
    const h = c.height;

    // Background
    ctx.fillStyle = '#1e1e3f';
    ctx.fillRect(0, 0, w, h);

    // Back button
    ctx.fillStyle = '#3a3a5c';
    ctx.fillRect(8, 6, 60, h - 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◀', 38, h / 2 + 8);

    // Forward button
    ctx.fillStyle = '#3a3a5c';
    ctx.fillRect(76, 6, 60, h - 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('▶', 106, h / 2 + 8);

    // Reload button
    ctx.fillStyle = '#3a3a5c';
    ctx.fillRect(144, 6, 60, h - 12);
    ctx.fillStyle = this.loading ? '#ffaa00' : '#ffffff';
    ctx.fillText('↺', 174, h / 2 + 8);

    // URL bar
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(212, 6, w - 280, h - 12);
    ctx.fillStyle = this.currentUrl ? '#e0e0ff' : '#888899';
    ctx.font = '18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      this.currentUrl || 'https://',
      220, h / 2 + 6
    );

    // Close button
    ctx.fillStyle = '#5c1a1a';
    ctx.fillRect(w - 60, 6, 54, h - 12);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('✕', w - 33, h / 2 + 8);

    this.chromeTex.needsUpdate = true;
  }

  // ── Interaction ───────────────────────────────────────────────────────────

  _onChromeSelect(intersectionPoint) {
    if (!intersectionPoint) return;
    // Map intersection point on the mesh to canvas UV.
    // chromeMesh is PANEL_W × (PANEL_H * CHROME_H) centred at chromeMesh.position.
    const local = this.chromeMesh.worldToLocal(intersectionPoint.clone());
    const u = (local.x / PANEL_W) + 0.5;       // 0–1
    const px = Math.round(u * this.chromeCanvas.width);

    if (px < 68) {           // back button
      this.back();
    } else if (px < 136) {   // forward
      this.forward();
    } else if (px < 204) {   // reload
      this.reload();
    } else if (px > this.chromeCanvas.width - 60) { // close
      this.hide();
    } else {                  // URL bar — open a prompt
      const url = window.prompt('Enter URL', this.currentUrl || 'https://');
      if (url) this.navigate(url);
    }
  }

  _onChromeHover(entering) {
    if (this.chromeMesh.material) {
      this.chromeMesh.material.emissiveIntensity = entering ? 0.1 : 0;
    }
  }

  // ── Navigation API ────────────────────────────────────────────────────────

  /**
   * Navigate to a URL.  Records history and loads the iframe if dom-overlay
   * is available; otherwise just updates the chrome bar.
   */
  navigate(url) {
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    this.currentUrl = url;
    this.loading = true;
    this._drawChrome();

    // Trim forward history and push new entry.
    this.history = this.history.slice(0, this.historyIdx + 1);
    this.history.push(url);
    this.historyIdx = this.history.length - 1;

    // Load in iframe (visible only when dom-overlay is active).
    this.iframe.src = url;
    this.iframe.onload = () => {
      this.loading = false;
      let title = url;
      try { title = this.iframe.contentDocument.title || url; } catch {}
      this._drawChrome();
      this.onNavigate(url, title);
    };
    this.iframe.onerror = () => {
      this.loading = false;
      this._drawChrome();
    };
  }

  back() {
    if (this.historyIdx > 0) {
      this.historyIdx--;
      this.navigate(this.history[this.historyIdx]);
    }
  }

  forward() {
    if (this.historyIdx < this.history.length - 1) {
      this.historyIdx++;
      this.navigate(this.history[this.historyIdx]);
    }
  }

  reload() {
    if (this.currentUrl) this.navigate(this.currentUrl);
  }

  // ── DOM-overlay integration ───────────────────────────────────────────────

  /**
   * Call this when a WebXR session with dom-overlay starts.
   * Shows the iframe positioned over the panel's projected screen area.
   */
  onDomOverlayStart() {
    this.domOverlaySupported = true;
    this.iframe.style.display = 'block';
  }

  /**
   * Call this when the WebXR session ends.
   */
  onDomOverlayEnd() {
    this.iframe.style.display = 'none';
  }

  // ── Visibility ────────────────────────────────────────────────────────────

  show(position = { x: 0, y: 1.5, z: -2 }) {
    this.group.position.set(position.x, position.y, position.z);
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
    this.iframe.style.display = 'none';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  addToScene() {
    this.scene.add(this.group);
  }

  dispose() {
    this.unregisterInteractable(this.chromeMesh);

    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });

    this.scene.remove(this.group);

    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
  }
}
