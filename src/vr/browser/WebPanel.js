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
import { configureUITexture } from '../ui/canvasTexture.js';
import { buildCurvedPlaneGeometry } from './curvedGeometry.js';
import { resolveInput, DEFAULT_SEARCH_ENGINE } from './urlResolver.js';
import { truncate } from './bookmarkLayout.js';
import {
  elideUrlForDisplay, securityLevel, securityIndicator, contentStateLines, readerFetchUrl
} from './urlDisplay.js';
import { extractReadableText } from './readableText.js';
import {
  layoutReaderLines, clampReaderScroll, readerWindow, readerProgressLabel,
  visibleLinesFor, fontPxFor, LINE_H, CONTENT_PAD,
  readerHitTest, pageJumpLines, ARROW_W, ARROW_H, ARROW_Y0, ARROW_UP_X0, ARROW_DN_X0
} from './readerLayout.js';
import { topSiteTiles, hitTestTopSites, TILE_TOP } from './topSitesLayout.js';
import { narrationChunks, narrationFromLine, splitSentences } from './readerNarration.js';
import { t } from '../../i18n/i18n.js';
import { prefersHighContrast } from '../../a11y/accessibility.js';
import { webChromeColors, webContentColors } from './chromeColors.js';
import {
  PANEL_W, PANEL_H, CHROME_H,
  MOVE_BAR_W, MOVE_BAR_H, MOVE_BAR_GAP, MOVE_BAR_HIT_H
} from './panelGeometry.js';


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
   * @param {Function} [opts.onGrabRequested] — called with (controller) when the
   *   move bar is selected; wire to WindowManager.beginGrab(controller).
   * @param {Function} [opts.onMoveBarHoverCaption] — called with no args on move
   *   bar hover-enter, so callers can announce it (WCAG 1.3.3).
   * @param {Function} [opts.onBlockedNavigation] — called with (rawInput) when
   *   navigate() resolves the typed text to null (a blocked scheme like
   *   javascript:/data:/file:, or an unparseable address) so callers can
   *   surface a status message (WCAG 4.1.3) instead of silently doing nothing.
   * @param {number} [opts.readerScale=1] — text-size multiplier for the reader
   *   viewport (compose with a11y largeTextScale at the call site).
   * @param {boolean} [opts.privateMode=false] — mark this panel private at
   *   creation (incognito-window semantics): private panels write no history
   *   and are excluded from tab-session persistence.
   * @param {Function} [opts.topSitesProvider] — () => [{url,title,host}];
   *   supplies the new-tab tile grid (getTopSites frecency). Null = no tiles.
   */
  constructor({ scene, registerInteractable, unregisterInteractable, onNavigate,
    onUrlInputRequested, searchEngine, isBookmarked, onToggleBookmark, onLoadError,
    onHoverCaption, onGrabRequested, onMoveBarHoverCaption, onBlockedNavigation,
    readerScale = 1, readerProxyUrl = '', privateMode = false, topSitesProvider = null }) {
    this.scene = scene;
    this.registerInteractable = registerInteractable;
    this.unregisterInteractable = unregisterInteractable;
    this.onNavigate = onNavigate || (() => {});
    this.onLoadError = onLoadError || (() => {});
    this.onBlockedNavigation = typeof onBlockedNavigation === 'function' ? onBlockedNavigation : null;
    this.onUrlInputRequested = onUrlInputRequested || null;
    // Search engine for non-URL input (key into SEARCH_ENGINES). Defaults to
    // a privacy-respecting engine; overridable via settings.
    this.searchEngine = searchEngine || DEFAULT_SEARCH_ENGINE;
    // Bookmark integration (backed by VRApp's BookmarkStore). Both optional;
    // when absent the star button is hidden.
    this.isBookmarked = typeof isBookmarked === 'function' ? isBookmarked : null;
    this.onToggleBookmark = typeof onToggleBookmark === 'function' ? onToggleBookmark : null;
    this.onHoverCaption = typeof onHoverCaption === 'function' ? onHoverCaption : null;
    // Grab-to-move: the move bar below the panel is a WindowManager.beginGrab()
    // trigger. Both optional; without onGrabRequested the bar still renders and
    // tints on hover but selecting it does nothing (WindowManager not wired).
    this.onGrabRequested = typeof onGrabRequested === 'function' ? onGrabRequested : null;
    this.onMoveBarHoverCaption = typeof onMoveBarHoverCaption === 'function' ? onMoveBarHoverCaption : null;
    this.currentTitle = '';

    // Panel state
    this.currentUrl  = '';
    this.history     = [];
    this.historyIdx  = -1;
    this.loading     = false;
    this._loadError  = false; // set true on iframe onerror, cleared on next navigate
    this.domOverlaySupported = false;
    // What the content area shows. 'empty' | 'loading' | 'reader' |
    // 'unavailable' | 'error'. There is deliberately no state claiming the
    // *page* is rendered: a WebXR web app cannot composite cross-origin page
    // pixels into a 3D texture. 'reader' means we fetched the markup and are
    // rendering the extracted text ourselves (see readableText.js).
    this._contentState = 'empty';
    this._readerLines = [];
    this._readerScroll = 0;
    this._readerScale = readerScale > 0 ? readerScale : 1;
    // Source blocks + title are retained after layout so live changes
    // (setReaderScale) and read-aloud (getReaderNarration) can rebuild the
    // line list without refetching the article.
    this._readerBlocks = null;
    this._readerTitle = '';
    // Find-in-page state: line indices matching the last findInReader query
    // and the cursor into them for findNextMatch/findPrevMatch.
    this._findMatches = [];
    this._findIndex = -1;
    this._lastFindQuery = null; // Ctrl+F bar's query text — cleared by Esc/load
    this._scrollMark = null; // Vim `` mark — scrollContentTo records pre-jump
    this._wordCaret = null; // {line, idx} NVDA word-nav caret; null = at scroll
    this._charCaret = null; // {line, idx} NVDA Left/Right char caret
    this._sentenceCaret = null; // {block, idx} NVDA Alt+Up/Down sentence caret
    this._readerSeq = 0; // guards against a slow fetch landing after a newer one
    this._loadController = null; // in-flight reader fetch, abortable by stop()
    // Private tabs (incognito-window semantics): no history writes, excluded
    // from session persistence — set once at creation, never toggled.
    this.isPrivate = !!privateMode;
    this._topSitesProvider = typeof topSitesProvider === 'function' ? topSitesProvider : null;
    this._topSiteTiles = []; // rects hit-tested by _onContentSelect
    // Optional companion proxy (proxy/server.js). Empty = direct fetch only.
    this.readerProxyUrl = typeof readerProxyUrl === 'string' ? readerProxyUrl : '';

    // FR-1.5: optional native quad-layer mode (set via enableLayerMode()).
    this.quadLayer    = null;
    this.layersSystem = null;
    this._layerId     = null;  // LayersSystem key for this panel's quad layer
    this._onLayerDetach = null; // callback to release the native layer on close
    this._layerDirty  = false; // set true whenever chromeCanvas changes

    // Curved-screen state (Quest-style). Off = flat plane content area.
    this.curved       = false;
    this.curveRadius  = 2.2; // metres

    // Three.js objects
    this.group       = new THREE.Group();
    this.chromeMesh  = null;   // URL bar + controls
    this.contentMesh = null;   // web content area
    this.moveBarMesh = null;   // grab-to-move handle (WindowManager.beginGrab)

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

    this.chromeTex = configureUITexture(new THREE.CanvasTexture(this.chromeCanvas));

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

    // ── Content area ────────────────────────────────────────────────────────
    // Kept on `this` (was a _build() local) so it can be REDRAWN as the panel's
    // state changes. Previously it was painted once and never again, so after a
    // successful navigation the viewport still read "Enter a URL to navigate"
    // forever — the panel silently misrepresented what it was showing.
    this.contentCanvas = document.createElement('canvas');
    this.contentCanvas.width  = 1024;
    this.contentCanvas.height = Math.round(1024 * (1 - CHROME_H));
    this.contentTex = configureUITexture(new THREE.CanvasTexture(this.contentCanvas));
    this._drawContent();

    const contentTex = this.contentTex;
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

    // ── Move bar (grab-to-move handle, Wolvic-style) ─────────────────────────
    // Selecting it starts a WindowManager.beginGrab() drag; releasing the
    // trigger ends it. The mesh is MOVE_BAR_HIT_H tall (3° at the default
    // panel distance) while only the middle MOVE_BAR_H band is painted, so the
    // handle keeps its slim look and gains a hittable margin above and below.
    // The bar is drawn white and tinted through `material.color`, which is how
    // _onMoveBarHover already worked — so the rendered colours are unchanged.
    this.moveBarCanvas = document.createElement('canvas');
    this.moveBarCanvas.width = 64;
    this.moveBarCanvas.height = Math.max(3, Math.round(64 * (MOVE_BAR_HIT_H / MOVE_BAR_W)));
    const mbCtx = this.moveBarCanvas.getContext('2d');
    if (mbCtx) {
      const barPx = Math.max(1, Math.round(this.moveBarCanvas.height * (MOVE_BAR_H / MOVE_BAR_HIT_H)));
      const y0 = Math.round((this.moveBarCanvas.height - barPx) / 2);
      mbCtx.clearRect(0, 0, this.moveBarCanvas.width, this.moveBarCanvas.height);
      mbCtx.fillStyle = '#ffffff';
      mbCtx.fillRect(0, y0, this.moveBarCanvas.width, barPx);
    }
    this.moveBarTex = configureUITexture(new THREE.CanvasTexture(this.moveBarCanvas));
    const moveBarGeo = new THREE.PlaneGeometry(MOVE_BAR_W, MOVE_BAR_HIT_H);
    const moveBarMat = new THREE.MeshBasicMaterial({
      color: 0x55556f, map: this.moveBarTex, transparent: true, side: THREE.FrontSide
    });
    this.moveBarMesh = new THREE.Mesh(moveBarGeo, moveBarMat);
    // Centre the mesh where the VISIBLE bar used to sit, so the handle does not
    // appear to move; the extra height is split evenly above and below it.
    this.moveBarMesh.position.y = -PANEL_H / 2 - MOVE_BAR_GAP - MOVE_BAR_H / 2;
    this.moveBarMesh.name = 'webPanelMoveBar';
    this.group.add(this.moveBarMesh);

    this.registerInteractable(this.moveBarMesh, {
      onSelect: (evt) => this.onGrabRequested?.(evt?.controller),
      onHover: () => this._onMoveBarHover(true),
      onHoverEnd: () => this._onMoveBarHover(false)
    });

    // The content area itself is selectable so the reader can be scrolled.
    // Without this the mesh was never registered at all, so a ray could not
    // reach it and the ONLY way to scroll was a voice command — leaving every
    // controller and gaze user stuck on the first screen of an article.
    this.registerInteractable(this.contentMesh, {
      onSelect: (evt) => this._onContentSelect(evt)
    });
  }

  // ── Chrome drawing ────────────────────────────────────────────────────────

  /**
   * Paint the content area to match `_contentState`.
   *
   * Honesty note: this panel renders browser *chrome* (URL bar, history,
   * tabs); it does not render web page content. A WebXR web app cannot
   * composite cross-origin page pixels into a 3D texture — X-Frame-Options /
   * CSP `frame-ancestors` block framing most sites outright, and even a framed
   * same-origin document's pixels are not readable into a WebGL texture. So
   * rather than showing a stale "Enter a URL to navigate" placeholder after a
   * navigation the user believes succeeded, the viewport states plainly what
   * it can and cannot show.
   */
  _drawContent() {
    if (!this.contentCanvas) {
      return;
    }
    const ctx = this.contentCanvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const w = this.contentCanvas.width;
    const h = this.contentCanvas.height;
    const col = webContentColors(prefersHighContrast());

    ctx.fillStyle = col.bg;
    ctx.fillRect(0, 0, w, h);

    if (this._contentState === 'reader') {
      this._drawReader(ctx, w, h, col);
      if (this.contentTex) {
        this.contentTex.needsUpdate = true;
      }
      return;
    }

    ctx.textAlign = 'center';
    const lines = contentStateLines(this._contentState, this.currentUrl, !!this.readerProxyUrl);
    ctx.fillStyle = col.stateTitle;
    ctx.font = '28px sans-serif';
    ctx.fillText(truncate(lines.title, 46), w / 2, h / 2 - 20);
    if (lines.detail) {
      ctx.font = '18px sans-serif';
      ctx.fillStyle = col.stateDetail;
      ctx.fillText(truncate(lines.detail, 72), w / 2, h / 2 + 20);
    }

    if (this._contentState === 'empty') {
      this._drawTopSites(ctx, w, col);
    }

    if (this.contentTex) {
      this.contentTex.needsUpdate = true;
    }
  }

  /**
   * Draw the frecency-ranked tile grid on the new-tab ('empty') state — the
   * one-dwell re-navigation path. Records the rects for _onContentSelect.
   */
  _drawTopSites(ctx, w, col) {
    const sites = this._topSitesProvider ? this._topSitesProvider() : [];
    this._topSiteTiles = topSiteTiles(sites.length, w);
    if (!sites.length || !this._topSiteTiles.length) {
      return;
    }
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = col.stateTitle;
    ctx.textAlign = 'center';
    ctx.fillText(t('vr.content.topSites'), w / 2, TILE_TOP - 16);
    sites.slice(0, this._topSiteTiles.length).forEach((site, i) => {
      const r = this._topSiteTiles[i];
      ctx.fillStyle = col.tileBg;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = col.tileBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      ctx.fillStyle = col.tileText;
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((site.host || '').replace(/^www\./, '').slice(0, 1).toUpperCase(),
        r.x + r.w / 2, r.y + 44);
      ctx.font = '17px sans-serif';
      ctx.fillText(truncate(site.host || site.url, 22), r.x + r.w / 2, r.y + 86);
    });
  }

  /**
   * Fetch a page's markup and render its readable text into the viewport.
   *
   * Only origins that send CORS headers are reachable from a browser context;
   * everything else rejects and falls back to the honest 'unavailable' state.
   * (Reaching non-CORS origins needs a server-side proxy — deliberately not
   * built here, since that is a new network surface needing SSRF hardening.)
   *
   * Uses the AbortController + clearTimeout idiom from JapaneseIME so a hung
   * request cannot pin the panel in 'loading' forever.
   */
  async _loadReaderText(url) {
    const seq = ++this._readerSeq;
    if (typeof fetch !== 'function') {
      this._setContentState('unavailable');
      return;
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    this._loadController = controller;
    const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;
    try {
      // Routed through the companion proxy when one is configured; otherwise a
      // direct fetch, which only reaches CORS-enabled origins (see readerFetchUrl).
      const fetchUrl = readerFetchUrl(url, this.readerProxyUrl);
      const res = await fetch(fetchUrl, controller ? { signal: controller.signal } : undefined);
      if (!res || !res.ok) {
        throw new Error(`HTTP ${res && res.status}`);
      }
      const html = await res.text();
      // A newer navigation started while this was in flight — discard.
      if (seq !== this._readerSeq) {
        return;
      }
      const { title, blocks } = extractReadableText(html);
      const lines = layoutReaderLines(blocks, { title, scale: this._readerScale });
      if (!lines.length) {
        // Fetched, but no prose recoverable (SPA shell, or markup we can't
        // read). Say so rather than showing a blank page.
        this._setContentState('unavailable');
        return;
      }
      this._findMatches = [];
      this._findIndex = -1;
      this._lastFindQuery = null;
      this._scrollMark = null;
      this._wordCaret = null;
      this._charCaret = null;
      this._sentenceCaret = null;
      this._readerLines = lines;
      this._readerBlocks = blocks;
      this._readerTitle = title;
      this._readerScroll = 0;
      this._contentState = 'reader';
      this._drawContent();
    } catch {
      if (seq === this._readerSeq) {
        this._setContentState('unavailable');
      }
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
      if (this._loadController === controller) {
        this._loadController = null;
      }
    }
  }

  /**
   * Stop the in-flight load — the reload↔stop pairing every desktop browser
   * uses: while `loading` the same button becomes a stop control. Aborts the
   * reader fetch, detaches the iframe handlers (a late load event must not
   * fire onNavigate against a stopped page), and lands on the honest
   * 'stopped' state — unless the reader already rendered, in which case the
   * article stays put (stop only cancels what is still pending).
   */
  stop() {
    if (!this.loading && !this._loadController) {
      return;
    }
    if (this._loadController) {
      this._loadController.abort();
      this._loadController = null;
    }
    // Invalidate any in-flight fetch that lacks a controller reference.
    this._readerSeq++;
    this.loading = false;
    this._loadError = false;
    if (this.iframe) {
      this.iframe.onload = null;
      this.iframe.onerror = null;
      this.iframe.src = 'about:blank';
    }
    if (this._contentState === 'loading') {
      this._setContentState('stopped');
    }
    this._drawChrome();
  }

  /**
   * Draw the reader viewport: the visible slice of laid-out lines plus a
   * progress label. Follows BookmarkPanel._draw()'s conventions (window slice
   * + progress indicator) so scrolling behaves the same way across panels.
   */
  _drawReader(ctx, w, h, col) {
    const visible = visibleLinesFor(this._readerLines.length, this._readerScale);
    const total = this._readerLines.length;
    // Clamp on the draw path too — the same discipline as BookmarkPanel, so
    // draw and input can never disagree and render an empty window.
    this._readerScroll = clampReaderScroll(this._readerScroll, total, visible);
    const window = readerWindow(this._readerLines, this._readerScroll, visible);

    ctx.textAlign = 'left';
    const lh = LINE_H * this._readerScale;
    let y = CONTENT_PAD + lh;
    for (const line of window) {
      if (line.style !== 'blank' && line.text) {
        // Find-in-page hits paint a box behind the text — Chrome's Ctrl+F
        // distinction: orange for the current match, yellow for the rest.
        if (line._findHit) {
          ctx.fillStyle = line._findHit === 'current' ? col.findCurrent : col.findHit;
          ctx.fillRect(CONTENT_PAD - 4, y - lh * 0.85, w - 2 * CONTENT_PAD + 8, lh);
        }
        ctx.font = `${line.style === 'p' ? '' : 'bold '}${fontPxFor(line.style, this._readerScale)}px sans-serif`;
        ctx.fillStyle = line.style === 'p' ? col.readerBody : col.readerHeading;
        ctx.fillText(line.text, CONTENT_PAD, y, w - 2 * CONTENT_PAD);
      }
      y += lh;
    }

    const label = readerProgressLabel(this._readerScroll, total, visible);
    if (label) {
      ctx.textAlign = 'left';
      ctx.font = '16px sans-serif';
      ctx.fillStyle = col.progress;
      ctx.fillText(label, CONTENT_PAD, h - 30);
    }

    // Scroll arrows — the only visible affordance telling the user there is
    // more to read and that the panel is selectable. Drawn whenever the
    // article overflows one screen; dimmed at the ends so the state is legible
    // without relying on colour alone (the glyph is always present).
    if (total > visible) {
      const canUp = this._readerScroll > 0;
      const canDown = this._readerScroll < total - visible;
      const drawArrow = (x, glyph, active) => {
        ctx.fillStyle = active ? col.arrowActiveBg : col.arrowIdleBg;
        ctx.fillRect(x, ARROW_Y0, ARROW_W, ARROW_H);
        ctx.fillStyle = active ? col.arrowActiveText : col.arrowIdleText;
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(glyph, x + ARROW_W / 2, ARROW_Y0 + ARROW_H / 2 + 12);
      };
      drawArrow(ARROW_UP_X0, '▲', canUp);
      drawArrow(ARROW_DN_X0, '▼', canDown);
    }
  }

  /**
   * Selecting the content area: route to the reader's scroll arrows.
   * Controllers and gaze both arrive here through the same registration, so
   * one implementation serves both input modes.
   */
  _onContentSelect(evt) {
    if (this._contentState !== 'reader' && this._contentState !== 'empty') {
      return;
    }
    if (!this.contentCanvas) {
      return;
    }
    const rawPoint = evt?.intersection?.point ?? evt;
    if (!rawPoint) {
      return;
    }
    const local = this.contentMesh.worldToLocal(rawPoint.clone());
    const contentH = PANEL_H * (1 - CHROME_H);
    const u = (local.x / PANEL_W) + 0.5;
    const v = (local.y / contentH) + 0.5;
    const px = u * this.contentCanvas.width;
    const py = (1 - v) * this.contentCanvas.height; // canvas y grows downward

    if (this._contentState === 'empty') {
      const idx = hitTestTopSites(px, py, this._topSiteTiles);
      if (idx >= 0) {
        const sites = this._topSitesProvider ? this._topSitesProvider() : [];
        const site = sites[idx];
        if (site && site.url) {
          this.navigate(site.url);
        }
      }
      return;
    }

    const visible = visibleLinesFor(this._readerLines.length, this._readerScale);
    const scrollable = this._readerLines.length > visible;
    const action = readerHitTest(px, py, scrollable);
    if (action.type === 'scrollUp') {
      this.scrollContent(-pageJumpLines(visible));
    } else if (action.type === 'scrollDown') {
      this.scrollContent(pageJumpLines(visible));
    }
  }

  /**
   * Scroll the reader viewport by `delta` lines. Routed through the same
   * clamp as the draw path; repaints explicitly because `_setContentState`
   * early-returns when the state is unchanged.
   * @param {number} delta positive = further down the article
   * @returns {boolean} true when the offset actually moved
   */
  scrollContent(delta) {
    if (this._contentState !== 'reader') {
      return false;
    }
    const visible = visibleLinesFor(this._readerLines.length, this._readerScale);
    const next = clampReaderScroll(
      this._readerScroll + (Number.isFinite(delta) ? delta : 0),
      this._readerLines.length,
      visible
    );
    if (next === this._readerScroll) {
      return false;
    }
    this._readerScroll = next;
    this._drawContent();
    return true;
  }

  /**
   * Jump the reader viewport to an absolute line offset — the Home/End atoms
   * desktop browsers get from the keyboard. Same clamp + repaint discipline
   * as scrollContent.
   * @param {number} line target first-visible line
   * @returns {boolean} true when the offset actually moved
   */
  scrollContentTo(line) {
    if (this._contentState !== 'reader') {
      return false;
    }
    const visible = visibleLinesFor(this._readerLines.length, this._readerScale);
    const next = clampReaderScroll(
      Number.isFinite(line) ? line : 0,
      this._readerLines.length,
      visible
    );
    if (next === this._readerScroll) {
      return false;
    }
    this._scrollMark = this._readerScroll;
    this._readerScroll = next;
    this._drawContent();
    return true;
  }

  /**
   * Vim Ctrl+D/Ctrl+U parity — half a visible page instead of the full
   * page-jump the arrow hit zones use. Returns true when the offset moved.
   */
  scrollHalfPage(direction = 1) {
    if (this._contentState !== 'reader') {
      return false;
    }
    const visible = visibleLinesFor(this._readerLines.length, this._readerScale);
    return this.scrollContent(Math.ceil(visible / 2) * (direction < 0 ? -1 : 1));
  }

  /**
   * Kindle "go to N%" parity — absolute percent position in the article.
   * Returns null outside the reader, 'out' for out-of-range percents, and
   * true/false for moved/unmoved within range.
   */
  scrollToPercent(pct) {
    if (this._contentState !== 'reader' || !this._readerLines.length) {
      return null;
    }
    const n = Number(pct);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return 'out';
    }
    return this.scrollContentTo(Math.floor(this._readerLines.length * n / 100));
  }

  /**
   * Jump back to the position before the last jump — Vim's `` `` `` mark.
   * scrollContentTo re-marks the current line before moving, so repeated
   * calls toggle between the two spots. false when nothing was jumped
   * (fresh article) or the mark lands where we already are.
   */
  jumpBack() {
    if (this._contentState !== 'reader' || !Number.isFinite(this._scrollMark)) {
      return false;
    }
    return this.scrollContentTo(this._scrollMark);
  }

  /**
   * Advance the word caret — NVDA/JAWS Ctrl+Right/Left parity. Each laid-out
   * reader line segments into word tokens via Intl.Segmenter (CJK-safe;
   * whitespace split as fallback). A null caret inits at the scroll line's
   * near edge for the direction. Crossing a line follows the caret with
   * scrollContentTo so the spoken word stays in the viewport — which also
   * marks the scroll position for jumpBack, matching other jump atoms.
   * @param {number} direction positive = forward
   * @returns {{word: string, line: number}|null} word + its line, or null at
   *          the article's edge / outside reader
   */
  nextWord(direction = 1) {
    if (this._contentState !== 'reader' || !this._readerLines.length) {
      return null;
    }
    const dir = direction >= 0 ? 1 : -1;
    const wordsOf = (line) => this._wordsOf(line);
    if (!this._wordCaret) {
      const line = Math.min(this._readerScroll, this._readerLines.length - 1);
      const n = wordsOf(line).length;
      this._wordCaret = { line, idx: dir > 0 ? -1 : n };
    }
    let { line, idx } = this._wordCaret;
    idx += dir;
    while (line >= 0 && line < this._readerLines.length) {
      const words = wordsOf(line);
      if (idx >= 0 && idx < words.length) {
        this._wordCaret = { line, idx };
        if (line !== this._readerScroll) {
          this.scrollContentTo(line);
        }
        return { word: words[idx], line };
      }
      line += dir;
      if (line >= 0 && line < this._readerLines.length) {
        idx = dir > 0 ? 0 : wordsOf(line).length - 1;
      }
    }
    return null;
  }

  /**
   * Word tokens of one laid-out line — Intl.Segmenter word granularity
   * (CJK-safe), whitespace split as fallback. Shared by nextWord's caret
   * walk and currentWord's position query.
   */
  _wordsOf(line) {
    const text = this._readerLines[line]?.text || '';
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter('ja', { granularity: 'word' });
      return [...seg.segment(text)]
        .filter((s) => s.isWordLike)
        .map((s) => s.segment);
    }
    return text.split(/\s+/).filter(Boolean);
  }

  /**
   * Grapheme clusters of one laid-out line — the char-caret unit. Intl
   * grapheme segmentation keeps surrogate pairs and combining sequences
   * whole (a surrogate slice would render �); [...text] is the fallback.
   */
  _charsOf(line) {
    const text = this._readerLines[line]?.text || '';
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter('ja', { granularity: 'grapheme' });
      return [...seg.segment(text)].map((s) => s.segment);
    }
    return [...text];
  }

  /**
   * Advance the char caret — NVDA/JAWS Right/Left single-character review.
   * Same caret shape as nextWord, one line at a time; crossing a line
   * follows the caret with scrollContentTo (which marks for jumpBack).
   * @param {number} direction positive = forward
   * @returns {{char: string, line: number}|null} null at article edge /
   *          outside the reader
   */
  nextChar(direction = 1) {
    if (this._contentState !== 'reader' || !this._readerLines.length) {
      return null;
    }
    const dir = direction >= 0 ? 1 : -1;
    const charsOf = (line) => this._charsOf(line);
    if (!this._charCaret) {
      const line = Math.min(this._readerScroll, this._readerLines.length - 1);
      const n = charsOf(line).length;
      this._charCaret = { line, idx: dir > 0 ? -1 : n };
    }
    let { line, idx } = this._charCaret;
    idx += dir;
    while (line >= 0 && line < this._readerLines.length) {
      const chars = charsOf(line);
      if (idx >= 0 && idx < chars.length) {
        this._charCaret = { line, idx };
        if (line !== this._readerScroll) {
          this.scrollContentTo(line);
        }
        return { char: chars[idx], line };
      }
      line += dir;
      if (line >= 0 && line < this._readerLines.length) {
        idx = dir > 0 ? 0 : charsOf(line).length - 1;
      }
    }
    return null;
  }

  prevChar() {
    return this.nextChar(-1);
  }

  /**
   * The word under the caret without moving — NVDA read-current-word
   * (numpad 5) parity. A live word caret wins; otherwise the scroll line's
   * first word (the position a caret would take). Null outside the reader
   * or on a wordless line.
   */
  currentWord() {
    if (this._contentState !== 'reader' || !this._readerLines.length) {
      return null;
    }
    if (this._wordCaret) {
      const words = this._wordsOf(this._wordCaret.line);
      if (this._wordCaret.idx >= 0 && this._wordCaret.idx < words.length) {
        return { word: words[this._wordCaret.idx], line: this._wordCaret.line };
      }
    }
    const line = Math.min(this._readerScroll, this._readerLines.length - 1);
    const words = this._wordsOf(line);
    return words.length ? { word: words[0], line } : null;
  }

  /**
   * The current word spelled grapheme-by-grapheme — NVDA's spell gesture
   * (double numpad 5) parity. '、'-separated so the TTS reads each unit
   * individually instead of blending them back into the word.
   */
  spellWord() {
    const w = this.currentWord();
    if (!w) {
      return null;
    }
    const chars = typeof Intl !== 'undefined' && Intl.Segmenter
      ? [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(w.word)]
        .map((s) => s.segment)
      : [...w.word];
    return { spelled: chars.join('、'), word: w.word };
  }

  /**
   * Clear the find matches and their highlight tags — Chrome's Esc key
   * dismisses the find bar. Returns true when a search was active.
   */
  clearFind() {
    const had = this._findMatches.length > 0;
    this._findMatches = [];
    this._findIndex = -1;
    this._lastFindQuery = null;
    if (had) {
      this._markFindHits();
    }
    return had;
  }

  /** Jump to the first line of the article. */
  scrollToTop() {
    return this.scrollContentTo(0);
  }

  /** Jump to the last page of the article. */
  scrollToBottom() {
    return this.scrollContentTo(this._readerLines.length);
  }

  /**
   * Page-wise scroll — the Page Up/Down atom the reader's own scroll arrows
   * already use (one screen minus the two-line overlap). Exposed so input
   * paths that cannot reach the canvas hit-test (voice) get the same jump.
   * @param {number} direction positive = next page
   */
  scrollContentPage(direction) {
    const visible = visibleLinesFor(this._readerLines.length, this._readerScale);
    return this.scrollContent((direction > 0 ? 1 : -1) * pageJumpLines(visible));
  }

  /**
   * Live text-scale change (WCAG 1.4.4 — text must be resizable up to 200%
   * without assistive technology). Re-lays-out the retained blocks at the new
   * scale and clamps the scroll offset so the viewport stays on content.
   * @returns {boolean} true when the scale actually changed
   */
  setReaderScale(scale) {
    const next = Number.isFinite(scale) && scale > 0 ? scale : 1;
    if (next === this._readerScale) {
      return false;
    }
    this._readerScale = next;
    if (this._contentState === 'reader' && this._readerBlocks) {
      this._readerLines = layoutReaderLines(
        this._readerBlocks, { title: this._readerTitle, scale: next });
      const visible = visibleLinesFor(this._readerLines.length, next);
      this._readerScroll = clampReaderScroll(
        this._readerScroll, this._readerLines.length, visible);
      this._drawContent();
    }
    return true;
  }

  /**
   * Utterance list for read-aloud (title first, paragraphs chunked).
   * Empty outside the reader state — the host announces "nothing to read".
   */
  getReaderNarration() {
    if (this._contentState !== 'reader' || !this._readerBlocks) {
      return [];
    }
    return narrationChunks(this._readerTitle, this._readerBlocks);
  }

  /**
   * Chunks starting at the block under the current scroll offset — the
   * "read from here" counterpart (NVDA read-from-current-position parity).
   * Empty outside the reader state, same as getReaderNarration().
   */
  getReaderNarrationFrom(line) {
    if (line !== undefined && line !== null
      && (!Number.isFinite(line) || line < 0 || line >= this._readerLines.length)) {
      return null; // OOR — callers distinguish from 'no article' (empty list)
    }
    if (this._contentState !== 'reader' || !this._readerBlocks) {
      return [];
    }
    return narrationFromLine(
      this._readerLines,
      line === undefined || line === null ? this._readerScroll : line,
      this._readerTitle, this._readerBlocks);
  }

  /**
   * Percent of the article read — the bottom edge of the viewport over the
   * total line count (100 at the end, the visible fraction at the top).
   * @returns {number|null} 0–100, or null when not reading an article
   */
  readerProgress() {
    if (this._contentState !== 'reader' || !this._readerLines.length) {
      return null;
    }
    const visible = visibleLinesFor(this._readerLines.length, this._readerScale);
    return Math.min(100, Math.round(
      ((this._readerScroll + visible) / this._readerLines.length) * 100));
  }

  /**
   * The last find-in-page query — the Ctrl+F bar's text field, spoken aloud
   * by find-query. null when nothing is being searched (Esc, fresh article,
   * or an empty query).
   * @returns {string|null}
   */
  findQuery() {
    return this._lastFindQuery;
  }

  /**
   * Find-in-page for the reader viewport — the Ctrl+F atom, scoped to the
   * only searchable text surface in VR. Records every matching line index
   * and jumps the viewport to the first hit; callers announce the count.
   * @param {string} query case-insensitive substring
   * @returns {number} match count
   */
  findInReader(query) {
    const q = typeof query === 'string' ? query.trim().toLowerCase() : '';
    this._findMatches = [];
    this._findIndex = -1;
    this._lastFindQuery = q || null;
    if (!q || this._contentState !== 'reader') {
      return 0;
    }
    this._readerLines.forEach((line, i) => {
      if (line.text && line.text.toLowerCase().includes(q)) {
        this._findMatches.push(i);
      }
    });
    if (this._findMatches.length) {
      this._findIndex = 0;
      this._markFindHits();
      this.scrollContentTo(this._findMatches[0]);
    }
    return this._findMatches.length;
  }

  /**
   * Tag the hit lines for the draw pass: the current match gets 'current',
   * the rest 'other' (Chrome's orange/yellow split). The tags live on the
   * laid-out line objects, so a re-layout (new fetch, scale change) starts
   * clean without extra bookkeeping.
   */
  _markFindHits() {
    this._readerLines.forEach((l) => {
      delete l._findHit;
    });
    this._findMatches.forEach((lineIdx, matchIdx) => {
      this._readerLines[lineIdx]._findHit =
        matchIdx === this._findIndex ? 'current' : 'other';
    });
    this._drawContent();
  }

  /**
   * Cycle to the next/previous find hit, wrapping — Ctrl+G / Shift+Ctrl+G
   * semantics. Returns { index, total } (1-based) for announcements, or
   * null when there is no active search.
   */
  findNextMatch(direction = 1) {
    if (!this._findMatches.length) {
      return null;
    }
    const n = this._findMatches.length;
    this._findIndex = ((this._findIndex + direction) % n + n) % n;
    this._markFindHits();
    this.scrollContentTo(this._findMatches[this._findIndex]);
    return { index: this._findIndex + 1, total: n };
  }

  findPrevMatch() {
    return this.findNextMatch(-1);
  }

  /**
   * Jump to the next/previous heading — screen-reader heading navigation
   * (NVDA/JAWS H / Shift+H, VoiceOver rotor "headings"). The article title
   * counts as heading zero so prev-heading can land back at the top.
   * Wraps at both ends like findNextMatch.
   * @returns {{index:number, total:number}|null} 1-based position for
   *   announcements, or null outside the reader / with no headings
   */
  nextHeading(direction = 1) {
    if (this._contentState !== 'reader') {
      return null;
    }
    const heads = [];
    this._readerLines.forEach((line, i) => {
      if (line.style === 'h' || line.style === 'title') {
        heads.push(i);
      }
    });
    if (!heads.length) {
      return null;
    }
    let target;
    if (direction > 0) {
      target = heads.find(i => i > this._readerScroll);
      if (target === undefined) {
        target = heads[0];
      }
    } else {
      const before = heads.filter(i => i < this._readerScroll);
      target = before.length ? before[before.length - 1] : heads[heads.length - 1];
    }
    this.scrollContentTo(target);
    return { index: heads.indexOf(target) + 1, total: heads.length };
  }

  prevHeading() {
    return this.nextHeading(-1);
  }

  /**
   * Heading texts in document order — the VoiceOver-rotor/JAWS "headings
   * list" atom. Returns [] outside reader mode.
   */
  getReaderToc() {
    if (this._contentState !== 'reader') {
      return [];
    }
    return this._readerLines
      .filter((l) => l.style === 'h' || l.style === 'title')
      .map((l) => l.text);
  }

  /**
   * Estimated minutes to read the article — Edge/Safari "reading time"
   * parity. ~500 chars/min is the standard Japanese silent-reading rate;
   * latin text lands roughly on the same scale since words are denser.
   */
  getReadingTimeMinutes() {
    if (this._contentState !== 'reader') {
      return null;
    }
    const chars = this._readerLines.reduce(
      (n, l) => n + (l.text ? l.text.length : 0), 0);
    return Math.max(1, Math.round(chars / 500));
  }

  /**
   * Estimated minutes left — reading time scaled by the unread fraction
   * (readerProgress parity). Null outside the reader state.
   */
  getRemainingMinutes() {
    const total = this.getReadingTimeMinutes();
    if (total === null) {
      return null;
    }
    const pct = this.readerProgress() || 0;
    return Math.max(0, Math.round(total * (100 - pct) / 100));
  }

  /**
   * Jump directly to the Nth find hit — findNextMatch's indexed sibling.
   * Returns { index, total } (1-based) for announcements, 'out' when n is
   * outside the match count, or null when no search is active.
   */
  findMatchAt(n) {
    if (!this._findMatches.length) {
      return null;
    }
    const total = this._findMatches.length;
    if (n < 1 || n > total) {
      return 'out';
    }
    this._findIndex = n - 1;
    this._markFindHits();
    this.scrollContentTo(this._findMatches[this._findIndex]);
    return { index: n, total };
  }

  /**
   * Jump to the last find hit — findMatchAt's tail sibling.
   */
  findLastMatch() {
    return this.findMatchAt(this._findMatches.length);
  }

  /**
   * Current find position without moving — the status-query sibling of
   * findNextMatch. { index, total } (1-based), or null when no search is
   * active (findInReader resets the list on every layout change).
   */
  findStatus() {
    if (!this._findMatches.length) {
      return null;
    }
    return { index: this._findIndex + 1, total: this._findMatches.length };
  }

  /** Start line of each heading — the index behind headingAt/lastHeading. */
  _headingStarts() {
    const heads = [];
    this._readerLines?.forEach((line, i) => {
      if (line.style === 'h' || line.style === 'title') {
        heads.push(i);
      }
    });
    return heads;
  }

  /**
   * Jump directly to the Nth heading — nextHeading's indexed sibling
   * (findMatchAt parity). Returns { index, total }, 'out' when n exceeds
   * the heading count, or null outside the reader / with no headings.
   */
  headingAt(n) {
    if (this._contentState !== 'reader') {
      return null;
    }
    const heads = this._headingStarts();
    if (!heads.length) {
      return null;
    }
    const total = heads.length;
    if (n < 1 || n > total) {
      return 'out';
    }
    this.scrollContentTo(heads[n - 1]);
    return { index: n, total };
  }

  /**
   * Jump to the last heading — findLastMatch's heading sibling.
   */
  lastHeading() {
    return this.headingAt(this._headingStarts().length);
  }

  /**
   * The heading covering the current scroll position — last heading start
   * at-or-before `_readerScroll`, spoken as 'this heading is X (N of M)'.
   * headingAt's positional sibling that does not move. Null outside the
   * reader or when no headings exist.
   */
  headingHere() {
    if (this._contentState !== 'reader' || !this._readerLines.length) {
      return null;
    }
    const heads = this._headingStarts();
    if (!heads.length) {
      return null;
    }
    let at = 0;
    for (let i = 0; i < heads.length; i++) {
      if (heads[i] <= this._readerScroll) {
        at = i;
      }
    }
    return { index: at + 1, total: heads.length, text: this._readerLines[heads[at]].text };
  }

  /**
   * Start line of each contiguous block run — the paragraph layer between
   * lines and headings (R19's layoutReaderLines stamps `block` per line).
   */
  _paragraphStarts() {
    const paras = [];
    this._readerLines.forEach((line, i) => {
      if (i === 0 || line.block !== this._readerLines[i - 1].block) {
        paras.push(i);
      }
    });
    return paras;
  }

  /**
   * Jump to the next/previous paragraph — NVDA/JAWS Ctrl+Down/Ctrl+Up
   * paragraph navigation. Same shape as nextHeading: wraps at both ends
   * and returns { index, total } (1-based), null outside the reader.
   */
  nextParagraph(direction = 1) {
    if (this._contentState !== 'reader') {
      return null;
    }
    const paras = this._paragraphStarts();
    if (!paras.length) {
      return null;
    }
    let target;
    if (direction > 0) {
      target = paras.find(i => i > this._readerScroll);
      if (target === undefined) {
        target = paras[0];
      }
    } else {
      const before = paras.filter(i => i < this._readerScroll);
      target = before.length ? before[before.length - 1] : paras[paras.length - 1];
    }
    this.scrollContentTo(target);
    return { index: paras.indexOf(target) + 1, total: paras.length };
  }

  prevParagraph() {
    return this.nextParagraph(-1);
  }

  /**
   * Jump directly to the Nth paragraph — headingAt's paragraph sibling.
   */
  paragraphAt(n) {
    if (this._contentState !== 'reader') {
      return null;
    }
    const paras = this._paragraphStarts();
    if (!paras.length) {
      return null;
    }
    const total = paras.length;
    if (n < 1 || n > total) {
      return 'out';
    }
    this.scrollContentTo(paras[n - 1]);
    return { index: n, total };
  }

  /**
   * Current paragraph position without moving — findStatus's paragraph
   * sibling. The paragraph holding the scroll line is the last start
   * index at or below it.
   */
  paragraphStatus() {
    if (this._contentState !== 'reader') {
      return null;
    }
    const paras = this._paragraphStarts();
    if (!paras.length) {
      return null;
    }
    let index = paras.length;
    for (let i = 0; i < paras.length; i++) {
      if (paras[i] > this._readerScroll) {
        index = i;
        break;
      }
    }
    return { index, total: paras.length };
  }

  /**
   * Total article character count — the reading-time numerator as a
   * status atom. Null outside the reader.
   */
  getCharCount() {
    if (this._contentState !== 'reader') {
      return null;
    }
    return this._readerLines.reduce(
      (n, l) => n + (l.text ? l.text.length : 0), 0);
  }

  /**
   * One-line structural summary of the article — VoiceOver rotor summary
   * parity ('describe page'): { title, headings, paragraphs, chars } or
   * null outside the reader.
   */
  getArticleSummary() {
    if (this._contentState !== 'reader' || !this._readerLines.length) {
      return null;
    }
    return {
      title: this._readerTitle || '',
      headings: this._headingStarts().length,
      paragraphs: this._paragraphStarts().length,
      chars: this.getCharCount() || 0
    };
  }

  /**
   * Current line position without moving — findStatus's line sibling.
   */
  lineStatus() {
    if (this._contentState !== 'reader' || !this._readerLines.length) {
      return null;
    }
    return {
      index: Math.min(this._readerScroll, this._readerLines.length - 1) + 1,
      total: this._readerLines.length
    };
  }

  /**
   * Narration chunks for the paragraph under the scroll — NVDA
   * "read current paragraph" parity; read-aloud's block-scoped sibling.
   * Returns [] outside the reader or on non-block lines (title region),
   * which readAloud announces as nothing-to-read.
   */
  getParagraphNarration() {
    if (this._contentState !== 'reader' || !this._readerLines.length) {
      return [];
    }
    const line =
      this._readerLines[Math.min(this._readerScroll, this._readerLines.length - 1)];
    if (!Number.isFinite(line.block)) {
      return [];
    }
    return narrationChunks(null, [this._readerBlocks[line.block]]);
  }

  // ── Sentence caret (NVDA Alt+Down/Alt+Up parity) ─────────────────────────
  // Wrapped rows are whitespace-normalized, so sentences — which live in the
  // source block text — are mapped onto display lines through normalized
  // offset math: norm(block text) === norm(row1) + ' ' + norm(row2) + …
  // in-order forward scans therefore recover every unit's offset.

  _norm(s) {
    return (s === null || s === undefined ? '' : String(s)).trim().replace(/\s+/g, ' ');
  }

  _sentencesOf(block) {
    const t = this._readerBlocks?.[block]?.text;
    return typeof t === 'string' ? splitSentences(t) : [];
  }

  /**
   * Normalized start offset of each `texts` unit inside the block's
   * normalized text, via a single in-order forward scan. -1 for a unit not
   * found (a stale caret after re-layout can produce one).
   */
  _offsetsInBlock(block, texts) {
    const hay = this._norm(this._readerBlocks?.[block]?.text);
    let at = 0;
    return texts.map((t) => {
      const n = this._norm(t);
      if (!n) {
        return -1;
      }
      const i = hay.indexOf(n, at);
      if (i >= 0) {
        at = i + n.length;
      }
      return i;
    });
  }

  /** [{line, off}] — display-line index ↔ normalized offset, per block. */
  _rowOffsets(block) {
    const entries = [];
    this._readerLines.forEach((line, i) => {
      if (line.block === block && line.style !== 'blank') {
        entries.push({ line: i, text: line.text });
      }
    });
    const offs = this._offsetsInBlock(block, entries.map((e) => e.text));
    return entries.map((e, i) => ({ line: e.line, off: offs[i] }));
  }

  _offsetOfLine(block, lineIdx) {
    const r = this._rowOffsets(block).find((e) => e.line === lineIdx);
    return r ? r.off : -1;
  }

  /** Display-line index containing the start of block's sentIdx-th sentence. */
  _lineForSentenceAt(block, sentIdx) {
    const sents = this._sentencesOf(block);
    if (sentIdx < 0 || sentIdx >= sents.length) {
      return -1;
    }
    const sentOff = this._offsetsInBlock(block, sents)[sentIdx];
    if (sentOff < 0) {
      return -1;
    }
    const rows = this._rowOffsets(block).filter(
      (r) => r.off >= 0 && r.off <= sentOff);
    return rows.length ? rows[rows.length - 1].line : -1;
  }

  /**
   * Advance the sentence caret — NVDA/JAWS Alt+Down/Alt+Up parity. Sentences
   * come from the source block text (splitSentences), so a sentence spanning
   * several display lines is still spoken whole; the scroll follows the line
   * holding its start, which also marks the position for jumpBack like the
   * other jump atoms.
   * @param {number} direction positive = forward
   * @returns {{sentence: string, line: number}|null} null at article edge /
   *          outside the reader
   */
  nextSentence(direction = 1) {
    if (this._contentState !== 'reader' || !this._readerBlocks?.length) {
      return null;
    }
    const dir = direction >= 0 ? 1 : -1;
    if (!this._sentenceCaret) {
      const li = Math.min(this._readerScroll, this._readerLines.length - 1);
      const line = this._readerLines[li];
      if (Number.isFinite(line?.block)) {
        // The "current" sentence is the last one starting at or before the
        // scroll line; next = after it, prev = before it.
        const lineOff = this._offsetOfLine(line.block, li);
        const offs = this._offsetsInBlock(line.block, this._sentencesOf(line.block));
        let atOrBefore = 0;
        for (const o of offs) {
          if (o >= 0 && o <= lineOff) {
            atOrBefore++;
          }
        }
        this._sentenceCaret = { block: line.block, idx: atOrBefore - 1 };
      } else {
        // Title region — no block: start from the article's near edge.
        const last = this._readerBlocks.length - 1;
        this._sentenceCaret = dir > 0
          ? { block: 0, idx: -1 }
          : { block: last, idx: this._sentencesOf(last).length };
      }
    }
    let { block, idx } = this._sentenceCaret;
    idx += dir;
    while (block >= 0 && block < this._readerBlocks.length) {
      const sents = this._sentencesOf(block);
      if (idx >= 0 && idx < sents.length) {
        this._sentenceCaret = { block, idx };
        const line = this._lineForSentenceAt(block, idx);
        if (line >= 0 && line !== this._readerScroll) {
          this.scrollContentTo(line);
        }
        return { sentence: sents[idx], line };
      }
      block += dir;
      if (block >= 0 && block < this._readerBlocks.length) {
        idx = dir > 0 ? 0 : this._sentencesOf(block).length - 1;
      }
    }
    return null;
  }

  prevSentence() {
    return this.nextSentence(-1);
  }

  /**
   * The sentence under the scroll without moving — lineStatus's sentence
   * sibling, article-wide indexed. Null outside the reader; a scroll on a
   * block's leading blank resolves to that block's first sentence.
   */
  currentSentence() {
    if (this._contentState !== 'reader' || !this._readerLines.length) {
      return null;
    }
    const li = Math.min(this._readerScroll, this._readerLines.length - 1);
    const line = this._readerLines[li];
    if (!Number.isFinite(line?.block)) {
      return null;
    }
    const sents = this._sentencesOf(line.block);
    if (!sents.length) {
      return null;
    }
    const lineOff = this._offsetOfLine(line.block, li);
    const offs = this._offsetsInBlock(line.block, sents);
    let local = -1;
    for (let i = 0; i < offs.length; i++) {
      if (offs[i] >= 0 && offs[i] <= lineOff) {
        local = i;
      }
    }
    if (local < 0) {
      local = 0;
    }
    let index = 0;
    let total = 0;
    for (let b = 0; b < this._readerBlocks.length; b++) {
      const n = this._sentencesOf(b).length;
      if (b < line.block) {
        index += n;
      }
      total += n;
    }
    return { sentence: sents[local], index: index + local + 1, total };
  }

  /**
   * Jump to the last paragraph — lastHeading's paragraph sibling.
   */
  lastParagraph() {
    if (this._contentState !== 'reader') {
      return null;
    }
    const paras = this._paragraphStarts();
    if (!paras.length) {
      return null;
    }
    return this.paragraphAt(paras.length);
  }

  /**
   * Narration chunks for the Nth paragraph — getParagraphNarration's indexed
   * sibling (read-from-line parity). 'out' for out-of-range, [] outside the
   * reader or on a non-block start.
   */
  getParagraphNarrationAt(n) {
    if (this._contentState !== 'reader' || !this._readerLines.length) {
      return [];
    }
    const paras = this._paragraphStarts();
    if (!paras.length) {
      return [];
    }
    if (n < 1 || n > paras.length) {
      return 'out';
    }
    const line = this._readerLines[paras[n - 1]];
    if (!Number.isFinite(line.block)) {
      return [];
    }
    return narrationChunks(null, [this._readerBlocks[line.block]]);
  }

  /**
   * The line text under the reader scroll position — VoiceOver
   * "read current line" parity. Null outside the reader.
   */
  currentLine() {
    if (this._contentState !== 'reader' || !this._readerLines.length) {
      return null;
    }
    const i = Math.min(this._readerScroll, this._readerLines.length - 1);
    return this._readerLines[i].text;
  }

  /**
   * "Where am I" announce line: the page title plus the reader's current
   * line range when an article is showing. Screen-reader parity for the
   * orientation a sighted user gets free from the chrome bar.
   */
  describeLocation() {
    const title = this.currentTitle || this.currentUrl;
    if (!title) {
      return '何も開いていません';
    }
    if (this._contentState === 'reader' && this._readerLines.length) {
      const total = this._readerLines.length;
      const visible = visibleLinesFor(total, this._readerScale);
      const label = readerProgressLabel(this._readerScroll, total, visible);
      return `${title}。${label ? `現在 ${label} 行目` : '全文表示中'}`;
    }
    return title;
  }

  /**
   * Point the reader at a companion proxy (or back to direct fetch with '').
   *
   * Live-settable because the proxy-URL settings control applies immediately —
   * the same discipline as the enableWebPanel toggle. The 'unavailable' state
   * screen words its guidance differently depending on whether a proxy is
   * configured, so it repaints when the value changes.
   *
   * @param {string} url canonical base URL, '' to clear
   */
  setReaderProxyUrl(url) {
    const next = typeof url === 'string' ? url : '';
    if (next === this.readerProxyUrl) {
      return;
    }
    this.readerProxyUrl = next;
    if (this._contentState === 'unavailable') {
      this._drawContent();
    }
  }

  /** Set the content-area state and repaint if it changed. */
  _setContentState(state) {
    if (this._contentState === state) {
      return;
    }
    this._contentState = state;
    this._drawContent();
  }

  _drawChrome() {
    const c = this.chromeCanvas;
    const ctx = c.getContext('2d');
    const w = c.width;
    const h = c.height;
    // The chrome bar used to ignore prefers-contrast entirely — only the page
    // viewport below it honoured the preference — so a low-vision user's
    // address bar and navigation controls stayed at the normal-mode palette.
    const col = webChromeColors(prefersHighContrast());

    // Background
    ctx.fillStyle = col.bg;
    ctx.fillRect(0, 0, w, h);

    // Back button — dimmed when no history to go back to
    const canBack = this.historyIdx > 0;
    ctx.fillStyle = canBack ? col.btnEnabledBg : col.btnDisabledBg;
    ctx.fillRect(8, 6, 60, h - 12);
    ctx.fillStyle = canBack ? col.btnEnabledText : col.btnDisabledText;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◀', 38, h / 2 + 8);

    // Forward button — dimmed when at the latest history entry
    const canForward = this.historyIdx < this.history.length - 1;
    ctx.fillStyle = canForward ? col.btnEnabledBg : col.btnDisabledBg;
    ctx.fillRect(76, 6, 60, h - 12);
    ctx.fillStyle = canForward ? col.btnEnabledText : col.btnDisabledText;
    ctx.fillText('▶', 106, h / 2 + 8);

    // Reload button — becomes a stop ✕ while a load is in flight, the
    // reload↔stop pairing every desktop browser uses (Chrome/Safari/Firefox).
    ctx.fillStyle = col.reloadBg;
    ctx.fillRect(144, 6, 60, h - 12);
    ctx.fillStyle = this.loading ? col.reloadLoading : col.reloadText;
    ctx.fillText(this.loading ? '✕' : '↺', 174, h / 2 + 8);

    // Whether the bookmark button is shown (only when wired to a store).
    const hasBookmark = !!this.onToggleBookmark;
    // URL bar: leave room for [bookmark][close] on the right when bookmarking.
    const urlRight = hasBookmark ? 136 : 72; // px from right edge to URL-bar end
    const barW = w - 212 - urlRight;          // URL bar inner width (px)
    ctx.fillStyle = this._loadError ? col.urlErrorBg : col.urlBg;
    ctx.fillRect(212, 6, barW, h - 12);
    // The bar's fill is only 1.16:1 against the chrome background, and an empty
    // address bar has no glyph of its own — so without a border nothing marks
    // where the tap target is (WCAG 1.4.11 names text-input boundaries).
    ctx.strokeStyle = col.urlBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(213, 7, barW - 2, h - 14);
    // Truncate to fit the bar so a long URL can't overflow into the buttons.
    const maxChars = urlBarMaxChars(barW, this._loadError ? 17 : 18);
    ctx.textAlign = 'left';
    if (this._loadError) {
      ctx.fillStyle = col.errorText;
      ctx.font = '17px sans-serif';
      ctx.fillText(truncate(`⚠ Failed to load: ${this.currentUrl}`, maxChars), 220, h / 2 + 6);
    } else {
      // Security indicator + origin-preserving URL. The address bar is the
      // user's only signal of which site they are on, so the origin is drawn
      // verbatim and never elided (see urlDisplay.js): prefix truncation used
      // to let `https://www.google.com@evil.com` read as "google.com", and let
      // a padded subdomain chain push the real host out of view entirely.
      const level = securityLevel(this.currentUrl);
      const ind = securityIndicator(level, prefersHighContrast());
      let x = 220;
      if (ind.glyph) {
        ctx.fillStyle = ind.color;
        ctx.font = '18px sans-serif';
        ctx.fillText(ind.glyph, x, h / 2 + 6);
        x += 26;
      }
      ctx.fillStyle = this.currentUrl ? col.urlText : col.urlPlaceholder;
      ctx.font = '18px monospace';
      // The glyph consumed ~26px of the bar; shrink the character budget to match.
      const urlChars = this.currentUrl
        ? urlBarMaxChars(barW - (x - 220), 18)
        : maxChars;
      const urlText = this.currentUrl
        ? elideUrlForDisplay(this.currentUrl, urlChars)
        : 'https://';
      ctx.fillText(urlText, x, h / 2 + 6);
    }

    // Bookmark (star) button
    if (hasBookmark) {
      const marked = this.isBookmarked ? !!this.isBookmarked(this.currentUrl) : false;
      ctx.fillStyle = col.starBg;
      ctx.fillRect(w - 128, 6, 56, h - 12);
      ctx.fillStyle = marked ? col.starMarked : col.starUnmarked;
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(marked ? '★' : '☆', w - 100, h / 2 + 9);
    }

    // Close button
    ctx.fillStyle = col.closeBg;
    ctx.fillRect(w - 60, 6, 54, h - 12);
    ctx.fillStyle = col.closeText;
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
    } else if (px < 204) {   // reload — or stop while loading
      if (this.loading) {
        this.stop();
      } else {
        this.reload();
      }
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
      // Pass the current page identity so the caption can announce the URL /
      // title rather than a generic "Browser controls" label (WCAG 1.3.3).
      this.onHoverCaption(this.currentUrl, this.currentTitle);
    }
  }

  _onMoveBarHover(entering) {
    if (this.moveBarMesh && this.moveBarMesh.material) {
      this.moveBarMesh.material.color.set(entering ? 0xaaaaff : 0x55556f);
    }
    if (entering && this.onMoveBarHoverCaption) {
      this.onMoveBarHoverCaption();
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
      if (this.onBlockedNavigation) {
        this.onBlockedNavigation(url);
      }
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

    this._setContentState('loading');
    // Reader pipeline: fetch the markup and render the readable text ourselves.
    // This is the only way a WebXR web app can show page content at all.
    this._loadReaderText(url);

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
      // NOTE: a frame refused by X-Frame-Options / CSP frame-ancestors fires
      // `load`, not `error`, in Chromium — so reaching here does NOT mean the
      // page rendered. Only take over the viewport while the panel is still
      // waiting: if the reader fetch already resolved, its article stays
      // (an unconditional 'unavailable' here used to clobber the rendered
      // reader every time the slower iframe load event landed after it).
      if (this._contentState === 'loading') {
        this._setContentState('unavailable');
      }
      this._drawChrome();
      this.onNavigate(url, title, this);
    };
    this.iframe.onerror = () => {
      this.loading = false;
      this._loadError = true;
      this._setContentState('error');
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
   * @param {string}       [layerId]     — LayersSystem key for this layer, so
   *   disableLayerMode() can release exactly this panel's layer on close.
   * @param {Function}     [onDetach]    — called with (layerId) when the layer
   *   should be released; the host (VRApp) supplies the session/base-layer
   *   knowledge to re-commit the render state (WebPanel stays XR-session-agnostic).
   */
  enableLayerMode(quadLayer, layersSystem, layerId = null, onDetach = null) {
    if (!quadLayer || !layersSystem) {
      return;
    }
    this.quadLayer    = quadLayer;
    this.layersSystem = layersSystem;
    this._layerId     = layerId;
    this._onLayerDetach = typeof onDetach === 'function' ? onDetach : null;
    // Hide the Three.js chrome mesh — the runtime composites the layer instead.
    if (this.chromeMesh) {
      this.chromeMesh.visible = false;
    }
    this._layerDirty = true;
  }

  /**
   * Revert to the standard Three.js mesh path.
   *
   * @param {boolean} [releaseLayer=true] — when true (a tab closed / panel
   *   disposed during a live session), release the native XRQuadLayer via the
   *   detach callback so it doesn't leak: without this the layer stayed
   *   registered in LayersSystem._layers AND in the committed render state,
   *   compositing a frozen "ghost chrome bar" and holding its GPU texture for
   *   the rest of the session, compounding per closed tab. Session-end teardown
   *   passes false — LayersSystem.dispose() clears the whole stack in one shot,
   *   and calling session.updateRenderState() on an ending session throws.
   */
  disableLayerMode(releaseLayer = true) {
    if (this.chromeMesh) {
      this.chromeMesh.visible = true;
    }
    if (releaseLayer && this._onLayerDetach && this._layerId) {
      this._onLayerDetach(this._layerId);
    }
    this.quadLayer    = null;
    this.layersSystem = null;
    this._layerId     = null;
    this._onLayerDetach = null;
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

  /**
   * Show / hide without touching the transform.
   *
   * `show(position)` hard-sets the group position, which is right for a
   * standalone panel but wrong for one parented to a managed container: it
   * discarded the container's placement every time. TabManager switching tabs
   * called `show(this.position)`, so any grab-to-move repositioning was
   * silently thrown away on the next tab switch.
   *
   * @param {boolean} visible
   */
  setVisible(visible) {
    const v = !!visible;
    this.group.visible = v;
    if (this.iframe) {
      this.iframe.style.display = v ? '' : 'none';
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Add the panel to the scene, or to a parent container when one is given.
   * TabManager passes its managed root group so the panel, its siblings and the
   * tab strip share one transform (see TabManager.rootGroup).
   * @param {THREE.Object3D} [parent] defaults to the scene
   */
  addToScene(parent) {
    (parent || this.scene).add(this.group);
  }

  dispose() {
    this.disableLayerMode();
    if (this._loadController) {
      // An in-flight reader fetch outlives the panel: abort it so its late
      // resolution can't repaint a disposed canvas.
      this._loadController.abort();
      this._loadController = null;
    }
    this._readerSeq++;
    this.unregisterInteractable(this.chromeMesh);
    this.unregisterInteractable(this.moveBarMesh);
    this.unregisterInteractable(this.contentMesh);

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

    if (this.iframe) {
      // Detach the load/error handlers before removing the element. A
      // navigation started just before dispose() (tab/panel closed mid-load)
      // can still fire onload/onerror afterward; without this, the stale
      // handler redraws chromeCanvas onto an already-disposed chromeTex and
      // calls onNavigate()/onLoadError() against a torn-down VRApp — the same
      // teardown-leak class fixed for toast timers, hand-tracking timers, and
      // queued TTS utterances.
      this.iframe.onload = null;
      this.iframe.onerror = null;
      if (this.iframe.parentNode) {
        this.iframe.parentNode.removeChild(this.iframe);
      }
    }
  }
}
