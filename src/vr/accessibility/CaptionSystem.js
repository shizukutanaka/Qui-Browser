/**
 * FR-13.1: In-VR captions / subtitles (accessibility).
 *
 * Renders a HUD caption panel anchored to the camera (lower field of view) that
 * displays a short queue of text lines which fade out after a hold time.  Long
 * lines are word-wrapped (not truncated) so full utterances are preserved. Fed
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
import { configureUITexture } from '../ui/canvasTexture.js';

const PANEL_W = 1.2;          // metres
const PANEL_H = 0.32;
const CANVAS_W = 1024;
const CANVAS_H = 256;

const PAD = 24;               // vertical inset for text rows
const MAX_FONT = 44;          // px — single short line
const MIN_FONT = 22;          // px — floor when many rows are stacked
const WRAP_CHARS = 34;        // approx chars per row at the panel width
const MAX_ROWS_PER_LINE = 2;  // wrap a caption onto at most this many rows

export class CaptionSystem {
  /**
   * @param {THREE.Camera} camera
   * @param {object} [opts]
   * @param {number} [opts.maxLines=3]       — lines visible at once
   * @param {number} [opts.lineDuration=5000]— ms a line stays before expiring
   * @param {number} [opts.scale=1]          — text-size multiplier for low
   *   vision; raises the font cap and wraps sooner (fewer chars per row).
   * @param {boolean} [opts.highContrast=false] — opaque backing instead of the
   *   semi-transparent default, so the scene can't bleed through and wash out
   *   the text (low-vision / high-contrast preference).
   * @param {Function} [opts.onShow] — called with the normalized text every
   *   time show() runs, mirroring VoiceCommands' onSpeak pattern. Lets a host
   *   forward every caption to a second surface (e.g. a hidden ARIA live
   *   region for 2D/assistive-tech users) from one choke point instead of
   *   duplicating it at every call site.
   */
  constructor(camera, { maxLines = 3, lineDuration = 5000, scale = 1, highContrast = false,
    onShow = null } = {}) {
    this.camera = camera;
    this.maxLines = maxLines;
    this.lineDuration = lineDuration;
    this.scale = scale;
    this.highContrast = highContrast;
    this.onShow = typeof onShow === 'function' ? onShow : null;
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
    this.texture = configureUITexture(new THREE.CanvasTexture(this.canvas));
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
   * Set the text-size multiplier (low-vision support) and redraw. Clamped to a
   * sane range so captions can't shrink away or overflow the panel entirely.
   * @param {number} v
   * @returns {number} the applied scale
   */
  setScale(v) {
    this.scale = Math.max(0.5, Math.min(3, Number(v) || 1));
    this._draw();
    return this.scale;
  }

  /** Toggle the opaque high-contrast backing and redraw. */
  setHighContrast(v) {
    this.highContrast = !!v;
    this._draw();
    return this.highContrast;
  }

  /**
   * Set how long (ms) each caption line stays visible. Clamped to [2000, 60000].
   * Affects lines shown AFTER this call; already-queued lines keep their original
   * remaining time so an in-flight caption is not abruptly cut.
   *
   * WCAG 2.2.1 Timing Adjustable — "Adjust" option: the range must reach at
   * least ten times the default duration (default 5 s → minimum max 50 s).
   * The ceiling is set to 60 s (12× default) to give a clean round number with
   * margin above the WCAG threshold.  Slow readers, users with cognitive
   * disabilities, and language learners can hold each caption as long as they need.
   *
   * @param {number} ms
   * @returns {number} the applied duration
   */
  setLineDuration(ms) {
    this.lineDuration = Math.max(2000, Math.min(60000, Number(ms) || 5000));
    return this.lineDuration;
  }

  /**
   * Push a caption line.  Trims to maxLines (oldest dropped) and schedules it
   * to expire after lineDuration.  Empty/whitespace text is ignored.
   *
   * Text is canonicalised to NFC. Captions are fed from many sources that don't
   * pass through the address-bar resolver — voice transcripts, iframe page
   * titles, system/toast messages — any of which can arrive in NFD (a voiced
   * kana as base + combining mark). Without this, the code-point-aware wrap /
   * truncate would split the combining mark from its base at a row boundary,
   * leaving a floating ゙. Normalising here protects every caption source.
   *
   * @param {string} text
   */
  show(text) {
    if (!text || !String(text).trim()) {
      return;
    }
    const normalized = String(text).normalize('NFC').trim();
    this._lines.push({ text: normalized, remaining: this.lineDuration });
    while (this._lines.length > this.maxLines) {
      this._lines.shift();
    }
    this._dirty = true;
    if (this.enabled && this.mesh) {
      this.mesh.visible = true;
    }
    if (this.onShow) {
      this.onShow(normalized);
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

    // Backing for legibility against any scene — opaque under high contrast.
    ctx.fillStyle = this._backingStyle();
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(8, 8, CANVAS_W - 16, CANVAS_H - 16, 16);
      ctx.fill();
    } else {
      ctx.fillRect(8, 8, CANVAS_W - 16, CANVAS_H - 16);
    }

    // Wrap each caption onto multiple rows so a full utterance is shown rather
    // than truncated — captions are the channel deaf / HoH users rely on, so
    // dropping the tail of a sentence loses real information. The font shrinks
    // to fit when many rows stack up.
    const rows = this._layoutRows();
    const nRows = rows.length;
    const rowH = (CANVAS_H - 2 * PAD) / Math.max(nRows, 1);
    const fontSize = this._fontSizeFor(nRows);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < nRows; i++) {
      const y = PAD + rowH * (i + 0.5);
      ctx.globalAlpha = rows[i].fade;
      ctx.fillText(rows[i].text, CANVAS_W / 2, y);
    }
    ctx.globalAlpha = 1;

    this.texture.needsUpdate = true;
    this._dirty = false;
  }

  /**
   * Expand the caption queue into display rows: each line is word-wrapped to
   * WRAP_CHARS and capped at MAX_ROWS_PER_LINE (overflow gets an ellipsis).
   * Older lines dim slightly; the newest is brightest (fade carried per row).
   * @returns {{text:string, fade:number}[]}
   */
  _layoutRows() {
    const n = this._lines.length;
    const maxChars = this._wrapChars();
    const out = [];
    for (let i = 0; i < n; i++) {
      const fade = 0.55 + 0.45 * ((i + 1) / n);
      let rows = this._wrap(this._lines[i].text, maxChars);
      if (rows.length > MAX_ROWS_PER_LINE) {
        rows = rows.slice(0, MAX_ROWS_PER_LINE);
        const last = MAX_ROWS_PER_LINE - 1;
        rows[last] = this._truncate(rows[last] + '…', maxChars);
      }
      for (const text of rows) {
        out.push({ text, fade });
      }
    }
    return out;
  }

  /** Backing fill: opaque for high contrast, semi-transparent otherwise. */
  _backingStyle() {
    return this.highContrast ? 'rgba(0, 0, 0, 1)' : 'rgba(0, 0, 0, 0.55)';
  }

  /** Chars per row at the current scale: bigger text wraps sooner. */
  _wrapChars() {
    return Math.max(10, Math.round(WRAP_CHARS / this.scale));
  }

  /** Row font size (px) for a given row count: scaled cap, bounded to the row. */
  _fontSizeFor(nRows) {
    const rowH = (CANVAS_H - 2 * PAD) / Math.max(nRows, 1);
    return Math.max(MIN_FONT, Math.min(MAX_FONT * this.scale, Math.floor(rowH * 0.62)));
  }

  /**
   * Greedy word-wrap into rows no longer than `maxChars`. Words longer than a
   * row are hard-split. Pure and unit-testable.
   *
   * Counts and splits by Unicode code point (Array.from), not UTF-16 code unit.
   * This matters most for Japanese captions: with no spaces the whole line is
   * one "word" that always hits the hard-split path, and a slice on UTF-16
   * units would sever a surrogate pair (emoji, CJK Extension kanji such as 𠮷)
   * at the row boundary, leaving a broken �. Captions are the channel deaf /
   * HoH users rely on, so a corrupted glyph is real information loss.
   *
   * @param {string} text
   * @param {number} maxChars
   * @returns {string[]}
   */
  _wrap(text, maxChars) {
    const words = String(text).trim().split(/\s+/);
    const rows = [];
    let cur = '';
    const cpLen = (s) => Array.from(s).length; // code points, not UTF-16 units
    for (const w of words) {
      const wChars = Array.from(w);
      if (wChars.length > maxChars) {
        if (cur) {
          rows.push(cur);
          cur = '';
        }
        let start = 0;
        while (wChars.length - start > maxChars) {
          rows.push(wChars.slice(start, start + maxChars).join(''));
          start += maxChars;
        }
        cur = wChars.slice(start).join('');
      } else if (!cur) {
        cur = w;
      } else if (cpLen(cur + ' ' + w) <= maxChars) {
        cur += ' ' + w;
      } else {
        rows.push(cur);
        cur = w;
      }
    }
    if (cur) {
      rows.push(cur);
    }
    return rows.length ? rows : [''];
  }

  _truncate(text, max) {
    // Code-point-aware so the cut never splits a surrogate pair (see _wrap).
    const chars = Array.from(text);
    return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : text;
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
