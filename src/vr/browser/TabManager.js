/**
 * FR-1.3: Tab / multi-window manager for in-VR browsing.
 *
 * Owns a collection of WebPanel instances.  Only the active tab is shown at
 * the primary panel position; inactive tabs stay constructed with their
 * already-read content intact, so switching back is instant.  A tab strip
 * rendered on a CanvasTexture lets the user switch/close tabs with the
 * controller ray.
 */

import * as THREE from 'three';
import { configureUITexture } from '../ui/canvasTexture.js';
import { WebPanel } from './WebPanel.js';
import { t } from '../../i18n/i18n.js';
import {
  STRIP_W, STRIP_H, STRIP_CANVAS_W, STRIP_CANVAS_H,
  STRIP_NEW_TAB_PX, STRIP_TAB_MAX_PX, tabWidthPx, tabCloseZonePx
} from './panelGeometry.js';


const MAX_TABS = 8;

export class TabManager {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {Function} opts.registerInteractable
   * @param {Function} opts.unregisterInteractable
   * @param {Function} [opts.onNavigate]
   * @param {Function} [opts.onUrlInputRequested]  — forwarded to every WebPanel
   * @param {Function} [opts.onTabActivate]   — called with (url|'') when a tab
   *   becomes active (switch, open, or close causes focus change). Used to
   *   announce the active page via caption / haptic (WCAG 4.1.3 Status Messages).
   * @param {Function} [opts.onTabClose]      — called with no args after a tab
   *   is closed so VRApp can fire a "Tab closed" status message.
   * @param {Function} [opts.onMaxTabsReached] — called with no args when
   *   newTab() is blocked by MAX_TABS, so VRApp can fire a status message
   *   (WCAG 4.1.3) instead of the "+" button silently doing nothing.
   * @param {Function} [opts.onGrabRequested] — forwarded to every WebPanel;
   *   called with (controller) when a panel's move bar is selected.
   * @param {Function} [opts.onMoveBarHoverCaption] — forwarded to every WebPanel;
   *   called with no args on move bar hover-enter.
   * @param {{x:number,y:number,z:number}} [opts.position]
   */
  constructor(opts) {
    this.opts = opts;
    this.scene = opts.scene;
    this.position = opts.position || { x: 0, y: 1.5, z: -2 };

    /** @type {WebPanel[]} */
    this.tabs = [];
    this.activeIndex = -1;
    this._curved = false; // curved-screen preference, applied to every tab

    /**
     * One managed transform for the whole browser window.
     *
     * The tab strip used to be a sibling of the panels, pinned to the same
     * fixed `position`, and `windowManager` only ever managed the *active
     * panel's* group — so moving the panel (grab-to-move, or follow mode) left
     * the strip floating at the original spot, detached from the window it
     * labels. Parenting the strip and every panel to one root fixes that and
     * gives WindowManager a single, stable target, so it no longer has to be
     * re-attached whenever the active tab changes.
     */
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'tabManagerRoot';
    this.rootGroup.position.set(this.position.x, this.position.y, this.position.z);

    // Tab strip sits just above the active panel.
    this.stripGroup  = new THREE.Group();
    this.stripCanvas = document.createElement('canvas');
    this.stripCanvas.width  = STRIP_CANVAS_W;
    this.stripCanvas.height = STRIP_CANVAS_H;
    this.stripTex = configureUITexture(new THREE.CanvasTexture(this.stripCanvas));

    this._buildStrip();
  }

  // ── Tab strip ───────────────────────────────────────────────────────────────

  _buildStrip() {
    const geo = new THREE.PlaneGeometry(STRIP_W, STRIP_H);
    const mat = new THREE.MeshBasicMaterial({ map: this.stripTex, transparent: true });
    this.stripMesh = new THREE.Mesh(geo, mat);
    this.stripMesh.name = 'tabStrip';
    // Above the panel (panel is ~1m tall centred at position.y).
    this.stripMesh.position.set(0, 0.58, 0);
    this.stripGroup.add(this.stripMesh);
    // Local to rootGroup — the root carries the world placement.
    this.stripGroup.position.set(0, 0, 0);
    this.rootGroup.add(this.stripGroup);

    this.opts.registerInteractable(this.stripMesh, {
      onSelect: (evt) => this._onStripSelect(evt),
      onHover: () => {
        if (this.stripMesh) {
          this.stripMesh.material.color.set(0xbbccff);
        }
        if (this.opts.onHoverCaption) {
          this.opts.onHoverCaption();
        }
      },
      onHoverEnd: () => {
        if (this.stripMesh) {
          this.stripMesh.material.color.set(0xffffff);
        }
      }
    });

    this._drawStrip();
  }

  _drawStrip() {
    const c = this.stripCanvas;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);

    const n = this.tabs.length;
    const newW = STRIP_NEW_TAB_PX;                       // "+" button width
    const tabsAreaW = c.width - newW;
    const tabW = tabWidthPx(n, c.width);

    // Tabs
    for (let i = 0; i < n; i++) {
      const x = i * tabW;
      const active = i === this.activeIndex;
      ctx.fillStyle = active ? '#2a2a4a' : '#1a1a2e';
      ctx.fillRect(x + 2, 6, tabW - 4, c.height - 12);

      // Title
      ctx.fillStyle = active ? '#ffffff' : '#9090a8';
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const title = this.tabs[i].currentUrl
        ? this._shortTitle(this.tabs[i].currentUrl)
        : t('vr.tabs.newTab');
      ctx.fillText(title, x + 14, c.height / 2, Math.max(8, tabCloseZonePx(tabW).x0 - 20));

      // Close ✕ — drawn inside a small red box for discoverability.
      // Anchored to STRIP_CLOSE_PX, the same constant _onStripSelect's hit zone
      // uses, so the box the user aims at and the region that responds cannot
      // drift apart (the drawn box used to be 76px wide over a 36px hit zone).
      const closeZone = tabCloseZonePx(tabW);
      const closeBtnX = x + closeZone.x0;
      const closeBtnY = 10;
      const closeBtnH = c.height - 20;
      ctx.fillStyle = '#7a2020';
      ctx.fillRect(closeBtnX, closeBtnY, closeZone.w, closeBtnH);
      ctx.fillStyle = '#ffaaaa';
      ctx.textAlign = 'center';
      ctx.fillText('✕', closeBtnX + closeZone.w / 2, c.height / 2);
    }

    // New-tab "+" button
    ctx.fillStyle = '#3a3a5c';
    ctx.fillRect(c.width - newW + 2, 6, newW - 4, c.height - 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', c.width - newW / 2, c.height / 2);

    this.stripTex.needsUpdate = true;
  }

  _shortTitle(url) {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return url.slice(0, 18);
    }
  }

  // ── Strip interaction ─────────────────────────────────────────────────────

  _onStripSelect(evt) {
    // Controllers fire onSelect({ intersection: THREE.Intersection, controller })
    // and gaze fires onSelect({ intersection: hit, gaze: true }). Extract the
    // THREE.Vector3 hit point; fall back to evt itself for direct calls.
    const rawPoint = evt?.intersection?.point ?? evt;
    if (!rawPoint) {
      return;
    }
    const local = this.stripMesh.worldToLocal(rawPoint.clone());
    const u = (local.x / STRIP_W) + 0.5;        // 0–1
    const px = Math.round(u * this.stripCanvas.width);

    const newW = STRIP_NEW_TAB_PX;
    if (px > this.stripCanvas.width - newW) {
      this.newTab();
      return;
    }

    const n = this.tabs.length;
    if (n === 0) {
      return;
    }
    const tabW = tabWidthPx(n, this.stripCanvas.width);
    const idx = Math.floor(px / tabW);
    if (idx < 0 || idx >= n) {
      return;
    }

    // Close zone is the right STRIP_CLOSE_PX of the tab.
    const withinTab = px - idx * tabW;
    if (withinTab >= tabCloseZonePx(tabW).x0) {
      this.closeTab(idx);
    } else {
      this.setActive(idx);
    }
  }

  // ── Tab lifecycle ───────────────────────────────────────────────────────────

  /**
   * Open a new tab.  Returns the created WebPanel, or null if MAX_TABS reached.
   */
  newTab(url = '') {
    if (this.tabs.length >= MAX_TABS) {
      console.warn('TabManager: max tabs reached');
      // The "+" button silently did nothing past MAX_TABS with no user-facing
      // feedback (WCAG 4.1.3) — a gaze/controller user pressing it repeatedly
      // had no way to know the action was blocked rather than merely slow.
      if (this.opts.onMaxTabsReached) {
        this.opts.onMaxTabsReached();
      }
      return null;
    }

    const panel = new WebPanel({
      scene: this.scene,
      registerInteractable: this.opts.registerInteractable,
      unregisterInteractable: this.opts.unregisterInteractable,
      onNavigate: (u, title) => {
        this._drawStrip();           // refresh tab title
        this.opts.onNavigate?.(u, title);
      },
      onUrlInputRequested: this.opts.onUrlInputRequested || null,
      searchEngine: this.opts.searchEngine || undefined,
      isBookmarked: this.opts.isBookmarked || null,
      onToggleBookmark: this.opts.onToggleBookmark || null,
      onLoadError: this.opts.onLoadError || null,
      onHoverCaption: this.opts.onPanelHoverCaption || null,
      onGrabRequested: this.opts.onGrabRequested || null,
      onMoveBarHoverCaption: this.opts.onMoveBarHoverCaption || null,
      onBlockedNavigation: this.opts.onBlockedNavigation || null,
      readerProxyUrl: this.opts.readerProxyUrl || '',
      onLinkFollowed: this.opts.onLinkFollowed || null,
      linksLabel: this.opts.linksLabel || '',
      topSitesProvider: this.opts.topSitesProvider || null,
      startPageLabel: this.opts.startPageLabel || ''
    });
    panel.addToScene(this.rootGroup);
    panel.group.position.set(0, 0, 0); // local to rootGroup

    this.tabs.push(panel);
    // New tabs inherit the current curved-screen preference.
    if (this._curved && panel.setCurved) {
      panel.setCurved(true);
    }
    this.setActive(this.tabs.length - 1);

    if (url) {
      panel.navigate(url);
    }
    this._drawStrip();
    return panel;
  }

  /**
   * Close the tab at index.  Activates a neighbour if the closed tab was active.
   */
  closeTab(index) {
    const panel = this.tabs[index];
    if (!panel) {
      return;
    }

    panel.dispose();
    this.tabs.splice(index, 1);

    if (this.tabs.length === 0) {
      this.activeIndex = -1;
    } else if (index <= this.activeIndex) {
      this.activeIndex = Math.max(0, this.activeIndex - 1);
      this.setActive(this.activeIndex);
    }
    this._drawStrip();
    if (this.opts.onTabClose) {
      this.opts.onTabClose();
    }
  }

  /**
   * Make the tab at index visible and hide all others.
   */
  setActive(index) {
    if (index < 0 || index >= this.tabs.length) {
      return;
    }
    this.activeIndex = index;
    this.tabs.forEach((panel, i) => {
      // setVisible, not show(position): show() would re-pin the panel to the
      // original fixed spot and discard any grab-to-move placement.
      panel.setVisible(i === index);
    });
    this._drawStrip();
    if (this.opts.onTabActivate) {
      this.opts.onTabActivate(this.tabs[index].currentUrl || '');
    }
  }

  /** Return the currently active WebPanel, or null. */
  getActiveTab() {
    return this.activeIndex >= 0 ? this.tabs[this.activeIndex] : null;
  }

  /** Number of open tabs. */
  get count() {
    return this.tabs.length;
  }

  /**
   * Toggle the curved-screen mode for every open tab and remember the
   * preference so newly created tabs inherit it.
   * @param {boolean} value
   */
  setCurved(value) {
    this._curved = !!value;
    this.tabs.forEach(panel => {
      if (panel.setCurved) {
        panel.setCurved(this._curved);
      }
    });
    return this._curved;
  }

  /**
   * Update the search engine used by all open tabs and remember it so newly
   * created tabs inherit the preference.
   * @param {string} engine  one of 'duckduckgo'|'google'|'bing'|'ecosia'
   */
  setSearchEngine(engine) {
    this.opts.searchEngine = engine;
    this.tabs.forEach(panel => {
      if (panel.setSearchEngine) {
        panel.setSearchEngine(engine);
      }
    });
  }

  /**
   * Update the reader-proxy base URL for every open tab and all future tabs.
   * @param {string} url canonical base URL, '' to clear
   */
  setReaderProxyUrl(url) {
    this.opts.readerProxyUrl = typeof url === 'string' ? url : '';
    this.tabs.forEach((panel) => {
      if (panel.setReaderProxyUrl) {
        panel.setReaderProxyUrl(this.opts.readerProxyUrl);
      }
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  addToScene() {
    // The root carries the strip and every panel, so one add() is enough.
    this.scene.add(this.rootGroup);
  }

  dispose() {
    this.opts.unregisterInteractable(this.stripMesh);
    this.tabs.forEach(panel => panel.dispose());
    this.tabs = [];
    this.activeIndex = -1;

    this.stripGroup.traverse(obj => {
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
    this.scene.remove(this.rootGroup);
  }
}
