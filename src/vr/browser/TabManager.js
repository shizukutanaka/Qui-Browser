/**
 * FR-1.3: Tab / multi-window manager for in-VR browsing.
 *
 * Owns a collection of WebPanel instances.  Only the active tab is shown at
 * the primary panel position; inactive tabs are hidden (their iframes are
 * detached from view but kept alive so switching back is instant).  A tab
 * strip rendered on a CanvasTexture lets the user switch/close tabs with the
 * controller ray.
 */

import * as THREE from 'three';
import { configureUITexture } from '../ui/canvasTexture.js';
import { WebPanel } from './WebPanel.js';
import { t } from '../../i18n/i18n.js';
import { tabStripColors } from './chromeColors.js';
import { serializeTabSession } from './tabSession.js';
import { prefersHighContrast } from '../../a11y/accessibility.js';
import {
  STRIP_W, STRIP_H, STRIP_CANVAS_W, STRIP_CANVAS_H,
  STRIP_NEW_TAB_PX, STRIP_PRIVATE_PX, tabWidthPx, tabCloseZonePx
} from './panelGeometry.js';


const MAX_TABS = 8;
// Ctrl+Shift+T-style reopen stack depth — Chrome/Firefox keep the last ~8-10
// closed tabs per window; the same budget applies here.
const CLOSED_STACK_MAX = 10;

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
    // Index of the previously-active tab — the Alt+Tab / MRU ping-pong target.
    // Stale entries are tolerated: callers bounds-check against tabs.length.
    this._prevActiveIndex = -1;
    this._curved = false; // curved-screen preference, applied to every tab
    // Private mode marks tabs opened while it is on — like Chrome's incognito
    // window scope, not a mode that retroactively converts existing tabs.
    this._privateMode = false;
    // Recently closed URLs, most recent last. In-memory only: the stack is
    // never persisted, and private tabs are never pushed, so incognito URLs
    // cannot leak into the next session through this path either.
    this._closedStack = [];

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

    const col = tabStripColors(prefersHighContrast());
    const n = this.tabs.length;
    const newW = STRIP_NEW_TAB_PX;                       // "+" button width
    const chipW = this._privateMode ? STRIP_PRIVATE_PX : 0;
    const tabW = tabWidthPx(n, c.width - chipW);

    // Tabs
    for (let i = 0; i < n; i++) {
      const x = i * tabW;
      const active = i === this.activeIndex;
      ctx.fillStyle = active ? col.tabActiveBg : col.tabInactiveBg;
      ctx.fillRect(x + 2, 6, tabW - 4, c.height - 12);

      // A private tab carries a filled dot before its title — shape plus the
      // strip-level PRIVATE chip, so the state is never colour-only (1.4.1).
      const privateDot = this.tabs[i].isPrivate ? 14 : 0;
      if (privateDot) {
        ctx.fillStyle = col.privateText;
        ctx.beginPath();
        ctx.arc(x + 14, c.height / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Pinned tabs show a pin glyph in the same slot — the state must be
      // perceivable without colour.
      const pinnedDot = this.tabs[i].pinned ? 14 : 0;
      if (pinnedDot) {
        ctx.fillStyle = col.privateText;
        ctx.fillText('◈', x + 14, c.height / 2);
      }

      // Title
      ctx.fillStyle = active ? col.tabActiveText : col.tabInactiveText;
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const title = this.tabs[i].currentUrl
        ? this._shortTitle(this.tabs[i].currentUrl)
        : t('vr.tabs.newTab');
      ctx.fillText(title, x + 14 + privateDot + pinnedDot, c.height / 2,
        Math.max(8, tabCloseZonePx(tabW).x0 - 20 - privateDot - pinnedDot));

      // Close ✕ — drawn inside a small red box for discoverability.
      // Anchored to STRIP_CLOSE_PX, the same constant _onStripSelect's hit zone
      // uses, so the box the user aims at and the region that responds cannot
      // drift apart (the drawn box used to be 76px wide over a 36px hit zone).
      const closeZone = tabCloseZonePx(tabW);
      // Pinned tabs have no close affordance (Chrome parity) — closeTab
      // refuses them, so drawing a dead button would be a lie.
      if (!this.tabs[i].pinned) {
        const closeBtnX = x + closeZone.x0;
        const closeBtnY = 10;
        const closeBtnH = c.height - 20;
        ctx.fillStyle = col.closeBg;
        ctx.fillRect(closeBtnX, closeBtnY, closeZone.w, closeBtnH);
        ctx.fillStyle = col.closeText;
        ctx.textAlign = 'center';
        ctx.fillText('✕', closeBtnX + closeZone.w / 2, c.height / 2);
      }
    }

    // PRIVATE chip between the tab area and "+" — a text label, so the mode
    // signal is not carried by colour alone (WCAG 1.4.1).
    if (chipW) {
      const chipX = c.width - newW - chipW + 4;
      ctx.fillStyle = col.privateBg;
      ctx.fillRect(chipX + 2, 12, chipW - 8, c.height - 24);
      ctx.fillStyle = col.privateText;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('vr.tabs.private'), chipX + (chipW - 8) / 2, c.height / 2);
    }

    // New-tab "+" button
    ctx.fillStyle = col.newTabBg;
    ctx.fillRect(c.width - newW + 2, 6, newW - 4, c.height - 12);
    ctx.fillStyle = col.newTabText;
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
    // The PRIVATE chip (drawn just left of "+") is an indicator, not a
    // control — a select landing on it must not fall through to a tab.
    const chipW = this._privateMode ? STRIP_PRIVATE_PX : 0;
    if (chipW && px > this.stripCanvas.width - newW - chipW) {
      return;
    }

    const n = this.tabs.length;
    if (n === 0) {
      return;
    }
    const tabW = tabWidthPx(n, this.stripCanvas.width - chipW);
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
  newTab(url = '', { privateMode = this._privateMode } = {}) {
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
      onNavigate: (u, title, srcPanel) => {
        this._drawStrip();           // refresh tab title
        this.opts.onNavigate?.(u, title, srcPanel);
      },
      privateMode,
      topSitesProvider: this.opts.topSitesProvider || null,
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
      readerScale: this.opts.readerScale || 1
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
    // Chrome's pinned tabs carry no close control — every close path
    // (single, close-others, close-right) refuses them until unpinned.
    if (!panel || panel.pinned) {
      return false;
    }

    // Record the closed URL for the reopen stack before dispose() drops the
    // panel's state. Blank and private tabs are skipped — an incognito URL
    // must not resurface, and there is nothing to reopen for an empty tab.
    if (panel.currentUrl && !panel.isPrivate) {
      this._closedStack.push(panel.currentUrl);
      if (this._closedStack.length > CLOSED_STACK_MAX) {
        this._closedStack.shift();
      }
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
    return true;
  }

  /**
   * Make the tab at index visible and hide all others.
   */
  setActive(index) {
    if (index < 0 || index >= this.tabs.length) {
      return;
    }
    if (index !== this.activeIndex) {
      this._prevActiveIndex = this.activeIndex;
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

  /**
   * Index of the tab active before the current switch — the Alt+Tab / MRU
   * ping-pong target. -1 until a second tab has been activated; may be stale
   * (points past closed tabs) — callers bounds-check.
   */
  previousActiveIndex() {
    return this._prevActiveIndex;
  }

  /**
   * Activate the next/previous tab, wrapping past either end (Ctrl+Tab /
   * Ctrl+Shift+Tab semantics in every desktop browser). No-op with fewer
   * than two tabs. Returns the new activeIndex.
   */
  nextTab() {
    return this._stepActive(1);
  }

  prevTab() {
    return this._stepActive(-1);
  }

  _stepActive(delta) {
    const n = this.tabs.length;
    if (n < 2 || this.activeIndex < 0) {
      return this.activeIndex;
    }
    this.setActive((this.activeIndex + delta + n) % n);
    return this.activeIndex;
  }

  /**
   * Close every tab except the active one (Chrome's "Close other tabs").
   * Each close routes through closeTab so the closed-stack recording rules
   * (private/blank excluded) apply exactly as they do to single closes.
   * @returns {number} tabs closed
   */
  closeOtherTabs() {
    if (this.activeIndex < 0) {
      return 0;
    }
    let closed = 0;
    for (let i = this.tabs.length - 1; i >= 0; i--) {
      if (i !== this.activeIndex && this.closeTab(i)) {
        closed++;
      }
    }
    return closed;
  }

  /**
   * Close every tab to the right of the active one (Chrome's "Close tabs to
   * the right"). Iterating backwards keeps indices stable as closeTab
   * splices.
   * @returns {number} tabs closed
   */
  closeTabsToRight() {
    if (this.activeIndex < 0) {
      return 0;
    }
    let closed = 0;
    for (let i = this.tabs.length - 1; i > this.activeIndex; i--) {
      if (this.closeTab(i)) {
        closed++;
      }
    }
    return closed;
  }

  /**
   * The left-side twin: forward iteration removes low indices first, so the
   * active index shifts down as closeTab splices — bound at i < activeIndex
   * evaluated live each pass.
   * @returns {number} tabs closed
   */
  closeTabsToLeft() {
    if (this.activeIndex < 0) {
      return 0;
    }
    let closed = 0;
    for (let i = 0; i < this.activeIndex; i++) {
      if (this.closeTab(i)) {
        closed++;
      }
    }
    return closed;
  }

  /**
   * Close every private tab (Chrome's "Close incognito tabs"). Iterating
   * backwards keeps indices stable as closeTab splices; pinned private tabs
   * refuse via closeTab exactly as they do everywhere else.
   * @returns {number} tabs closed
   */
  closePrivateTabs() {
    let closed = 0;
    for (let i = this.tabs.length - 1; i >= 0; i--) {
      if (this.tabs[i].isPrivate && this.closeTab(i)) {
        closed++;
      }
    }
    return closed;
  }

  /**
   * Close every tab (Chrome's "Close all tabs"). Iterating backwards keeps
   * indices stable as closeTab splices; pinned tabs refuse via closeTab, so
   * they survive the sweep exactly as they survive a single close.
   * @returns {number} tabs closed
   */
  closeAllTabs() {
    let closed = 0;
    for (let i = this.tabs.length - 1; i >= 0; i--) {
      if (this.closeTab(i)) {
        closed++;
      }
    }
    return closed;
  }

  /**
   * Reorder a tab by delta (Chrome Ctrl+Shift+PageUp/PageDown). Pinned and
   * unpinned tabs live in separate strip regions, so a move that would cross
   * the boundary is refused — matches Chrome, where a pinned tab can only
   * move inside the pinned cluster.
   * @returns {boolean} true when the tab moved
   */
  moveTab(index, delta = 1) {
    const to = index + delta;
    const panel = this.tabs[index];
    if (!panel || to < 0 || to >= this.tabs.length || !!panel.pinned !== !!this.tabs[to].pinned) {
      return false;
    }
    this.tabs.splice(index, 1);
    this.tabs.splice(to, 0, panel);
    if (this.activeIndex === index) {
      this.activeIndex = to;
    } else if (this.activeIndex === to) {
      this.activeIndex = index;
    }
    this._drawStrip();
    return true;
  }

  /**
   * Drag-to-edge parity: move a tab to the first/last slot of its pinned
   * region (Chrome keeps pinned tabs clustered at the front, so "start" for
   * an unpinned tab is just after the pinned cluster, not slot 0).
   * @returns {boolean} true when the tab moved
   */
  moveTabToStart(index) {
    const panel = this.tabs[index];
    if (!panel) {
      return false;
    }
    const pinned = this.tabs.filter(t => t.pinned).length;
    const target = panel.pinned ? 0 : pinned;
    return target !== index && this.moveTab(index, target - index);
  }

  moveTabToEnd(index) {
    const panel = this.tabs[index];
    if (!panel) {
      return false;
    }
    const pinned = this.tabs.filter(t => t.pinned).length;
    const target = panel.pinned ? pinned - 1 : this.tabs.length - 1;
    return target !== index && this.moveTab(index, target - index);
  }

  /**
   * Close tabs that show the same URL as an earlier tab (keeps the first
   * occurrence; closeTab keeps the pinned/closed-stack rules).
   * @returns {number} tabs closed
   */
  closeDuplicateTabs() {
    const seen = new Set();
    const dupes = [];
    this.tabs.forEach((t, i) => {
      const url = t.currentUrl || '';
      if (url && seen.has(url)) {
        dupes.push(i);
      } else {
        seen.add(url);
      }
    });
    let closed = 0;
    for (let i = dupes.length - 1; i >= 0; i--) {
      if (this.closeTab(dupes[i])) {
        closed++;
      }
    }
    return closed;
  }

  /**
   * Close every unpinned tab ("close unpinned" — the inverse of closeAllTabs
   * for users who keep pinned apps around).
   * @returns {number} tabs closed
   */
  closeUnpinnedTabs() {
    let closed = 0;
    for (let i = this.tabs.length - 1; i >= 0; i--) {
      if (!this.tabs[i].pinned && this.closeTab(i)) {
        closed++;
      }
    }
    return closed;
  }

  /**
   * Close every non-private tab — the normal-browsing twin of
   * closePrivateTabs.
   * @returns {number} tabs closed
   */
  closeNormalTabs() {
    let closed = 0;
    for (let i = this.tabs.length - 1; i >= 0; i--) {
      if (!this.tabs[i].isPrivate && this.closeTab(i)) {
        closed++;
      }
    }
    return closed;
  }

  /**
   * Pin a tab (Chrome "Pin tab"): pinned tabs cluster at the front of the
   * strip and refuse closeTab. @returns {boolean} false when already pinned
   * or the index is invalid.
   */
  pinTab(index) {
    const panel = this.tabs[index];
    if (!panel || panel.pinned) {
      return false;
    }
    panel.pinned = true;
    this.tabs.splice(index, 1);
    let insertAt = 0;
    while (insertAt < this.tabs.length && this.tabs[insertAt].pinned) {
      insertAt++;
    }
    this.tabs.splice(insertAt, 0, panel);
    if (this.activeIndex === index) {
      this.activeIndex = insertAt;
    } else if (this.activeIndex >= insertAt && this.activeIndex < index) {
      this.activeIndex++;
    }
    this._drawStrip();
    return true;
  }

  /**
   * Unpin a tab — it stays where it is (the pinned cluster is already
   * leftmost, so dropping the flag is enough). @returns {boolean}
   */
  unpinTab(index) {
    const panel = this.tabs[index];
    if (!panel || !panel.pinned) {
      return false;
    }
    panel.pinned = false;
    this._drawStrip();
    return true;
  }

  /**
   * Flip the pinned flag of the tab at index.
   * @returns {'pinned'|'unpinned'|null} the new state, or null when invalid
   */
  togglePin(index) {
    const panel = this.tabs[index];
    if (!panel) {
      return null;
    }
    return panel.pinned
      ? (this.unpinTab(index), 'unpinned')
      : (this.pinTab(index), 'pinned');
  }

  /**
   * Duplicate the active tab into a new one (Chrome's "Duplicate tab"). The
   * copy inherits the source's privacy flag *before* navigating so a private
   * tab's URL can never reach history through duplication.
   * @returns {WebPanel|null} the new tab, or null when there is no active
   *   URL to copy or MAX_TABS was reached
   */
  duplicateTab() {
    const active = this.getActiveTab();
    if (!active || !active.currentUrl) {
      return null;
    }
    const dup = this.newTab();
    if (!dup) {
      return null;
    }
    dup.isPrivate = active.isPrivate;
    dup.navigate(active.currentUrl);
    return dup;
  }

  /**
   * Reopen the most recently closed non-private tab (Ctrl+Shift+T). The URL
   * is only popped once the new tab is actually created, so a MAX_TABS block
   * doesn't lose the entry. Returns the reopened URL, or null when the stack
   * is empty or tab creation was refused.
   * @returns {string|null}
   */
  reopenClosedTab() {
    const url = this._closedStack[this._closedStack.length - 1];
    if (!url) {
      return null;
    }
    if (!this.newTab(url)) {
      return null;
    }
    this._closedStack.pop();
    return url;
  }

  /**
   * Recently closed URLs, most recent first (the stack itself is
   * oldest-first so reopen pops LIFO). Private/blank tabs never enter the
   * stack, so nothing incognito is reported here either.
   * @returns {string[]}
   */
  closedTabs() {
    return [...this._closedStack].reverse();
  }

  /**
   * Turn private mode on/off for subsequently opened tabs (incognito-window
   * semantics: existing tabs keep the flag they were created with). Redraws
   * the strip so the PRIVATE chip appears/disappears immediately.
   * @param {boolean} value
   */
  setPrivateMode(value) {
    this._privateMode = !!value;
    this._drawStrip();
    return this._privateMode;
  }

  /**
   * Chrome's Ctrl+Shift+N atom: open one private tab now without flipping
   * the manager-wide private-mode toggle — the tab carries `isPrivate`, so
   * history/closed-stack exclusion follows it wherever it goes.
   */
  newPrivateTab(url = '') {
    return this.newTab(url, { privateMode: true });
  }

  /**
   * Snapshot the open tabs for session restore. Private tabs are excluded so
   * their URLs never reach persistent storage.
   * @returns {{v:number,tabs:string[],active:number}|null}
   */
  serializeSession() {
    return serializeTabSession(
      this.tabs.map(p => ({ url: p.currentUrl || '', isPrivate: !!p.isPrivate })),
      this.activeIndex
    );
  }

  /**
   * Restore a validated snapshot ({tabs, active}) — one newTab per URL.
   * @param {{tabs:string[],active:number}} snapshot
   */
  restoreSession(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.tabs) || snapshot.tabs.length === 0) {
      return 0;
    }
    let restored = 0;
    snapshot.tabs.forEach((url) => {
      if (this.newTab(url)) {
        restored++;
      }
    });
    if (Number.isInteger(snapshot.active)) {
      this.setActive(Math.min(snapshot.active, this.tabs.length - 1));
    }
    return restored;
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

  /**
   * Live reader text-size change for every open tab and all future tabs
   * (WCAG 1.4.4). Panels already showing a reader re-lay-out immediately;
   * the rest pick it up on their next article load.
   * @param {number} scale text-size multiplier (> 0)
   */
  setReaderScale(scale) {
    this.opts.readerScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    this.tabs.forEach((panel) => {
      if (panel.setReaderScale) {
        panel.setReaderScale(this.opts.readerScale);
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
    this._closedStack = [];

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
