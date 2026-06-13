/**
 * FR-13.1: In-VR captions / subtitles (accessibility).
 *
 * Renders a HUD caption panel anchored to the camera (lower field of view) that
 * displays a short queue of text lines which fade out after a hold time.  Fed
 * by any source of textual events — recognized speech from VoiceCommands,
 * system notifications, or media subtitles — so deaf / hard-of-hearing users
 * (and anyone in a noisy space) can follow spoken/audio content.
 *
 * The panel is drawn on a CanvasTexture and billboarded in front of the user;
 * the queue/timing logic is pure and unit-testable without a GPU.
 *
 * Opt-in via VRApp.settings.enableCaptions (default off).
 */

import * as THREE from 'three';

const PANEL_W = 1.2;          // metres
const PANEL_H = 0.32;
const CANVAS_W = 1024;
const CANVAS_H = 256;

export class CaptionSystem {
  /**
   * @param {THREE.Camera} camera
   * @param {object} [opts]
   * @param {number} [opts.maxLines=3]       — lines visible at once
   * @param {number} [opts.lineDuration=5000]— ms a line stays before expiring
   */
  constructor(camera, { maxLines = 3, lineDuration = 5000 } = {}) {
    this.camera = camera;
    this.maxLines = maxLines;
    this.lineDuration = lineDuration;
    this.enabled = false;

    /** @type {{text:string, remaining:number}[]} */
    this._lines = [];
    this._dirty = false;

    this._buildPanel();
  }

  // ── Panel construction ──────────────────────────────────────────────────────

  _buildPanel() {
    this.canvas = document.createElement('canvas');
    this.canvas.width  = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    if ('colorSpace' in this.texture) {
      this.texture.colorSpace = THREE.SRGBColorSpace;
    }

    const geo = new THREE.PlaneGeometry(PANEL_W, PANEL_H);
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, depthTest: false
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = 'captionPanel';
    this.mesh.renderOrder = 998;
    // Lower-centre of the field of view, a couple metres out.
    this.mesh.position.set(0, -0.55, -2.0);
    this.mesh.visible = false;

    this.camera.add(this.mesh);
  }

  // ── Control ──────────────────────────────────────────────────────────────────

  setEnabled(value) {
    this.enabled = !!value;
    if (this.mesh) {
      this.mesh.visible = this.enabled && this._lines.length > 0;
    }
    if (!this.enabled) {
      this.clear();
    }
    return this.enabled;
  }

  /**
   * Push a caption line.  Trims to maxLines (oldest dropped) and schedules it
   * to expire after lineDuration.  Empty/whitespace text is ignored.
   *
   * @param {string} text
   */
  show(text) {
    if (!text || !String(text).trim()) {
      return;
    }
    this._lines.push({ text: String(text).trim(), remaining: this.lineDuration });
    while (this._lines.length > this.maxLines) {
      this._lines.shift();
    }
    this._dirty = true;
    if (this.enabled && this.mesh) {
      this.mesh.visible = true;
    }
    this._draw();
  }

  /** Remove all captions immediately. */
  clear() {
    this._lines = [];
    this._dirty = true;
    if (this.mesh) {
      this.mesh.visible = false;
    }
    this._draw();
  }

  // ── Per-frame update ─────────────────────────────────────────────────────────

  /**
   * Age out expired captions.  Call once per frame with the frame delta in ms.
   * @param {number} dtMs
   */
  update(dtMs) {
    if (!this.enabled || this._lines.length === 0) {
      return;
    }

    let changed = false;
    for (const line of this._lines) {
      line.remaining -= dtMs;
    }
    const before = this._lines.length;
    this._lines = this._lines.filter(l => l.remaining > 0);
    if (this._lines.length !== before) {
      changed = true;
    }

    if (changed) {
      if (this.mesh) {
        this.mesh.visible = this.enabled && this._lines.length > 0;
      }
      this._draw();
    }
  }

  // ── Rendering ────────────────────────────────────────────────────────────────

  _draw() {
    if (!this.canvas) {
      return;
    }
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (this._lines.length === 0) {
      this.texture.needsUpdate = true;
      return;
    }

    // Semi-opaque backing for legibility against any scene.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(8, 8, CANVAS_W - 16, CANVAS_H - 16, 16);
      ctx.fill();
    } else {
      ctx.fillRect(8, 8, CANVAS_W - 16, CANVAS_H - 16);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const n = this._lines.length;
    const lineH = (CANVAS_H - 48) / Math.max(n, 1);
    for (let i = 0; i < n; i++) {
      const y = 24 + lineH * (i + 0.5);
      // Older lines dim slightly; newest is brightest.
      const fade = 0.55 + 0.45 * ((i + 1) / n);
      ctx.globalAlpha = fade;
      ctx.fillText(this._truncate(this._lines[i].text, 48), CANVAS_W / 2, y);
    }
    ctx.globalAlpha = 1;

    this.texture.needsUpdate = true;
    this._dirty = false;
  }

  _truncate(text, max) {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  // ── Accessors ────────────────────────────────────────────────────────────────

  /** Current number of visible caption lines. */
  get lineCount() {
    return this._lines.length;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  dispose() {
    if (this.mesh) {
      if (this.camera && this.camera.remove) {
        this.camera.remove(this.mesh);
      }
      if (this.mesh.geometry) {
        this.mesh.geometry.dispose();
      }
      if (this.mesh.material) {
        if (this.mesh.material.map) {
          this.mesh.material.map.dispose();
        }
        this.mesh.material.dispose();
      }
    }
    this.mesh = null;
    this._lines = [];
  }
}
