/**
 * Semantic DOM overlay (2D / assistive-technology accessibility).
 *
 * Every accessibility surface built so far — captions, haptics, toasts — lives
 * entirely inside the Three.js/WebXR scene: text drawn to a CanvasTexture on a
 * mesh. That is invisible to anything outside the render, most importantly a
 * screen reader. Quest's dom-overlay WebXR feature composites real DOM elements
 * over an active immersive session, and screen readers can inspect a page's DOM
 * whether or not a session is presenting — but only if the state changes this
 * app already announces (captions, alerts, panel open/closed) also exist as
 * real DOM nodes with the right ARIA roles.
 *
 * This class renders a visually-hidden ("sr-only" pattern — clipped to 1x1px,
 * not display:none, which *would* hide it from assistive tech too) region with
 * three live landmarks:
 *   - a caption mirror (role="status", aria-live="polite")
 *   - an alert mirror (role="alert", aria-live="assertive") for toasts
 *   - a settings-panel state region (role="region", aria-expanded)
 *
 * Pure DOM manipulation, no Three.js/WebXR dependency, so it is unit-testable
 * with a stubbed `document` and safely no-ops when `document` is unavailable.
 */

import { t } from '../../i18n/i18n.js';

const HIDDEN_STYLE =
  'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;' +
  'clip:rect(0,0,0,0);white-space:nowrap;border:0;';

export class SemanticDOM {
  /**
   * @param {object} [opts]
   * @param {Element} [opts.root] — parent to attach to; defaults to
   *   document.body when a DOM is available.
   */
  constructor({ root } = {}) {
    this.root = root || (typeof document !== 'undefined' ? document.body : null);
    this.container = null;
    this.captionRegion = null;
    this.alertRegion = null;
    this.settingsRegion = null;
    // Per-region duplicate-announce state { last, marked } — see _announce().
    this._announceState = {
      caption: { last: null, marked: false },
      alert: { last: null, marked: false }
    };
    this._build();
  }

  _build() {
    if (!this.root || typeof document === 'undefined') {
      return;
    }

    this.container = document.createElement('div');
    this.container.setAttribute('data-qui-semantic-dom', '');
    this.container.style.cssText = HIDDEN_STYLE;

    this.captionRegion = document.createElement('div');
    this.captionRegion.setAttribute('role', 'status');
    this.captionRegion.setAttribute('aria-live', 'polite');
    this.captionRegion.setAttribute('aria-label', t('vr.a11y.captionsRegion'));
    this.container.appendChild(this.captionRegion);

    this.alertRegion = document.createElement('div');
    this.alertRegion.setAttribute('role', 'alert');
    this.alertRegion.setAttribute('aria-live', 'assertive');
    this.alertRegion.setAttribute('aria-label', t('vr.a11y.alertsRegion'));
    this.container.appendChild(this.alertRegion);

    this.settingsRegion = document.createElement('div');
    this.settingsRegion.setAttribute('role', 'region');
    this.settingsRegion.setAttribute('aria-label', t('vr.a11y.settingsRegion'));
    this.settingsRegion.setAttribute('aria-expanded', 'false');
    this.container.appendChild(this.settingsRegion);

    this.root.appendChild(this.container);
  }

  /** Mirror a caption line into the polite live region. No-op if unbuilt. */
  announceCaption(text) {
    this._announce(this.captionRegion, this._announceState.caption, text);
  }

  /** Mirror a toast message into the assertive alert region. No-op if unbuilt. */
  announceAlert(text) {
    this._announce(this.alertRegion, this._announceState.alert, text);
  }

  /**
   * Write text into a live region so assistive tech announces every call.
   * Screen readers only announce a live region when its content *mutates*:
   * writing the identical string twice produces no DOM change, so a repeated
   * caption (a caption line visibly re-queued in VR) or a repeated toast
   * would be spoken once at most. On a duplicate, alternate a trailing
   * zero-width space — invisible and not vocalised, but enough for the
   * accessibility tree to see the node as changed (the same trick
   * LiveAnnouncer-style ARIA announce helpers use).
   */
  _announce(region, state, text) {
    if (!region || !text) {
      return;
    }
    if (state.last === text) {
      state.marked = !state.marked;
      region.textContent = state.marked ? text + '\u200B' : text;
    } else {
      state.last = text;
      state.marked = false;
      region.textContent = text;
    }
  }

  /** Reflect the settings panel's open/closed state via aria-expanded. */
  setSettingsExpanded(expanded) {
    if (this.settingsRegion) {
      this.settingsRegion.setAttribute('aria-expanded', String(!!expanded));
    }
  }

  /** Detach and release the overlay. Safe to call more than once. */
  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.captionRegion = null;
    this.alertRegion = null;
    this.settingsRegion = null;
    this._announceState.caption.last = null;
    this._announceState.alert.last = null;
  }
}
