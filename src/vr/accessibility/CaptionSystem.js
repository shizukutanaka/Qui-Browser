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
import {
  wrapTextToLines, wrapTextToWidth, truncateToWidth, textWidthEm, charWidthEm, safeMeasureEm
} from '../ui/textWrap.js';

const PANEL_W = 1.2;          // metres
const PANEL_H = 0.32;
const CANVAS_W = 1024;
const CANVAS_H = 256;

const PAD = 24;               // vertical inset for text rows
const MAX_FONT = 44;          // px — single short line
const MIN_FONT = 22;          // px — floor when many rows are stacked
const H_PAD = 24;             // horizontal inset so rows don't touch the edge
/**
 * Caption line measure in **em**, not characters.
 *
 * Japanese broadcast subtitling standardises on ~16 full-width characters per
 * row and at most 2 rows (some house styles allow 13–20), while Latin subtitle
 * guidelines sit around 37–42 characters. Both are satisfied by one em figure:
 * at 1.0 em per full-width and ~0.5 per Latin character, 20 em gives 20
 * Japanese / 40 Latin characters per row.
 *
 * Expressing the measure in em also removes the circular dependency that made
 * the old fixed character budget wrong: font size is chosen from the row count
 * (`_fontSizeFor`), but the safe wrap width depends on the font size. An em
 * budget is font-relative by definition, so a row is `measure × fontSize` px
 * wide for whatever font is finally picked. The previous 34-*character* budget
 * rendered 34 full-width glyphs at the 44px single-row font — 1496px on a
 * 1024px canvas, 46% outside the panel. Captions are the deaf/HoH channel, so
 * text leaving the panel is real information loss.
 */
const MEASURE_EM = 20;
const MAX_ROWS_PER_LINE = 2;  // wrap a caption onto at most this many rows

/**
 * Reading rates in characters per second, by East Asian Width class.
 *
 * Subtitle practice sets these per language rather than globally, because a
 * full-width character carries far more meaning than a Latin one: Netflix caps
 * Japanese at 4 CPS, Chinese at 9, Korean at 12, and Latin-script languages at
 * 17–20; Japanese broadcast subtitling independently uses the same 1秒4文字
 * figure. A single fixed hold time therefore cannot serve both scripts — which
 * is exactly what this system used to do (a flat 5 s for every caption).
 */
export const CPS_FULLWIDTH = 4;   // Japanese / Chinese / Korean — 1 em glyphs
export const CPS_HALFWIDTH = 17;  // Latin-script — ~0.5 em glyphs

/**
 * Time (ms) a reader needs for `text`, summed per character by width class.
 *
 * Pure and exported so the rate model is testable without a canvas or clock.
 *
 * @param {string} text
 * @returns {number} milliseconds
 */
export function readingTimeMs(text) {
  let seconds = 0;
  for (const ch of String(text === null || text === undefined ? '' : text)) {
    seconds += charWidthEm(ch.codePointAt(0)) === 1
      ? 1 / CPS_FULLWIDTH
      : 1 / CPS_HALFWIDTH;
  }
  return Math.round(seconds * 1000);
}

// Default caption panel height in the camera's local space (metres, negative =
// below eye level). Exposed so the settings panel can offer a comfortable-
// position control: XAUR requires caption customization, and eye-tracking
// studies show the comfortable caption height varies widely per user.
export const CAPTION_OFFSET_DEFAULT = -0.55;
export const CAPTION_OFFSET_MIN = -0.85; // lower — near the floor of the FOV
export const CAPTION_OFFSET_MAX = -0.25; // higher — closer to eye level

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
    verticalOffset = CAPTION_OFFSET_DEFAULT, onShow = null } = {}) {
    this.camera = camera;
    this.maxLines = maxLines;
    this.lineDuration = lineDuration;
    this.scale = scale;
    this.highContrast = highContrast;
    this.verticalOffset = clampCaptionOffset(verticalOffset);
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
    // Lower-centre of the field of view, a couple metres out. Height is
    // user-adjustable (see setVerticalOffset / VRApp captionHeight setting).
    this.mesh.position.set(0, this.verticalOffset, -2.0);
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
   * How long this specific caption should stay up.
   *
   * `lineDuration` is a *floor*, not the answer: subtitle practice sets the
   * hold time from the content, because reading rate differs sharply by script
   * (Netflix caps Japanese at 4 CPS but Latin at 17–20). Holding every caption
   * for a flat 5 s left a full two-row Japanese caption — 40 full-width
   * characters at the 20 em measure, needing ~10 s — on screen for half the
   * time required to read it, while short Latin captions lingered.
   *
   * The extension is capped at 3× the configured duration so a very long
   * transcript cannot pin the queue; users who need longer still raise the
   * base setting, which lifts floor and cap together (WCAG 2.2.1 Timing
   * Adjustable stays satisfied by that control).
   *
   * @param {string} text
   * @returns {number} ms
   */
  _durationFor(text) {
    const needed = readingTimeMs(text);
    return Math.min(Math.max(this.lineDuration, needed), this.lineDuration * 3);
  }

  /**
   * Set the caption panel's height in the camera's local space (metres,
   * negative = below eye level), clamped to [CAPTION_OFFSET_MIN, MAX]. The
   * comfortable caption position varies widely per user (XAUR requires
   * caption customization; VR eye-tracking subtitle studies show large
   * individual differences), so this is exposed as a live setting.
   * @param {number} y
   * @returns {number} the applied offset
   */
  setVerticalOffset(y) {
    this.verticalOffset = clampCaptionOffset(y);
    if (this.mesh) {
      this.mesh.position.y = this.verticalOffset;
    }
    return this.verticalOffset;
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
    this._lines.push({ text: normalized, remaining: this._durationFor(normalized) });
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
      // maxWidth backstop: the canvas condenses rather than letting a row
      // escape the panel if a budget ever slips (device fonts vary).
      ctx.fillText(rows[i].text, CANVAS_W / 2, y, CANVAS_W - 2 * H_PAD);
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
    const measure = this._measureEm();
    const out = [];
    for (let i = 0; i < n; i++) {
      const fade = 0.55 + 0.45 * ((i + 1) / n);
      // Width-aware wrap: full-width (CJK) counts 1 em, Latin ~0.5, so a row
      // never exceeds `measure × fontSize` px regardless of script.
      let rows = wrapTextToWidth(this._lines[i].text, measure);
      if (rows.length > MAX_ROWS_PER_LINE) {
        rows = rows.slice(0, MAX_ROWS_PER_LINE);
        const last = MAX_ROWS_PER_LINE - 1;
        // Append the ellipsis first so it survives even when the row already
        // fits: it signals that the CAPTION was cut, not just this row.
        rows[last] = truncateToWidth(rows[last] + '…', measure);
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
  /**
   * Line measure in em for the current scale.
   *
   * Clamped against the *largest* font this scale can produce
   * (`MAX_FONT * scale`), so a row is guaranteed to fit the canvas no matter
   * how many rows end up on screen — which is what breaks the wrap/font
   * circularity. At scale 1 the clamp is inactive (20 em × 44px = 880px of
   * 976px usable); at the 1.5 large-text scale it narrows the measure to
   * ~14.8 em so 66px text still fits.
   */
  _measureEm() {
    const usable = CANVAS_W - 2 * H_PAD;
    const largestFont = MAX_FONT * this.scale;
    // safeMeasureEm reserves headroom: the em model under-estimates real
    // full-width advance by ~1%, and at the large-text scale this clamp is the
    // binding constraint with zero slack, so the row would overflow.
    return Math.max(6, Math.min(MEASURE_EM, safeMeasureEm(usable, largestFont)));
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
    // Shared with the reader viewport (src/vr/ui/textWrap.js) so the
    // code-point / surrogate-pair hardening lives in exactly one place.
    return wrapTextToLines(text, maxChars);
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

/**
 * Clamp a caption vertical offset (metres) into the supported range,
 * defaulting a non-finite value to CAPTION_OFFSET_DEFAULT. Pure/exported so
 * the settings-panel stepper and the constructor share one definition.
 * @param {number} y
 * @returns {number}
 */
export function clampCaptionOffset(y) {
  const n = Number(y);
  if (!Number.isFinite(n)) {
    return CAPTION_OFFSET_DEFAULT;
  }
  return Math.max(CAPTION_OFFSET_MIN, Math.min(CAPTION_OFFSET_MAX, n));
}
