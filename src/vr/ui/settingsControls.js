/**
 * Control declarations for the in-VR settings panel — the "what exists" phase,
 * split out of `VRApp.createSettingsPanel()` so it can be tested without
 * Three.js (Fowler, *Refactoring* 2nd ed., "Split Phase"; the same split as
 * `assignSettingsSections` in `settingsLayout.js`, which consumes this output).
 *
 * `buildSettingsControls(app)` returns the four control pools plus the section
 * spec that `assignSettingsSections` maps them onto. Every callback closes
 * over the passed `app` (the VRApp instance) exactly as the inline literals
 * closed over `this`, so behaviour is unchanged — the split only makes the
 * declarations importable and oracle-testable headlessly.
 *
 * Kept free of Three.js.
 */

import { t } from '../../i18n/i18n.js';
import { smoothMoveWarning } from '../comfort/ComfortSystem.js';
import { osReducedMotion } from '../../a11y/accessibility.js';

// Search engines offered by the settings cycle and the voice command.
export const SEARCH_ENGINES = ['duckduckgo', 'google', 'bing', 'ecosia'];

// Comfort presets offered by the settings cycle and the voice command.
export const COMFORT_PRESETS = ['sensitive', 'moderate', 'tolerant', 'disabled'];

/**
 * Declare every settings-panel control and the section spec.
 * @param {object} app the VRApp instance the callbacks bind to
 * @returns {{
 *   toggles: Array<[string, string, ((v: boolean) => void)|null]>,
 *   steppers: Array<[string, string, object]>,
 *   cycles: Array<[string, string, string[], (v: string) => void]>,
 *   actions: Array<[string, () => void]>,
 *   spec: Array<object>
 * }}
 */
export function buildSettingsControls(app) {
  const toggles = [
    [
      t('vr.settings.highContrast'),
      'highContrast',
      (v) => {
        app._applyHighContrast(v);
      }
    ],
    [t('vr.settings.teleport'), 'enableTeleport', null],
    [t('vr.settings.snapTurn'), 'enableSnapTurn', null],
    [
      t('vr.settings.smoothMove'),
      'enableSmoothMove',
      (v) => {
        const msg = smoothMoveWarning(v, osReducedMotion());
        if (msg) {
          app.showVRToast(msg, { type: 'warn' });
        }
      }
    ],
    [
      t('vr.settings.southpaw'),
      'southpaw',
      (v) => {
        if (app.captionSystem && app.captionSystem.enabled) {
          app.captionSystem.show(t(v ? 'vr.msg.primaryHandLeft' : 'vr.msg.primaryHandRight'));
        }
      }
    ],
    [
      t('vr.settings.comfort'),
      'enableComfort',
      (v) => {
        app._applyToggle('enableComfort', v);
      }
    ],
    [
      t('vr.settings.foveation'),
      'enableFFR',
      (v) => {
        app._applyToggle('enableFFR', v);
      }
    ],
    [
      t('vr.settings.gazeSelect'),
      'enableGazeDwell',
      (v) => {
        app._applyToggle('enableGazeDwell', v);
      }
    ],
    [
      t('vr.settings.haptics'),
      'enableHaptics',
      (v) => {
        app._applyToggle('enableHaptics', v);
      }
    ],
    [
      t('vr.settings.captions'),
      'enableCaptions',
      (v) => {
        app._applyToggle('enableCaptions', v);
      }
    ],
    // FR-1.1: in-VR web browsing (WebPanel/TabManager/BookmarkPanel/
    // WindowManager) is gated on this persisted setting — there was
    // previously no way for a real user to ever set it, since it was absent
    // from every settings-panel/voice/persisted-setting path. Toggling it
    // here persists the preference (FR-9.1) and applies it live.
    [t('vr.settings.webPanel'), 'enableWebPanel', (v) => app._onWebPanelToggleChanged(v)],
    // FR-2.4: voice commands — same defect shape as enableWebPanel above:
    // VoiceCommands is constructed once in initializeSystems(), gated on this
    // same persisted setting, which had no write path at all. The row makes
    // the subsystem reachable; _onVoiceToggleChanged resumes an existing
    // instance live and is honest about the boot-only init otherwise.
    [t('vr.settings.voice'), 'enableVoice', (v) => app._onVoiceToggleChanged(v)],
    // The home environment (sky/floor/grid rest frame) had the same
    // unreachable persisted-key defect. The toggle applies live by
    // adding/removing the Group; the teleport floor stays functional.
    [t('vr.settings.homeEnv'), 'enableHomeEnvironment', (v) => app._onHomeEnvToggleChanged(v)],
    [
      t('vr.settings.followView'),
      'enableWindowFollow',
      (v) => {
        app._applyToggle('enableWindowFollow', v);
      }
    ],
    [
      t('vr.settings.curved'),
      'enableCurvedPanel',
      (v) => {
        app._applyToggle('enableCurvedPanel', v);
      }
    ],
    // Private browsing (Quest Browser-style): tabs opened while ON write no
    // history and are never persisted. Applies live — the strip gains the
    // PRIVATE chip immediately — and announces cross-modally (WCAG 4.1.3).
    [t('vr.settings.privateMode'), 'privateMode', (v) => app._applyPrivateMode(v)],
    // Session restore (Wolvic 1.9-style): reopen the tabs that were open
    // when the browser last closed.
    [t('vr.settings.restoreTabs'), 'restoreTabs', null]
  ];

  // Numeric steppers for tunable parameters that were previously code-only.
  const steppers = [
    [t('vr.settings.snapAngle'), 'snapTurnAngle', { min: 15, max: 90, step: 15, unit: '°' }],
    [t('vr.settings.moveSpeed'), 'smoothMoveSpeed', { min: 0.5, max: 4.0, step: 0.5, unit: ' m/s' }],
    // Thumbstick dead zone — persisted since the settings blob existed but
    // with no write path (same unreachable-key defect class as the toggles
    // above). Tremor users widen it to absorb jitter; precision users narrow
    // it. Applies live: the input layer reads the field every frame.
    [
      t('vr.settings.deadZone'),
      'controllerDeadZone',
      { min: 0, max: 0.5, step: 0.05, apply: (v) => app._onDeadZoneChanged(v) }
    ],
    [
      t('vr.settings.gazeTime'),
      'gazeDwellTime',
      {
        min: 500,
        max: 3000,
        step: 250,
        unit: 'ms',
        apply: (v) => {
          if (app.gazeInteraction) {
            app.gazeInteraction.dwellTime = v;
          }
        }
      }
    ],
    // WCAG 2.2.1 Timing Adjustable: users with tremor / nystagmus can widen
    // this window so a brief involuntary slip off-target doesn't restart the
    // dwell; precision-focused users can narrow it to 0 to disable forgiveness.
    [
      t('vr.settings.graceTime'),
      'gazeGraceTime',
      {
        min: 0,
        max: 600,
        step: 50,
        unit: 'ms',
        apply: (v) => {
          if (app.gazeInteraction) {
            app.gazeInteraction.graceTime = v;
          }
        }
      }
    ],
    [
      t('vr.settings.panelDist'),
      'windowDistance',
      {
        min: 0.6,
        max: 6.0,
        step: 0.2,
        unit: ' m',
        apply: (v) => {
          if (app.windowManager) {
            app.windowManager.setDistance(v);
          }
        }
      }
    ],
    // WCAG 2.2.1 Timing Adjustable (Adjust option): range must reach ≥ 10× the
    // default (5 s default → min ceiling 50 s). Using 60 s (12×) as the max.
    [
      t('vr.settings.captionHold'),
      'captionDuration',
      {
        min: 2,
        max: 60,
        step: 2,
        unit: 's',
        apply: (v) => {
          if (app.captionSystem) {
            app.captionSystem.setLineDuration(v * 1000);
          }
        }
      }
    ],
    [
      t('vr.settings.captionSize'),
      'captionScale',
      {
        min: 0.5,
        max: 3.0,
        step: 0.25,
        unit: 'x',
        apply: (v) => {
          if (app.captionSystem) {
            app.captionSystem.setScale(v);
          }
        }
      }
    ],
    // XAUR: caption position customization. Height in metres below eye level
    // (more-negative = lower in the field of view).
    [
      t('vr.settings.captionHeight'),
      'captionHeight',
      {
        min: -0.85,
        max: -0.25,
        step: 0.1,
        unit: 'm',
        apply: (v) => {
          if (app.captionSystem) {
            app.captionSystem.setVerticalOffset(v);
          }
        }
      }
    ],
    // Master spatial-audio volume (0 = muted). Stored as a percentage for a
    // readable stepper; SpatialAudio.setMasterVolume expects a 0–1 gain.
    [
      t('vr.settings.soundVolume'),
      'masterVolume',
      {
        min: 0,
        max: 100,
        step: 10,
        unit: '%',
        apply: (v) => {
          if (app.spatialAudio) {
            app.spatialAudio.setMasterVolume(v / 100);
          }
        }
      }
    ],
    // WCAG 1.4.4 Resize Text: the reader's article text must reach 2.0x.
    // Applies live — open articles re-lay-out, later loads inherit.
    [
      t('vr.settings.readerTextSize'),
      'readerTextScale',
      {
        min: 0.5,
        max: 2.0,
        step: 0.25,
        unit: 'x',
        apply: (v) => {
          if (app.tabManager) {
            app.tabManager.setReaderScale(v);
          }
        }
      }
    ]
  ];

  // Cycle buttons for enumerated settings (currently code-only or keyboard-shortcut-only).
  const cycles = [
    [
      t('vr.settings.comfort'),
      'motionSensitivity',
      COMFORT_PRESETS,
      (v) => {
        app._applyToggle('motionSensitivity', v);
      }
    ],
    [
      t('vr.settings.search'),
      'searchEngine',
      SEARCH_ENGINES,
      (v) => {
        if (app.tabManager) {
          app.tabManager.setSearchEngine(v);
        }
      }
    ]
  ];

  // Action buttons (non-toggle). Only shown when their target exists.
  const actions = [];
  // Immersive 360°/180° video: prompt for a URL (VR keyboard) and play it.
  actions.push([t('vr.settings.video360'), () => app._launchImmersiveVideo()]);
  // Clear browsing history (privacy). Always shown: history is persisted in
  // localStorage and outlives an enableWebPanel session, so a user must be
  // able to clear residual history regardless of the current panel state.
  actions.push([t('vr.settings.clearHistory'), () => app._clearBrowsingHistory()]);
  // Reader proxy: the ONLY way a real user can set readerProxyUrl. It was a
  // settings key with no settings control, voice command or URL parameter —
  // docs/PROXY.md said "set the setting" with no way to do it, the same
  // unreachable-by-any-real-user shape that justified Session 74's deletions.
  actions.push([t('vr.settings.readerProxy'), () => app._requestReaderProxyInput()]);
  if (app.settings.enableWebPanel) {
    actions.push([
      t('vr.settings.bookmarks'),
      () => {
        if (app.bookmarkPanel) {
          app.bookmarkPanel.toggle();
          // Announce the resulting open/closed state as a status message
          // (WCAG 4.1.3) so caption-reliant users know whether the panel
          // appeared or disappeared.
          if (app.captionSystem && app.captionSystem.enabled) {
            app.captionSystem.show(app.bookmarkPanel.visible ? t('vr.msg.bookmarksOpen') : t('vr.msg.bookmarksClosed'));
          }
        }
      }
    ]);
  }

  // Grouped, collapsible layout. The flat stack reached 19 rows / 3.56 m,
  // which subtends 72.2° vertically at this panel's 2.44 m placement — about
  // double the ~30-40° you can take in without moving your head, so the lower
  // half was effectively out of view and every new setting made it worse.
  // Sections are keyed by what the user is trying to do, and only the open
  // one occupies rows (see src/vr/ui/settingsLayout.js).
  const spec = [
    {
      id: 'settings.section.a11y',
      toggles: ['enableCaptions', 'enableGazeDwell', 'enableVoice', 'highContrast', 'enableHaptics'],
      steppers: ['captionDuration', 'captionScale', 'captionHeight', 'gazeDwellTime', 'gazeGraceTime']
    },
    {
      id: 'settings.section.locomotion',
      toggles: ['enableTeleport', 'enableSnapTurn', 'enableSmoothMove', 'southpaw', 'enableComfort'],
      steppers: ['snapTurnAngle', 'smoothMoveSpeed', 'controllerDeadZone'],
      cycles: ['motionSensitivity']
    },
    {
      id: 'settings.section.display',
      toggles: ['enableFFR', 'enableCurvedPanel', 'enableWindowFollow', 'enableHomeEnvironment'],
      steppers: ['windowDistance']
    },
    {
      id: 'settings.section.browsing',
      toggles: ['enableWebPanel', 'privateMode', 'restoreTabs'],
      steppers: ['readerTextScale'],
      cycles: ['searchEngine'],
      actions: [t('vr.settings.clearHistory'), t('vr.settings.readerProxy'), t('vr.settings.bookmarks')]
    },
    {
      id: 'settings.section.audio',
      steppers: ['masterVolume'],
      actions: [t('vr.settings.video360')]
    }
  ];

  return { toggles, steppers, cycles, actions, spec };
}
