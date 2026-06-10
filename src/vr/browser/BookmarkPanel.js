/**
 * In-VR bookmarks & history panel (FR-1.4 UI).
 *
 * Displays the user's saved bookmarks and recent history as a scrollable list
 * of selectable rows. Selecting a row navigates the active browser tab.
 * Follows the same CanvasTexture + interactable pattern as WebPanel so it works
 * with controller-ray selection.
 */

import * as THREE from 'three';
import {
  PANEL_PX_W, PANEL_PX_H, HEADER_H, ROW_H, VISIBLE_ROWS,
  hitTest, uvToPixels, truncate
} from './bookmarkLayout.js';

const PANEL_W = 1.2;  // metres
const PANEL_H = PANEL_W * (PANEL_PX_H / PANEL_PX_W);

export class BookmarkPanel {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {Function} opts.registerInteractable
   * @param {Function} opts.unregisterInteractable
   * @param {BookmarkStore} opts.store
   * @param {Function} opts.onSelect  — called with (url) when a row is chosen
   */
  constructor({ scene, registerInteractable, unregisterInteractable, store, onSelect }) {
    this.scene = scene;
    this.registerInteractable = registerInteractable;
    this.unregisterInteractable = unregisterInteractable;
    this.store = store;
    this.onSelect = typeof onSelect === 'function' ? onSelect : () => {};

    this.mode = 'bookmarks'; // 'bookmarks' | 'history'
    this.visible = false;

    this.canvas = (typeof document !== 'undefined')
      ? document.createElement('canvas') : null;
    if (this.canvas) {
      this.canvas.width = PANEL_PX_W;
      this.canvas.height = PANEL_PX_H;
    }
    this.tex = this.canvas ? new THREE.CanvasTexture(this.canvas) : null;
    if (this.tex) this.tex.colorSpace = THREE.SRGBColorSpace;

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(PANEL_W, PANEL_H),
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
      onSelect: (point) => this._onSelect(point)
    });
    this._draw();
  }

  /** Return the rows for the active mode. */
  _rows() {
    if (!this.store) return [];
    return this.mode === 'bookmarks'
      ? this.store.getBookmarks()
      : this.store.getHistory(VISIBLE_ROWS);
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
    if (mode !== 'bookmarks' && mode !== 'history') return;
    this.mode = mode;
    this._draw();
  }

  // ── Interaction ─────────────────────────────────────────────────────────────

  _onSelect(intersectionPoint) {
    if (!intersectionPoint || !this.canvas) return;
    const local = this.mesh.worldToLocal(intersectionPoint.clone());
    const u = (local.x / PANEL_W) + 0.5;
    const v = (local.y / PANEL_H) + 0.5;
    const { px, py } = uvToPixels(u, v);

    const rows = this._rows();
    const action = hitTest(px, py, rows.length);

    switch (action.type) {
      case 'close':
        this.hide();
        break;
      case 'tab':
        this.setMode(action.tab);
        break;
      case 'row': {
        const entry = rows[action.index];
        if (entry && entry.url) {
          this.onSelect(entry.url);
          this.hide();
        }
        break;
      }
      default:
        break;
    }
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  _draw() {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const w = PANEL_PX_W;

    // Background
    ctx.fillStyle = 'rgba(10,13,20,0.95)';
    ctx.fillRect(0, 0, w, PANEL_PX_H);

    // Header background
    ctx.fillStyle = '#161b2e';
    ctx.fillRect(0, 0, w, HEADER_H);

    // Tabs
    this._drawTab(ctx, 'Bookmarks', 0, this.mode === 'bookmarks');
    this._drawTab(ctx, 'History', 220, this.mode === 'history');

    // Close button
    ctx.fillStyle = '#5c1a1a';
    ctx.fillRect(w - 96, 12, 84, HEADER_H - 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✕', w - 54, HEADER_H / 2 + 12);

    // Rows
    const rows = this._rows();
    ctx.textAlign = 'left';
    if (rows.length === 0) {
      ctx.fillStyle = '#8899aa';
      ctx.font = '28px sans-serif';
      ctx.fillText(
        this.mode === 'bookmarks' ? 'No bookmarks yet' : 'No history yet',
        32, HEADER_H + 56
      );
    } else {
      const count = Math.min(rows.length, VISIBLE_ROWS);
      for (let i = 0; i < count; i++) {
        const entry = rows[i];
        const top = HEADER_H + i * ROW_H;
        // Zebra striping
        ctx.fillStyle = (i % 2 === 0) ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
        ctx.fillRect(0, top, w, ROW_H);
        // Title
        ctx.fillStyle = '#e8ecff';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(truncate(entry.title || entry.url, 44), 24, top + 32);
        // URL
        ctx.fillStyle = '#7f8db5';
        ctx.font = '20px monospace';
        ctx.fillText(truncate(entry.url, 56), 24, top + 58);
      }
    }

    if (this.tex) this.tex.needsUpdate = true;
  }

  _drawTab(ctx, label, x, active) {
    ctx.fillStyle = active ? '#2d3a66' : '#1a1f33';
    ctx.fillRect(x + 8, 12, 204, HEADER_H - 24);
    ctx.fillStyle = active ? '#ffffff' : '#8899bb';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + 110, HEADER_H / 2 + 11);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  dispose() {
    if (this.mesh) {
      this.unregisterInteractable?.(this.mesh);
      if (this.scene) this.scene.remove(this.group);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
    }
    if (this.tex) this.tex.dispose();
    this.canvas = null;
  }
}
