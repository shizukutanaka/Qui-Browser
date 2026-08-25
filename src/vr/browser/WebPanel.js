/**
 * FR-1.1 / FR-1.2: In-VR web panel with URL bar, back/forward, and reload.
 *
 * Architecture:
 *   Three.js plane mesh for the chrome bar (URL + back/forward/reload) and a
 *   second one for the viewport, both drawn on CanvasTextures and registered
 *   as interactables. Page content reaches the viewport through the reader:
 *   fetch the markup, extract the prose, lay it out ourselves.
 *
 * There is deliberately no <iframe>. One used to be created hidden on every
 * panel and pointed at each navigation. It could never be shown — the only
 * function that displayed it had zero callers and `dom-overlay` was never
 * requested — so it existed purely to load a full third-party page, with
 * scripts, out of sight. Worse, it OWNED the content state: because a frame
 * refused by X-Frame-Options still fires `load` in Chromium, its handler
 * overwrote a successful read with 'unavailable'. Measured against a
 * same-origin article: state reached 'reader' with 9 lines at 0.6 s, then the
 * frame's load event clobbered it to 'unavailable' at 1.2 s. A page the reader
 * had already extracted was thrown away and hidden from the user.
 *
 * Limitations (documented honestly):
 *   - The reader shows extracted text, not the page as authored. A WebXR web
 *     app cannot composite cross-origin page pixels into a 3D texture.
 *   - Direct fetch reaches only origins that send CORS headers; the optional
 *     companion proxy (docs/PROXY.md) covers the rest.
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
/**
 * How many visited pages keep their extracted text for back/forward.
 *
 * Bounded because a tab lives for a whole session and each entry holds a
 * page's worth of laid-out strings. 20 covers the depth anyone actually walks
 * back through; beyond that the oldest is dropped and that page refetches.
 */
const MAX_CACHED_PAGES = 20;

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
   */
  constructor({ scene, registerInteractable, unregisterInteractable, onNavigate,
    onUrlInputRequested, searchEngine, isBookmarked, onToggleBookmark, onLoadError,
    onHoverCaption, onGrabRequested, onMoveBarHoverCaption, onBlockedNavigation,
    readerScale = 1, readerProxyUrl = '', onLinkFollowed, linksLabel,
    topSitesProvider, startPageLabel } = {}) {
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
    // Following a link is a navigation the user did not type, so it needs the
    // same cross-modal confirmation every other state change gets (WCAG 4.1.3).
    this.onLinkFollowed = typeof onLinkFollowed === 'function' ? onLinkFollowed : null;
    // Heading for the links section, so it can be translated by the host.
    this.linksLabel = typeof linksLabel === 'string' && linksLabel ? linksLabel : '';
    // Start page. A fresh tab used to show nothing but "Enter a URL to
    // navigate", so the only way in was gaze-typing a URL at roughly 8-10 WPM.
    // The frecency ranking behind this has existed since Session 17 with no
    // surface at all; it was shelved as a third BookmarkPanel tab, whose
    // coordinates collide with the scroll arrows. The empty viewport is the
    // natural home, and a top site is just a link row, so it needs no new
    // interaction code.
    this.topSitesProvider = typeof topSitesProvider === 'function' ? topSitesProvider : null;
    this.startPageLabel = typeof startPageLabel === 'string' && startPageLabel ? startPageLabel : '';

    // Panel state
    this.currentUrl  = '';
    this.history     = [];
    this.historyIdx  = -1;
    this.loading     = false;
    // True only for a load that genuinely failed with a status we can see — an
    // HTTP error from a CORS-enabled origin or the proxy. An opaque fetch
    // rejection (no CORS header, offline) is NOT an error flag: it is the
    // ordinary no-proxy case, and painting the URL bar red for it would cry
    // wolf on nearly every navigation.
    this._loadError  = false;
    // What the content area shows. 'empty' | 'loading' | 'reader' |
    // 'unavailable' | 'error'. There is deliberately no state claiming the
    // *page* is rendered: a WebXR web app cannot composite cross-origin page
    // pixels into a 3D texture. 'reader' means we fetched the markup and are
    // rendering the extracted text ourselves (see readableText.js).
    this._contentState = 'empty';
    this._readerLines = [];
    this._readerScroll = 0;
    this._readerScale = readerScale > 0 ? readerScale : 1;
    this._readerSeq = 0; // guards against a slow fetch landing after a newer one
    /**
     * Back/forward cache: url -> {lines, title, scroll}.
     *
     * Without it, back() refetched. That is wrong twice over. It loses the
     * reading position, which in a panel scrolled by gaze-dwell is expensive
     * to rebuild; and the refetch can fail where the first fetch succeeded
     * (rate limit, dropped network, proxy stopped), so going back to a page
     * you have already read could land on 'unavailable'. A page already
     * extracted does not need the network again.
     */
    this._pageCache = new Map();
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
    if (!this.showStartPage()) {
      this._drawContent();
    }

    const contentTex = this.contentTex;
    const contentGeo = new THREE.PlaneGeometry(PANEL_W, PANEL_H * (1 - CHROME_H));
    const contentMat = new THREE.MeshBasicMaterial({ map: contentTex, side: THREE.FrontSide });
    this.contentMesh = new THREE.Mesh(contentGeo, contentMat);
    this.contentMesh.position.y = -PANEL_H * CHROME_H / 2;
    this.contentMesh.name = 'webPanelContent';
    this.group.add(this.contentMesh);

    this._drawChrome();

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

    if (this._isReaderLike()) {
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

    if (this.contentTex) {
      this.contentTex.needsUpdate = true;
    }
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
   * request cannot pin the panel in 'loading' forever. Every exit settles
   * through `_settleLoad`, which is what clears `loading` and notifies the
   * host — this method is the sole owner of the panel's content state.
   */
  async _loadReaderText(url) {
    const seq = ++this._readerSeq;
    if (typeof fetch !== 'function') {
      this._settleLoad(seq, 'unavailable');
      return;
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;
    try {
      // Routed through the companion proxy when one is configured; otherwise a
      // direct fetch, which only reaches CORS-enabled origins (see readerFetchUrl).
      const fetchUrl = readerFetchUrl(url, this.readerProxyUrl);
      const res = await fetch(fetchUrl, controller ? { signal: controller.signal } : undefined);
      if (!res || !res.ok) {
        // A status we can actually see: the origin (or the proxy) answered and
        // said no. That is a real load failure, unlike an opaque rejection —
        // and it is the only way onLoadError can fire now that nothing pretends
        // a refused frame is a successful load.
        this._settleLoad(seq, 'error', '', true);
        return;
      }
      const html = await res.text();
      // `url`, not the proxy URL, is the base: relative hrefs must resolve
      // against the page the user is on, not against where it was fetched from.
      const { title, blocks, links } = extractReadableText(html, url);
      const lines = layoutReaderLines(blocks, {
        title, links, linksLabel: this.linksLabel, scale: this._readerScale
      });
      if (!lines.length) {
        // Fetched, but no prose recoverable (SPA shell, or markup we can't
        // read). Say so rather than showing a blank page.
        this._settleLoad(seq, 'unavailable', title);
        return;
      }
      if (seq !== this._readerSeq) {
        return; // a newer navigation started while this was in flight
      }
      this._readerLines = lines;
      this._readerScroll = 0;
      this._settleLoad(seq, 'reader', title);
    } catch {
      // Opaque: a CORS-less origin, an abort, or no network. Indistinguishable
      // from each other in a browser, so claim nothing beyond 'unavailable' —
      // whose text already names the likely cause and the fix.
      this._settleLoad(seq, 'unavailable');
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
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
        const bold = line.style !== 'p' && line.style !== 'link';
        ctx.font = `${bold ? 'bold ' : ''}${fontPxFor(line.style, this._readerScale)}px sans-serif`;
        // A link's number (drawn as part of its text by layoutReaderLines) is
        // the cue that does not depend on colour; the tint reinforces it.
        ctx.fillStyle = line.style === 'link' ? col.readerLink
          : line.style === 'p' ? col.readerBody : col.readerHeading;
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
    if (!this._isReaderLike() || !this.contentCanvas) {
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

    const visible = visibleLinesFor(this._readerLines.length, this._readerScale);
    const scrollable = this._readerLines.length > visible;
    const action = readerHitTest(px, py, scrollable, this._readerScale);
    if (action.type === 'scrollUp') {
      this.scrollContent(-pageJumpLines(visible));
    } else if (action.type === 'scrollDown') {
      this.scrollContent(pageJumpLines(visible));
    } else if (action.type === 'row') {
      // Follow a link. The row index is window-relative, so add the scroll
      // offset — clamped through the same helper the draw path uses.
      const start = clampReaderScroll(this._readerScroll, this._readerLines.length, visible);
      const line = this._readerLines[start + action.row];
      if (line && line.href) {
        if (this.onLinkFollowed) {
          this.onLinkFollowed(line.text, line.href);
        }
        this.navigate(line.href);
      }
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
    if (!this._isReaderLike()) {
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

  /** States whose viewport shows selectable, scrollable rows. */
  _isReaderLike() {
    return this._contentState === 'reader' || this._contentState === 'start';
  }

  /**
   * Show the frecency-ranked start page, if there is anything to show.
   *
   * Degrades honestly: a first-run user has no history, so there are no top
   * sites and the viewport keeps its "Enter a URL" message rather than showing
   * an empty list that implies something is missing.
   *
   * @returns {boolean} whether a start page was rendered
   */
  showStartPage() {
    if (!this.topSitesProvider) {
      return false;
    }
    let sites = [];
    try {
      sites = this.topSitesProvider() || [];
    } catch {
      return false; // a broken provider must not break the panel
    }
    const links = sites
      .filter((s) => s && s.url)
      .map((s) => ({ text: s.title || s.host || s.url, href: s.url }));
    if (!links.length) {
      return false;
    }
    this._readerLines = layoutReaderLines([], {
      links, linksLabel: this.startPageLabel, scale: this._readerScale
    });
    this._readerScroll = 0;
    this._setContentState('start');
    return true;
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

    // Reload button
    ctx.fillStyle = col.reloadBg;
    ctx.fillRect(144, 6, 60, h - 12);
    ctx.fillStyle = this.loading ? col.reloadLoading : col.reloadText;
    ctx.fillText('↺', 174, h / 2 + 8);

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
   * Navigate to a URL. Records history and starts the reader load.
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

    // Keep the page being left, so Back returns to it where it was.
    this._rememberPage();

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
    // This is the only way a WebXR web app can show page content at all, and
    // since the iframe is gone it is also the ONLY thing that can move the
    // panel off 'loading' — so a hang here is a visible hang, not something a
    // frame's load event papers over.
    this._loadReaderText(url);
  }

  /**
   * Terminal step of a navigation: leave 'loading', repaint the chrome, and
   * tell the host what happened. Every exit from `_loadReaderText` goes
   * through here so no path can leave the panel stuck loading.
   *
   * @param {number}  seq    the load's sequence number; a superseded load (a
   *   newer navigation started, or the panel was disposed) settles nothing
   * @param {string}  state  content state to show
   * @param {string}  [title] page title when the reader recovered one
   * @param {boolean} [failed] true only for a load that failed with a status
   *   we could actually observe — fires onLoadError instead of onNavigate
   */
  _settleLoad(seq, state, title, failed) {
    if (seq !== this._readerSeq) {
      return;
    }
    const url = this.currentUrl;
    this.loading = false;
    this._loadError = !!failed;
    this.currentTitle = title || url;
    this._setContentState(state);
    this._drawChrome();
    if (failed) {
      this.onLoadError(url);
    } else {
      this.onNavigate(url, this.currentTitle);
    }
  }

  /**
   * Store the page being left, so returning to it restores text and position.
   * Only a successfully read page is worth keeping — an error or 'unavailable'
   * should be retried on the way back, not preserved.
   */
  _rememberPage() {
    if (this._contentState !== 'reader' || !this.currentUrl || !this._readerLines.length) {
      return;
    }
    // Re-insert so recency ordering is by last visit, not first.
    this._pageCache.delete(this.currentUrl);
    this._pageCache.set(this.currentUrl, {
      lines: this._readerLines,
      title: this.currentTitle,
      scroll: this._readerScroll
    });
    while (this._pageCache.size > MAX_CACHED_PAGES) {
      this._pageCache.delete(this._pageCache.keys().next().value);
    }
  }

  /**
   * Restore a cached page instead of refetching. Returns false when there is
   * no entry, so the caller falls back to a normal load.
   * @param {string} url
   * @returns {boolean}
   */
  _restorePage(url) {
    const hit = this._pageCache.get(url);
    if (!hit) {
      return false;
    }
    // Advance the sequence: a fetch still in flight for the page we are
    // leaving must not settle over the restored one.
    const seq = ++this._readerSeq;
    this.currentUrl = url;
    this._readerLines = hit.lines;
    this._readerScroll = hit.scroll;
    this.loading = false;
    this._settleLoad(seq, 'reader', hit.title);
    // _setContentState early-returns when the state is unchanged, and going
    // back from one article to another leaves it on 'reader' — so without this
    // the viewport would keep showing the page we just left.
    this._drawContent();
    return true;
  }

  back() {
    if (this.historyIdx > 0) {
      this._rememberPage();
      this.historyIdx--;
      const url = this.history[this.historyIdx];
      if (!this._restorePage(url)) {
        this._loadUrl(url);
      }
    }
  }

  forward() {
    if (this.historyIdx < this.history.length - 1) {
      this._rememberPage();
      this.historyIdx++;
      const url = this.history[this.historyIdx];
      if (!this._restorePage(url)) {
        this._loadUrl(url);
      }
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
      // Explicitly asking for the page again means asking the network again.
      this._pageCache.delete(this.currentUrl);
      this._loadUrl(this.currentUrl);
    }
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
    this.group.visible = !!visible;
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
    // Invalidate any in-flight reader load. `_settleLoad` checks the sequence,
    // so a fetch that lands after teardown settles nothing — no redraw onto a
    // disposed texture, no onNavigate against a torn-down VRApp. This replaces
    // the handler-nulling the iframe needed, for the same reason.
    this._readerSeq++;
    this._pageCache.clear();
    this.disableLayerMode();
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
  }
}
