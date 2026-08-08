/**
 * In-VR bookmarks & history panel (FR-1.4 UI).
 *
 * Displays the user's saved bookmarks and recent history as a scrollable list
 * of selectable rows. Selecting a row navigates the active browser tab.
 * Follows the same CanvasTexture + interactable pattern as WebPanel so it works
 * with controller-ray selection.
 */

import * as THREE from 'three';
import { configureUITexture } from '../ui/canvasTexture.js';
import {
  PANEL_PX_W, PANEL_PX_H, HEADER_H, ROW_H, VISIBLE_ROWS, DELETE_ZONE_W,
  SCROLL_UP_X0, SCROLL_UP_X1, SCROLL_DN_X0, SCROLL_DN_X1,
  hitTest, uvToPixels, truncate
} from './bookmarkLayout.js';
import { prefersHighContrast } from '../../a11y/accessibility.js';
import { truncateToWidth } from '../ui/textWrap.js';
import { MAX_HISTORY } from '../../utils/BookmarkStore.js';

// Row text budgets in em, derived from the real row geometry: text starts at
// x=24 and must clear the delete zone on the right. Expressed in em (Unicode
// UAX #11 East Asian Width) so one budget is correct for both scripts — a
// 44-*character* budget was ~572px of Latin but 1144px of Japanese, 22% past
// the 936px available, so Japanese titles ran under the delete button.
const ROW_TEXT_X = 24;
const ROW_TITLE_FONT = 26;   // bold sans
const ROW_URL_FONT = 20;     // monospace
const ROW_TEXT_W = PANEL_PX_W - ROW_TEXT_X - DELETE_ZONE_W;
const ROW_TITLE_EM = ROW_TEXT_W / ROW_TITLE_FONT;
const ROW_URL_EM = ROW_TEXT_W / ROW_URL_FONT;

/**
 * Canvas colour palette for the bookmark / history panel.
 *
 * In high-contrast mode the panel switches to a pure-black backing and bright
 * foreground colours to satisfy WCAG 1.4.11 Non-text Contrast (≥ 3:1) and
 * 1.4.3 Text Contrast (≥ 4.5:1).  The most critical failures in normal mode:
 *   • inactive scroll-arrow glyph (#445566) on near-black — dark on dark
 *   • inactive tab label (#8899bb) on near-black — marginal
 *   • URL row text (#7f8db5) — readable but gains meaningful headroom in HC
 *
 * Pure and exported so the contrast choices are unit-testable without a GPU.
 *
 * @param {boolean} [highContrast=false]
 * @returns {object} colour palette used by _draw / _drawTab
 */
export function bookmarkPanelColors(highContrast = false) {
  if (highContrast) {
    return {
      bg:              '#000000',
      headerBg:        '#000000',
      scrollActive:    { bg: '#004adf', text: '#ffffff' },
      scrollInactive:  { bg: '#222222', text: '#aaccee' },
      pageIndicator:   '#ccddee',
      closeBg:         '#7a0000',
      rowTitle:        '#ffffff',
      rowUrl:          '#aabbdd',
      tabActive:       { bg: '#1a3080', text: '#ffffff' },
      tabInactive:     { bg: '#111111', text: '#ccddee' },
      rowZebraEven:    'rgba(255,255,255,0.0)',
      rowZebraOdd:     'rgba(255,255,255,0.10)',
      deleteZoneBg:    '#7a0000',
      deleteText:      '#ffffff',
      emptyText:       '#aabbcc'
    };
  }
  return {
    bg:              'rgba(10,13,20,0.95)',
    headerBg:        '#161b2e',
    scrollActive:    { bg: 'rgba(50,80,140,0.9)', text: '#aabbff' },
    scrollInactive:  { bg: 'rgba(30,35,55,0.6)',  text: '#445566' },
    pageIndicator:   '#7788aa',
    closeBg:         '#5c1a1a',
    rowTitle:        '#e8ecff',
    rowUrl:          '#7f8db5',
    tabActive:       { bg: '#2d3a66', text: '#ffffff' },
    tabInactive:     { bg: '#1a1f33', text: '#8899bb' },
    rowZebraEven:    'rgba(255,255,255,0.03)',
    rowZebraOdd:     'rgba(255,255,255,0.06)',
    deleteZoneBg:    'rgba(90,20,20,0.8)',
    deleteText:      '#ffaaaa',
    emptyText:       '#8899aa'
  };
}

const PANEL_W = 1.2;  // metres
const PANEL_H = PANEL_W * (PANEL_PX_H / PANEL_PX_W);

export class BookmarkPanel {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {Function} opts.registerInteractable
   * @param {Function} opts.unregisterInteractable
   * @param {BookmarkStore} opts.store
   * @param {Function} opts.onSelect       — called with (url) when a row is chosen
   * @param {Function} [opts.onDeleteBookmark] — called with (url) after a bookmark
   *   is deleted; used by VRApp to announce the deletion via caption/haptic
   *   (WCAG 4.1.3 Status Messages — destructive actions need non-visual confirmation).
   * @param {Function} [opts.onTabChange]  — called with ('bookmarks'|'history')
   *   when the user switches between the two tabs (WCAG 4.1.3).
   * @param {number}  [opts.scale=1]  — physical-size multiplier for low-vision
   *   legibility. The canvas layout (and thus hit-testing, which works in
   *   normalised UV space) is unchanged; only the mesh's metre dimensions grow,
   *   enlarging every glyph in angular terms. Mirrors the VR keyboard's scale.
   */
  constructor({ scene, registerInteractable, unregisterInteractable, store, onSelect,
    onDeleteBookmark, onTabChange, onHoverCaption, onClose, scale = 1 }) {
    this.scene = scene;
    this.registerInteractable = registerInteractable;
    this.unregisterInteractable = unregisterInteractable;
    this.store = store;
    this.onSelect = typeof onSelect === 'function' ? onSelect : () => {};
    this.onDeleteBookmark = typeof onDeleteBookmark === 'function' ? onDeleteBookmark : null;
    this.onTabChange = typeof onTabChange === 'function' ? onTabChange : null;
    // Optional: called on hover so the host can show a gaze-dwell preview caption
    // (WCAG 1.3.3 – panel purpose conveyed without relying on sight alone).
    this.onHoverCaption = typeof onHoverCaption === 'function' ? onHoverCaption : null;
    // Called when the panel is closed from its own close-zone (WCAG 4.1.3).
    this.onClose = typeof onClose === 'function' ? onClose : null;

    // Physical dimensions (metres) scaled for the large-text preference. Stored
    // per-instance because _onSelect's UV math must use the same values.
    this.scale = scale > 0 ? scale : 1;
    this.panelW = PANEL_W * this.scale;
    this.panelH = PANEL_H * this.scale;

    this.mode = 'bookmarks'; // 'bookmarks' | 'history'
    this.scrollOffset = 0;  // index of the first visible row
    this.visible = false;

    this.canvas = (typeof document !== 'undefined')
      ? document.createElement('canvas') : null;
    if (this.canvas) {
      this.canvas.width = PANEL_PX_W;
      this.canvas.height = PANEL_PX_H;
    }
    this.tex = this.canvas ? configureUITexture(new THREE.CanvasTexture(this.canvas)) : null;
    if (this.tex) {
      this.tex.colorSpace = THREE.SRGBColorSpace;
    }

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.panelW, this.panelH),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true })
    );
    this.mesh.name = 'bookmarkPanel';
    this.mesh.visible = false;

    this.group = new THREE.Group();
    this.group.add(this.mesh);
    // Front-right of the user, angled toward them (mirrors settings panel).
    this.group.position.set(1.4, 1.5, -2.0);
    this.group.rotation.y = -Math.PI / 8;
  }

  addToScene() {
    this.scene.add(this.group);
    this.registerInteractable(this.mesh, {
      onSelect: (evt) => this._onSelect(evt),
      onHover: () => {
        if (this.mesh) this.mesh.material.color.set(0xbbccff);
        if (this.onHoverCaption) this.onHoverCaption();
      },
      onHoverEnd: () => { if (this.mesh) this.mesh.material.color.set(0xffffff); }
    });
    this._draw();
  }

  /** Return the rows for the active mode. */
  _rows() {
    if (!this.store) {
      return [];
    }
    // Fetch the full persisted history (bounded by BookmarkStore's own
    // MAX_HISTORY cap), not just one page's worth — passing VISIBLE_ROWS here
    // previously meant allRows.length could never exceed VISIBLE_ROWS, so the
    // "scrollable" check in _draw() was always false and the scroll arrows
    // never appeared: only the newest page of history was ever reachable.
    return this.mode === 'bookmarks'
      ? this.store.getBookmarks()
      : this.store.getHistory(MAX_HISTORY);
  }

  show() {
    this.visible = true;
    this.mesh.visible = true;
    this._draw(); // refresh in case bookmarks/history changed
  }

  hide() {
    this.visible = false;
    this.mesh.visible = false;
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  setMode(mode) {
    if (mode !== 'bookmarks' && mode !== 'history') {
      return;
    }
    this.mode = mode;
    this.scrollOffset = 0; // reset scroll when switching tabs
    this._draw();
  }

  // ── Interaction ─────────────────────────────────────────────────────────────

  /**
   * Clamp scrollOffset into [0, max(0, rowCount - VISIBLE_ROWS)].
   *
   * Bookmarks can be removed through paths this panel never observes (the
   * chrome-bar ★ button calls BookmarkStore.removeBookmark directly), so a
   * scrollOffset captured against a longer list would otherwise slice an empty
   * window — a blank page whose rows are all dead clicks, recoverable only by
   * walking the up-arrow or switching tabs. Both the draw path and the
   * hit-test path clamp through here so they can never disagree.
   * @param {number} rowCount
   */
  _clampScroll(rowCount) {
    this.scrollOffset = Math.min(this.scrollOffset, Math.max(0, rowCount - VISIBLE_ROWS));
  }

  _onSelect(evt) {
    // Controllers fire onSelect({ intersection: THREE.Intersection, controller })
    // and gaze fires onSelect({ intersection: hit, gaze: true }). Both wrap the
    // raw THREE.js hit object in { intersection }; the actual world-space point
    // is at evt.intersection.point. Fall back to evt itself for direct
    // THREE.Vector3 calls (unit tests and any future programmatic activations).
    const rawPoint = evt?.intersection?.point ?? evt;
    if (!rawPoint || !this.canvas) {
      return;
    }
    const local = this.mesh.worldToLocal(rawPoint.clone());
    const u = (local.x / this.panelW) + 0.5;
    const v = (local.y / this.panelH) + 0.5;
    const { px, py } = uvToPixels(u, v);

    const rows = this._rows();
    // Enable the per-row delete zone only in bookmarks mode (history is read-only).
    const deleteZone = this.mode === 'bookmarks' && typeof this.store.removeBookmark === 'function';
    // Re-clamp against the live row count before slicing: bookmarks may have
    // been removed externally (chrome-bar ★) since the last draw, leaving a
    // stale offset that would slice an empty window and dead-click every row.
    this._clampScroll(rows.length);
    // hitTest works in visible-window coordinates: translate row index by scrollOffset.
    const windowRows = rows.slice(this.scrollOffset, this.scrollOffset + VISIBLE_ROWS);
    const action = hitTest(px, py, windowRows.length, { deleteZone, scrollZone: true });

    switch (action.type) {
    case 'close':
      this.hide();
      if (this.onClose) {
        this.onClose();
      }
      break;
    case 'tab':
      this.setMode(action.tab);
      if (this.onTabChange) {
        this.onTabChange(action.tab);
      }
      break;
    case 'scrollUp':
      if (this.scrollOffset > 0) {
        this.scrollOffset--;
        this._draw();
      }
      break;
    case 'scrollDown':
      if (this.scrollOffset + VISIBLE_ROWS < rows.length) {
        this.scrollOffset++;
        this._draw();
      }
      break;
    case 'row': {
      const entry = rows[this.scrollOffset + action.index];
      if (entry && entry.url) {
        this.onSelect(entry.url);
        this.hide();
      }
      break;
    }
    case 'deleteRow': {
      const entry = rows[this.scrollOffset + action.index];
      if (entry && entry.url) {
        this.store.removeBookmark(entry.url);
        // After deletion the list shrinks; clamp scroll offset so we don't show a blank page.
        this._clampScroll(this._rows().length);
        this._draw();
        if (this.onDeleteBookmark) {
          this.onDeleteBookmark(entry.url);
        }
      }
      break;
    }
    default:
      break;
    }
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  _draw() {
    if (!this.canvas) {
      return;
    }
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const w = PANEL_PX_W;
    const c = bookmarkPanelColors(prefersHighContrast());

    // Background
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, PANEL_PX_H);

    // Header background
    ctx.fillStyle = c.headerBg;
    ctx.fillRect(0, 0, w, HEADER_H);

    // Tabs
    this._drawTab(ctx, 'Bookmarks', 0, this.mode === 'bookmarks', c);
    this._drawTab(ctx, 'History', 220, this.mode === 'history', c);

    // Scroll arrows (visible only when the list is longer than one page).
    const allRows = this._rows();
    // Clamp against the CURRENT row count so a stale offset (e.g. bookmarks
    // removed externally via the chrome-bar ★) never renders a blank page.
    this._clampScroll(allRows.length);
    const scrollable = allRows.length > VISIBLE_ROWS;
    const canUp   = this.scrollOffset > 0;
    const canDown = this.scrollOffset + VISIBLE_ROWS < allRows.length;
    if (scrollable) {
      // ↑ arrow
      const upColors = canUp ? c.scrollActive : c.scrollInactive;
      ctx.fillStyle = upColors.bg;
      ctx.fillRect(SCROLL_UP_X0 + 2, 10, SCROLL_UP_X1 - SCROLL_UP_X0 - 4, HEADER_H - 20);
      ctx.fillStyle = upColors.text;
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▲', (SCROLL_UP_X0 + SCROLL_UP_X1) / 2, HEADER_H / 2 + 12);
      // ↓ arrow
      const dnColors = canDown ? c.scrollActive : c.scrollInactive;
      ctx.fillStyle = dnColors.bg;
      ctx.fillRect(SCROLL_DN_X0 + 2, 10, SCROLL_DN_X1 - SCROLL_DN_X0 - 4, HEADER_H - 20);
      ctx.fillStyle = dnColors.text;
      ctx.fillText('▼', (SCROLL_DN_X0 + SCROLL_DN_X1) / 2, HEADER_H / 2 + 12);
      // Page indicator between the arrows
      ctx.fillStyle = c.pageIndicator;
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      const pageLabel = `${this.scrollOffset + 1}–${Math.min(this.scrollOffset + VISIBLE_ROWS, allRows.length)}/${allRows.length}`;
      ctx.fillText(pageLabel, (SCROLL_UP_X1 + SCROLL_DN_X0) / 2, HEADER_H / 2 + 8);
    }

    // Close button
    ctx.fillStyle = c.closeBg;
    ctx.fillRect(w - 96, 12, 84, HEADER_H - 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✕', w - 54, HEADER_H / 2 + 12);

    // Rows (show only the visible window).
    const rows = allRows.slice(this.scrollOffset, this.scrollOffset + VISIBLE_ROWS);
    ctx.textAlign = 'left';
    if (allRows.length === 0) {
      ctx.fillStyle = c.emptyText;
      ctx.font = '28px sans-serif';
      ctx.fillText(
        this.mode === 'bookmarks' ? 'No bookmarks yet' : 'No history yet',
        32, HEADER_H + 56
      );
    } else {
      const showDelete = this.mode === 'bookmarks' && typeof this.store.removeBookmark === 'function';
      for (let i = 0; i < rows.length; i++) {
        const entry = rows[i];
        const top = HEADER_H + i * ROW_H;
        // Zebra striping
        ctx.fillStyle = (i % 2 === 0) ? c.rowZebraEven : c.rowZebraOdd;
        ctx.fillRect(0, top, w, ROW_H);
        // Title (leave room for delete button on the right)
        ctx.fillStyle = c.rowTitle;
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'left';
        // Truncate by rendered WIDTH, not character count: a 44-character
        // budget is ~572px of Latin but 1144px of Japanese, 22% past the
        // 936px available, so Japanese bookmark titles ran under the delete
        // button and off the panel. ROW_TITLE_EM/ROW_URL_EM derive the budget
        // from the real geometry; the fillText maxWidth argument is a backstop.
        ctx.fillText(truncateToWidth(entry.title || entry.url, ROW_TITLE_EM), ROW_TEXT_X,
          top + 32, ROW_TEXT_W);
        // URL
        ctx.fillStyle = c.rowUrl;
        ctx.font = '20px monospace';
        ctx.fillText(truncateToWidth(entry.url, ROW_URL_EM), ROW_TEXT_X, top + 58, ROW_TEXT_W);
        // Delete ✕ button (bookmarks mode only)
        if (showDelete) {
          ctx.fillStyle = c.deleteZoneBg;
          ctx.fillRect(w - DELETE_ZONE_W + 4, top + 10, DELETE_ZONE_W - 8, ROW_H - 20);
          ctx.fillStyle = c.deleteText;
          ctx.font = 'bold 28px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✕', w - DELETE_ZONE_W / 2, top + ROW_H / 2 + 10);
        }
      }
    }

    if (this.tex) {
      this.tex.needsUpdate = true;
    }
  }

  _drawTab(ctx, label, x, active, c) {
    const tab = active ? c.tabActive : c.tabInactive;
    ctx.fillStyle = tab.bg;
    ctx.fillRect(x + 8, 12, 204, HEADER_H - 24);
    ctx.fillStyle = tab.text;
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + 110, HEADER_H / 2 + 11);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  dispose() {
    if (this.mesh) {
      this.unregisterInteractable?.(this.mesh);
      if (this.scene) {
        this.scene.remove(this.group);
      }
      if (this.mesh.geometry) {
        this.mesh.geometry.dispose();
      }
      if (this.mesh.material) {
        this.mesh.material.dispose();
      }
    }
    if (this.tex) {
      this.tex.dispose();
    }
    this.canvas = null;
  }
}
