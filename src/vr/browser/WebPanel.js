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
import { buildCurvedPlaneGeometry } from './curvedGeometry.js';
import { resolveInput, DEFAULT_SEARCH_ENGINE } from './urlResolver.js';
import { truncate } from './bookmarkLayout.js';

const PANEL_W = 1.6;    // metres
const PANEL_H = 1.0;
const CHROME_H = 0.08;  // URL bar height fraction of total

/**
 * Character budget for the URL bar, derived from its pixel width and font.
 *
 * The URL bar previously drew the full URL with no truncation or max-width, so
 * a long URL overflowed the bar and overlapped the bookmark/close buttons —
 * a visual bug and a security concern (an overflowing address obscures which
 * site you are actually on). This returns how many monospace glyphs fit in the
 * bar so the URL can be truncated with an ellipsis, keeping the scheme+host
 * (the anti-phishing anchor) visible.
 *
 * Pure / dependency-free so the budget maths is unit-testable.
 *
 * @param {number} barWidthPx - inner width of the URL bar in canvas px
 * @param {number} [fontPx=18] - monospace font size in px
 * @returns {number} max glyph count (≥ 8) that fits, accounting for padding
 */
export function urlBarMaxChars(barWidthPx, fontPx = 18) {
  // Monospace advance width is ~0.6em; reserve ~16px of left/right padding.
  const advance = fontPx * 0.6;
  return Math.max(8, Math.floor((barWidthPx - 16) / advance));
}

export class WebPanel {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {Function} opts.registerInteractable   — from VRApp
   * @param {Function} opts.unregisterInteractable — from VRApp
   * @param {Function} [opts.onNavigate]           — called with (url, title)
   */
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {Function} opts.registerInteractable
   * @param {Function} opts.unregisterInteractable
   * @param {Function} [opts.onNavigate]          — called with (url, title)
   * @param {Function} [opts.onUrlInputRequested] — (currentUrl, confirmCb) called when
   *   the user selects the URL bar.  If omitted, falls back to window.prompt().
   */
  constructor({ scene, registerInteractable, unregisterInteractable, onNavigate,
    onUrlInputRequested, searchEngine, isBookmarked, onToggleBookmark, onLoadError,
    onHoverCaption }) {
    this.scene = scene;
    this.registerInteractable = registerInteractable;
    this.unregisterInteractable = unregisterInteractable;
    this.onNavigate = onNavigate || (() => {});
    this.onLoadError = onLoadError || (() => {});
    this.onUrlInputRequested = onUrlInputRequested || null;
    // Search engine for non-URL input (key into SEARCH_ENGINES). Defaults to
    // a privacy-respecting engine; overridable via settings.
    this.searchEngine = searchEngine || DEFAULT_SEARCH_ENGINE;
    // Bookmark integration (backed by VRApp's BookmarkStore). Both optional;
    // when absent the star button is hidden.
    this.isBookmarked = typeof isBookmarked === 'function' ? isBookmarked : null;
    this.onToggleBookmark = typeof onToggleBookmark === 'function' ? onToggleBookmark : null;
    this.onHoverCaption = typeof onHoverCaption === 'function' ? onHoverCaption : null;
    this.currentTitle = '';

    // Panel state
    this.currentUrl  = '';
    this.history     = [];
    this.historyIdx  = -1;
    this.loading     = false;
    this._loadError  = false; // set true on iframe onerror, cleared on next navigate
    this.domOverlaySupported = false;

    // FR-1.5: optional native quad-layer mode (set via enableLayerMode()).
    this.quadLayer    = null;
    this.layersSystem = null;
    this._layerDirty  = false; // set true whenever chromeCanvas changes

    // Curved-screen state (Quest-style). Off = flat plane content area.
    this.curved       = false;
    this.curveRadius  = 2.2; // metres

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
      onSelect: (evt) => this._onChromeSelect(evt),
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

    // Back button — dimmed when no history to go back to
    const canBack = this.historyIdx > 0;
    ctx.fillStyle = canBack ? '#3a3a5c' : '#22222e';
    ctx.fillRect(8, 6, 60, h - 12);
    ctx.fillStyle = canBack ? '#ffffff' : '#44445a';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◀', 38, h / 2 + 8);

    // Forward button — dimmed when at the latest history entry
    const canForward = this.historyIdx < this.history.length - 1;
    ctx.fillStyle = canForward ? '#3a3a5c' : '#22222e';
    ctx.fillRect(76, 6, 60, h - 12);
    ctx.fillStyle = canForward ? '#ffffff' : '#44445a';
    ctx.fillText('▶', 106, h / 2 + 8);

    // Reload button
    ctx.fillStyle = '#3a3a5c';
    ctx.fillRect(144, 6, 60, h - 12);
    ctx.fillStyle = this.loading ? '#ffaa00' : '#ffffff';
    ctx.fillText('↺', 174, h / 2 + 8);

    // Whether the bookmark button is shown (only when wired to a store).
    const hasBookmark = !!this.onToggleBookmark;
    // URL bar: leave room for [bookmark][close] on the right when bookmarking.
    const urlRight = hasBookmark ? 136 : 72; // px from right edge to URL-bar end
    const barW = w - 212 - urlRight;          // URL bar inner width (px)
    ctx.fillStyle = this._loadError ? '#3a1a1a' : '#2a2a4a';
    ctx.fillRect(212, 6, barW, h - 12);
    // Truncate to fit the bar so a long URL can't overflow into the buttons.
    const maxChars = urlBarMaxChars(barW, this._loadError ? 17 : 18);
    let urlText;
    if (this._loadError) {
      ctx.fillStyle = '#ff7777';
      ctx.font = '17px sans-serif';
      urlText = truncate(`⚠ Failed to load: ${this.currentUrl}`, maxChars);
    } else {
      ctx.fillStyle = this.currentUrl ? '#e0e0ff' : '#888899';
      ctx.font = '18px monospace';
      urlText = truncate(this.currentUrl || 'https://', maxChars);
    }
    ctx.textAlign = 'left';
    ctx.fillText(urlText, 220, h / 2 + 6);

    // Bookmark (star) button
    if (hasBookmark) {
      const marked = this.isBookmarked ? !!this.isBookmarked(this.currentUrl) : false;
      ctx.fillStyle = '#3a3a5c';
      ctx.fillRect(w - 128, 6, 56, h - 12);
      ctx.fillStyle = marked ? '#ffcc44' : '#aaaabb';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(marked ? '★' : '☆', w - 100, h / 2 + 9);
    }

    // Close button
    ctx.fillStyle = '#5c1a1a';
    ctx.fillRect(w - 60, 6, 54, h - 12);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('✕', w - 33, h / 2 + 8);

    this.chromeTex.needsUpdate = true;
    this._layerDirty = true; // signal that the layer texture also needs refresh
  }

  // ── Interaction ───────────────────────────────────────────────────────────

  _onChromeSelect(evt) {
    // Controllers fire onSelect({ intersection: THREE.Intersection, controller })
    // and gaze fires onSelect({ intersection: hit, gaze: true }). Extract the
    // THREE.Vector3 hit point; fall back to evt itself for direct calls.
    const rawPoint = evt?.intersection?.point ?? evt;
    if (!rawPoint) {
      return;
    }
    // Map intersection point on the mesh to canvas UV.
    // chromeMesh is PANEL_W × (PANEL_H * CHROME_H) centred at chromeMesh.position.
    const local = this.chromeMesh.worldToLocal(rawPoint.clone());
    const u = (local.x / PANEL_W) + 0.5;       // 0–1
    const px = Math.round(u * this.chromeCanvas.width);

    const w = this.chromeCanvas.width;
    const hasBookmark = !!this.onToggleBookmark;

    if (px < 68) {           // back button
      this.back();
    } else if (px < 136) {   // forward
      this.forward();
    } else if (px < 204) {   // reload
      this.reload();
    } else if (px > w - 60) { // close
      this.hide();
    } else if (hasBookmark && px >= w - 128 && px <= w - 72) { // bookmark star
      if (this.currentUrl) {
        this.onToggleBookmark(this.currentUrl, this.currentTitle || this.currentUrl);
        this._drawChrome(); // reflect the new ★/☆ state
      }
    } else {                  // URL bar — request text input
      const prefill = this.currentUrl || 'https://';
      if (this.onUrlInputRequested) {
        this.onUrlInputRequested(prefill, (url) => {
          if (url) {
            this.navigate(url);
          }
        });
      } else {
        // Fallback: synchronous prompt (only available outside immersive VR).
        // eslint-disable-next-line no-alert -- intentional desktop/2D fallback
        const url = window.prompt('Enter URL', prefill);
        if (url) {
          this.navigate(url);
        }
      }
    }
  }

  _onChromeHover(entering) {
    // MeshBasicMaterial has no emissiveIntensity; tint via color multiplier.
    if (this.chromeMesh && this.chromeMesh.material) {
      this.chromeMesh.material.color.set(entering ? 0xaaaaff : 0xffffff);
    }
    if (entering && this.onHoverCaption) {
      this.onHoverCaption();
    }
  }

  // ── Navigation API ────────────────────────────────────────────────────────

  /**
   * Navigate to a URL.  Records history and loads the iframe if dom-overlay
   * is available; otherwise just updates the chrome bar.
   */
  navigate(url) {
    // Resolve the raw input into a navigable URL. Text that looks like a host
    // becomes https://…; anything else becomes a search query. Dangerous
    // schemes (javascript:, data:, file:) resolve to null and are ignored.
    const resolved = resolveInput(url, { searchEngine: this.searchEngine });
    if (!resolved) {
      return;
    }
    url = resolved;

    // Trim forward history and push new entry.
    this.history = this.history.slice(0, this.historyIdx + 1);
    this.history.push(url);
    this.historyIdx = this.history.length - 1;

    this._loadUrl(url);
  }

  _loadUrl(url) {
    this.currentUrl = url;
    this.loading = true;
    this._loadError = false;
    this._drawChrome();

    // Load in iframe (visible only when dom-overlay is active).
    this.iframe.src = url;
    this.iframe.onload = () => {
      this.loading = false;
      this._loadError = false;
      let title = url;
      try {
        title = this.iframe.contentDocument.title || url;
      } catch { /* cross-origin frame: keep the URL as the title */ }
      this.currentTitle = title;
      this._drawChrome();
      this.onNavigate(url, title);
    };
    this.iframe.onerror = () => {
      this.loading = false;
      this._loadError = true;
      this._drawChrome();
      this.onLoadError(this.currentUrl);
    };
  }

  back() {
    if (this.historyIdx > 0) {
      this.historyIdx--;
      this._loadUrl(this.history[this.historyIdx]);
    }
  }

  forward() {
    if (this.historyIdx < this.history.length - 1) {
      this.historyIdx++;
      this._loadUrl(this.history[this.historyIdx]);
    }
  }

  /**
   * Navigate back one step.  Returns true if navigation occurred, false if
   * already at the earliest history entry (WCAG 4.1.3: callers can announce
   * the blocked state via caption / haptic rather than silently no-oping).
   * @returns {boolean}
   */
  goBack() {
    if (this.historyIdx > 0) {
      this.back();
      return true;
    }
    return false;
  }

  /**
   * Navigate forward one step.  Returns true if navigation occurred, false if
   * already at the latest history entry.
   * @returns {boolean}
   */
  goForward() {
    if (this.historyIdx < this.history.length - 1) {
      this.forward();
      return true;
    }
    return false;
  }

  reload() {
    if (this.currentUrl) {
      this._loadUrl(this.currentUrl);
    }
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

  // ── FR-1.5: native quad-layer mode ────────────────────────────────────────

  /**
   * Switch to native XRQuadLayer rendering for the chrome bar.  When active
   * the Three.js chromeMesh is hidden (the runtime composites the layer at
   * native display resolution instead).  Falls back silently if layer is null.
   *
   * @param {XRQuadLayer}  quadLayer     — layer created by LayersSystem
   * @param {LayersSystem} layersSystem  — the owning LayersSystem instance
   */
  enableLayerMode(quadLayer, layersSystem) {
    if (!quadLayer || !layersSystem) {
      return;
    }
    this.quadLayer    = quadLayer;
    this.layersSystem = layersSystem;
    // Hide the Three.js chrome mesh — the runtime composites the layer instead.
    if (this.chromeMesh) {
      this.chromeMesh.visible = false;
    }
    this._layerDirty = true;
  }

  /** Revert to the standard Three.js mesh path (e.g. on session end). */
  disableLayerMode() {
    if (this.chromeMesh) {
      this.chromeMesh.visible = true;
    }
    this.quadLayer    = null;
    this.layersSystem = null;
  }

  /**
   * Per-frame: blit the chrome canvas into the quad layer when the content
   * has changed.  Should be called from the render loop while in VR.
   *
   * @param {XRFrame}  frame
   * @param {XRView[]} views
   */
  updateLayer(frame, views) {
    if (!this.quadLayer || !this.layersSystem || !this._layerDirty) {
      return;
    }
    this.layersSystem.renderCanvasToLayer(
      this.quadLayer, this.chromeCanvas, frame, views
    );
    this._layerDirty = false;
  }

  // ── Curved screen (Quest-style flat ↔ curved) ─────────────────────────────

  /**
   * Toggle the content area between a flat plane and a concave curved surface.
   * Only the content (reading) area is curved; the chrome bar stays flat so
   * its UV-based hit-testing remains exact.
   *
   * @param {boolean} value
   * @param {number}  [radius] — curve radius in metres (defaults to curveRadius)
   */
  /** Update the search engine used by address-bar queries on this panel. */
  setSearchEngine(engine) {
    this.searchEngine = engine;
  }

  setCurved(value, radius = this.curveRadius) {
    value = !!value;
    if (value === this.curved || !this.contentMesh) {
      return this.curved;
    }
    this.curved = value;
    this.curveRadius = radius;

    const oldGeo = this.contentMesh.geometry;
    if (value) {
      this.contentMesh.geometry = buildCurvedPlaneGeometry(THREE, {
        width: PANEL_W,
        height: PANEL_H * (1 - CHROME_H),
        radius,
        segmentsX: 24,
        segmentsY: 1
      });
    } else {
      this.contentMesh.geometry = new THREE.PlaneGeometry(PANEL_W, PANEL_H * (1 - CHROME_H));
    }
    if (oldGeo && oldGeo.dispose) {
      oldGeo.dispose();
    }
    return this.curved;
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
    this.disableLayerMode();
    this.unregisterInteractable(this.chromeMesh);

    this.group.traverse(obj => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (obj.material.map) {
          obj.material.map.dispose();
        }
        obj.material.dispose();
      }
    });

    this.scene.remove(this.group);

    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
  }
}
