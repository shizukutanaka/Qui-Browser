/**
 * VRControllerInput — profile-aware, device-agnostic XR controller input.
 *
 * Translates XRInputSource.profiles[] into a normalised set of named logical
 * buttons and dead-zone-filtered axes so the rest of the app never needs to
 * hard-code hardware-specific button indices.
 *
 * Supported device families:
 *   meta-quest  — Meta Quest 2 / 3 / Pro  (oculus-touch-v2, oculus-touch-v3)
 *   pico        — Pico 4 / Neo 3
 *   valve-index — Valve Index
 *   htc-vive    — HTC Vive / Focus / Cosmos
 *   wmr         — Windows Mixed Reality / Samsung Odyssey
 *   generic     — fallback (trigger + squeeze only)
 *
 * Usage:
 *   const ci = new VRControllerInput({ deadZone: 0.15 });
 *   // each frame, for each XRInputSource:
 *   const snap = ci.read(inputSource);
 *   if (snap.buttons.faceB?.justPressed) goBack();
 */

/** Profile-string → family mapping (first match wins). */
export const PROFILE_MAP = {
  'oculus-touch-v3':                       'meta-quest',
  'oculus-touch-v2':                       'meta-quest',
  'oculus-touch':                          'meta-quest',
  'meta-quest-touch-pro':                  'meta-quest',
  'meta-quest-touch':                      'meta-quest',
  'pico-4':                                'pico',
  'pico-neo3':                             'pico',
  'pico-neo3-eye':                         'pico',
  'pico-g2':                               'pico',
  'bytedance-pico-4':                      'pico',
  'valve-index':                           'valve-index',
  'htc-vive':                              'htc-vive',
  'htc-vive-focus':                        'htc-vive',
  'htc-vive-cosmos':                       'htc-vive',
  'microsoft-mixed-reality':               'wmr',
  'samsung-odyssey':                       'wmr',
  'generic-trigger':                       'generic',
  'generic-hand':                          'generic',
  'generic-trigger-squeeze':               'generic',
  'generic-trigger-squeeze-thumbstick':    'generic',
  'generic-trigger-squeeze-touchpad':      'generic'
};

/**
 * Named button → gamepad.buttons[] index per device family.
 *
 * Standard WebXR Gamepad layout (W3C WebXR Gamepads Module):
 *   0 = trigger (primary), 1 = squeeze (grip)
 *   2 = touchpad/trackpad click (optional)
 *   3 = thumbstick click
 *   4 = face button A (right hand) / X (left hand)
 *   5 = face button B (right hand) / Y (left hand)
 *   6 = menu (left hand only on most devices)
 */
export const BUTTON_MAPS = {
  'meta-quest': {
    trigger:         0,
    squeeze:         1,
    thumbstickClick: 3,
    faceA:           4,   // A (right) / X (left)
    faceB:           5,   // B (right) / Y (left)
    menu:            6   // left controller only
  },
  'pico': {
    trigger:         0,
    squeeze:         1,
    thumbstickClick: 3,
    faceA:           4,
    faceB:           5,
    menu:            6
  },
  'valve-index': {
    trigger:         0,
    squeeze:         1,
    trackpadClick:   2,
    thumbstickClick: 3,
    faceA:           4,
    faceB:           5,
    menu:            6
  },
  'htc-vive': {
    trigger:         0,
    squeeze:         1,
    trackpadClick:   2,
    menu:            4
    // Vive wands have no A/B face buttons
  },
  'wmr': {
    trigger:         0,
    squeeze:         1,
    trackpadClick:   2,
    thumbstickClick: 3,
    faceA:           4,
    menu:            6
  },
  'generic': {
    trigger:         0,
    squeeze:         1
  }
};

/**
 * Named axis → gamepad.axes[] index per device family.
 *
 * Standard layout:
 *   0, 1 = touchpad / trackpad (where present)
 *   2, 3 = thumbstick X, Y
 */
export const AXES_MAPS = {
  'meta-quest':  { stickX: 2, stickY: 3 },
  'pico':        { stickX: 2, stickY: 3 },
  'valve-index': { trackpadX: 0, trackpadY: 1, stickX: 2, stickY: 3 },
  'htc-vive':    { trackpadX: 0, trackpadY: 1, stickX: 0, stickY: 1 },
  'wmr':         { trackpadX: 0, trackpadY: 1, stickX: 2, stickY: 3 },
  'generic':     { stickX: 0, stickY: 1 }
};

/**
 * Apply a *scaled radial* dead zone to a 2D stick/trackpad vector.
 *
 * Two correctness fixes over a naive per-axis clamp:
 *   1. **Radial, not axial** — the ignored region is a circle of radius
 *      `deadZone`, so the threshold is identical in every direction. A per-axis
 *      clamp ignores a *square*, which both swallows intended diagonal pushes
 *      (e.g. (0.12, 0.12), magnitude 0.17 > 0.15, but each axis < 0.15) and
 *      under-rejects diagonal drift near the square's corners.
 *   2. **Re-normalised, no cliff** — once past the dead zone the magnitude is
 *      re-mapped from (deadZone, 1] → (0, 1], so output ramps smoothly from 0
 *      instead of jumping to `deadZone` the instant the stick crosses the edge.
 *      Full deflection still yields full magnitude; only partial pushes are
 *      eased. The smooth onset is the locomotion analog of the gaze-dwell
 *      grace-time: a slight unintended nudge produces near-zero motion rather
 *      than a sudden 15 % lurch — gentler for users with hand tremor.
 *
 * Pure / dependency-free so the curve is unit-testable without a gamepad.
 *
 * @param {number} x         raw axis value, [-1, 1]
 * @param {number} y         raw axis value, [-1, 1]
 * @param {number} deadZone  fraction of travel ignored near centre, [0, 1)
 * @returns {{x: number, y: number}} the dead-zoned, re-normalised vector
 */
export function applyRadialDeadZone(x, y, deadZone) {
  const mag = Math.hypot(x, y);
  if (mag <= deadZone) {
    return { x: 0, y: 0 };
  }
  // Re-normalise magnitude so it starts at 0 just past the dead zone and
  // reaches 1 at full deflection; preserve direction via the unit vector.
  const scaled = Math.min((mag - deadZone) / (1 - deadZone), 1);
  const k = scaled / mag;
  return { x: x * k, y: y * k };
}

/** Human-readable display names per family. */
const FAMILY_LABELS = {
  'meta-quest':  'Meta Quest Controller',
  'pico':        'Pico Controller',
  'valve-index': 'Valve Index Controller',
  'htc-vive':    'HTC Vive Controller',
  'wmr':         'WMR Controller',
  'generic':     'Controller'
};

export class VRControllerInput {
  /**
   * @param {object} [opts]
   * @param {number}  [opts.deadZone=0.15]  Fraction of axis travel ignored near centre.
   * @param {boolean} [opts.southpaw=false] When true, swap left/right stick roles.
   */
  constructor({ deadZone = 0.15, southpaw = false } = {}) {
    this.deadZone = deadZone;
    this.southpaw = southpaw;

    // WeakMap so GC can reclaim entries for disconnected XRInputSources automatically.
    this._state = new WeakMap();
  }

  /**
   * Resolve the device family from an XRInputSource's profiles array.
   * Returns 'generic' when no match is found.
   */
  detectFamily(inputSource) {
    if (!inputSource?.profiles?.length) {
      return 'generic';
    }
    for (const p of inputSource.profiles) {
      if (Object.prototype.hasOwnProperty.call(PROFILE_MAP, p)) {
        return PROFILE_MAP[p];
      }
    }
    return 'generic';
  }

  /** Human-readable label, e.g. "Meta Quest Controller (right)". */
  getDeviceName(inputSource) {
    const family = this.detectFamily(inputSource);
    const hand = inputSource?.handedness ?? 'unknown';
    return `${FAMILY_LABELS[family] ?? 'Controller'} (${hand})`;
  }

  /**
   * Read one XRInputSource this frame and return a normalised snapshot.
   *
   * Snapshot shape:
   * {
   *   family:  string,
   *   hand:    'left' | 'right' | 'none' | 'unknown',
   *   axes:    { stickX, stickY, trackpadX?, trackpadY? },  // dead-zone applied
   *   buttons: {
   *     [name]: { pressed: bool, justPressed: bool, justReleased: bool, value: number }
   *   }
   * }
   *
   * justPressed / justReleased are edge-triggered: true for exactly one frame.
   */
  read(inputSource) {
    if (!inputSource?.gamepad) {
      return this._empty(inputSource);
    }

    const gp = inputSource.gamepad;
    const family = this.detectFamily(inputSource);
    const buttonMap = BUTTON_MAPS[family] ?? BUTTON_MAPS.generic;
    const axesMap   = AXES_MAPS[family]   ?? AXES_MAPS.generic;

    // Per-source previous-button state (initialised on first call).
    let state = this._state.get(inputSource);
    if (!state) {
      state = { prev: {} };
      this._state.set(inputSource, state);
    }

    // --- Buttons ---
    const buttons = {};
    for (const [name, idx] of Object.entries(buttonMap)) {
      const btn      = gp.buttons[idx];
      const pressed  = btn ? btn.pressed : false;
      const wasPrev  = state.prev[name] ?? false;
      buttons[name] = {
        pressed,
        justPressed:   pressed && !wasPrev,
        justReleased: !pressed &&  wasPrev,
        value:  btn ? (btn.value ?? (pressed ? 1 : 0)) : 0
      };
      state.prev[name] = pressed;
    }

    // --- Axes (scaled radial dead-zone applied per X/Y pair) ---
    const raw = gp.axes;
    const rawAxes = {};
    for (const [name, idx] of Object.entries(axesMap)) {
      rawAxes[name] = raw[idx] ?? 0;
    }
    // Dead-zone each stick / trackpad as a 2D vector (circular region + smooth
    // onset) rather than clamping each axis independently. Only emit the pairs
    // that this family actually exposes, preserving the snapshot's key set.
    const axes = {};
    for (const prefix of ['stick', 'trackpad']) {
      const xk = `${prefix}X`;
      const yk = `${prefix}Y`;
      if (xk in rawAxes || yk in rawAxes) {
        const d = applyRadialDeadZone(rawAxes[xk] ?? 0, rawAxes[yk] ?? 0, this.deadZone);
        axes[xk] = d.x;
        axes[yk] = d.y;
      }
    }

    return { family, hand: inputSource.handedness ?? 'unknown', axes, buttons };
  }

  /**
   * Explicitly forget stored state for a source that has disconnected.
   * Calling this is optional — the WeakMap will reclaim the entry eventually —
   * but it keeps justReleased state clean if the same object is reused.
   */
  forget(inputSource) {
    if (inputSource) {
      this._state.delete(inputSource);
    }
  }

  /** @private Empty snapshot when a source has no gamepad. */
  _empty(inputSource) {
    return {
      family:  this.detectFamily(inputSource),
      hand:    inputSource?.handedness ?? 'unknown',
      axes:    { stickX: 0, stickY: 0 },
      buttons: {}
    };
  }
}
