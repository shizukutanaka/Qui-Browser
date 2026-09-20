/**
 * In-VR settings panel assembly: section table + control placement.
 * Extracted from VRApp — `app` is the VRApp instance; all subsystem
 * references are read lazily inside apply-closures so construction order
 * is preserved exactly.
 */

import * as THREE from 'three';
import { t } from '../../i18n/i18n.js';
import { setPref, prefersHighContrast, osReducedMotion } from '../../a11y/accessibility.js';
import { smoothMoveWarning } from '../comfort/ComfortSystem.js';
import { layoutSettingsPanel, PANEL_W as SETTINGS_PANEL_W } from './settingsLayout.js';
import { compactToggleButton, sectionTab, actionButton, stepperButton, cycleButton } from './settingsButtons.js';
import { settingsButtonCaption, shouldAnnounceSettingsButton } from '../settingsStepper.js';
import { launchImmersiveVideo } from '../browser/browserActions.js';
import { showCaption } from '../caption.js';
import { PANEL_DISTANCE_MIN, PANEL_DISTANCE_MAX } from '../browser/panelGeometry.js';

/**
 * Build the in-VR settings panel: a backing quad plus toggle buttons wired to
 * the runtime settings (all effects are immediate and safe).
 */
export function createSettingsPanel(app) {
  const group = new THREE.Group();
  const b = btnCtx(app);
  group.name = 'settingsPanel';
  // Collect per-button redraw callbacks so that appearance-affecting setting
  // changes (e.g. high-contrast) can repaint the whole panel in one shot.
  app._settingsPanelDrawers = [];

  const items = [
    [t('vr.settings.highContrast'), 'highContrast', (v) => {
      setPref('highContrast', v);
      redrawSettingsPanel(app);
      if (app.bookmarkPanel && app.bookmarkPanel.visible) {
        app.bookmarkPanel._draw();
      }
      // Caption backing switches between semi-transparent (normal) and fully
      // opaque (HC) — update live so the effect is immediate, not deferred
      // until the next VR session restart.
      if (app.captionSystem) {
        app.captionSystem.setHighContrast(v);
      }
      // Gaze reticle ring: full opacity in HC so it is always visible
      // against bright VR scenes (WCAG 1.4.11 Non-text Contrast).
      if (app.gazeInteraction) {
        app.gazeInteraction.setHighContrast(prefersHighContrast());
      }
    }],
    [t('vr.settings.teleport'), 'enableTeleport', null],
    [t('vr.settings.snapTurn'), 'enableSnapTurn', null],
    [t('vr.settings.smoothMove'), 'enableSmoothMove', (v) => {
      const msg = smoothMoveWarning(v, osReducedMotion());
      if (msg) {
        app.showVRToast(msg, { type: 'warn' });
      }
    }],
    [t('vr.settings.southpaw'), 'southpaw', (v) => {
      showCaption(app, t(v ? 'vr.msg.primaryHandLeft' : 'vr.msg.primaryHandRight'));
    }],
    [t('vr.settings.comfort'), 'enableComfort', null],
    [t('vr.settings.foveation'), 'enableFFR', (v) => {
      if (app.ffrSystem) {
        v ? app.ffrSystem.enable(0.5) : app.ffrSystem.disable();
      }
    }],
    [t('vr.settings.gazeSelect'), 'enableGazeDwell', (v) => {
      if (app.gazeInteraction) {
        app.gazeInteraction.setEnabled(v);
      }
    }],
    [t('vr.settings.haptics'), 'enableHaptics', (v) => {
      if (app.hapticFeedback) {
        app.hapticFeedback.setEnabled(v);
      }
    }],
    [t('vr.settings.captions'), 'enableCaptions', (v) => {
      if (app.captionSystem) {
        app.captionSystem.setEnabled(v);
        if (v) {
          showCaption(app, t('vr.msg.captionsEnabled'));
        }
      }
    }],
    // FR-1.1: in-VR web browsing (WebPanel/TabManager/BookmarkPanel/
    // WindowManager) is constructed once, in initializeSystems(), gated on
    // this same setting — there was previously no way for a real user to
    // ever set it, since it was absent from every settings-panel/voice/
    // persisted-setting path. Toggling it here persists the preference
    // (FR-9.1) but can only take effect on the next page load, since
    // construction is one-shot; the apply callback is honest about that.
    [t('vr.settings.webPanel'), 'enableWebPanel', (v) => app._onWebPanelToggleChanged(v)],
    [t('vr.settings.followView'), 'enableWindowFollow', (v) => {
      if (app.windowManager) {
        app.windowManager.setFollow(v);
      }
    }],
    [t('vr.settings.curved'), 'enableCurvedPanel', (v) => {
      if (app.tabManager) {
        app.tabManager.setCurved(v);
      } else if (app.webPanel && app.webPanel.setCurved) {
        app.webPanel.setCurved(v);
      }
    }]
  ];

  // Numeric steppers for tunable parameters that were previously code-only.
  const steppers = [
    [t('vr.settings.snapAngle'), 'snapTurnAngle', { min: 15, max: 90, step: 15, unit: '°' }],
    [t('vr.settings.moveSpeed'), 'smoothMoveSpeed', { min: 0.5, max: 4.0, step: 0.5, unit: ' m/s' }],
    [t('vr.settings.gazeTime'), 'gazeDwellTime', {
      min: 500, max: 3000, step: 250, unit: 'ms',
      apply: (v) => {
        if (app.gazeInteraction) {
          app.gazeInteraction.dwellTime = v;
        }
      }
    }],
    // WCAG 2.2.1 Timing Adjustable: users with tremor / nystagmus can widen
    // this window so a brief involuntary slip off-target doesn't restart the
    // dwell; precision-focused users can narrow it to 0 to disable forgiveness.
    [t('vr.settings.graceTime'), 'gazeGraceTime', {
      min: 0, max: 600, step: 50, unit: 'ms',
      apply: (v) => {
        if (app.gazeInteraction) {
          app.gazeInteraction.graceTime = v;
        }
      }
    }],
    [t('vr.settings.panelDist'), 'windowDistance', {
      min: PANEL_DISTANCE_MIN, max: PANEL_DISTANCE_MAX, step: 0.2, unit: ' m',
      apply: (v) => {
        if (app.windowManager) {
          app.windowManager.setDistance(v);
        }
      }
    }],
    // WCAG 2.2.1 Timing Adjustable (Adjust option): range must reach ≥ 10× the
    // default (5 s default → min ceiling 50 s). Using 60 s (12×) as the max.
    [t('vr.settings.captionHold'), 'captionDuration', {
      min: 2, max: 60, step: 2, unit: 's',
      apply: (v) => {
        if (app.captionSystem) {
          app.captionSystem.setLineDuration(v * 1000);
        }
      }
    }],
    [t('vr.settings.captionSize'), 'captionScale', {
      min: 0.5, max: 3.0, step: 0.25, unit: 'x',
      apply: (v) => {
        if (app.captionSystem) {
          app.captionSystem.setScale(v);
        }
      }
    }],
    // XAUR: caption position customization. Height in metres below eye level
    // (more-negative = lower in the field of view).
    [t('vr.settings.captionHeight'), 'captionHeight', {
      min: -0.85, max: -0.25, step: 0.1, unit: 'm',
      apply: (v) => {
        if (app.captionSystem) {
          app.captionSystem.setVerticalOffset(v);
        }
      }
    }],
    // Master spatial-audio volume (0 = muted). Stored as a percentage for a
    // readable stepper; SpatialAudio.setMasterVolume expects a 0–1 gain.
    [t('vr.settings.soundVolume'), 'masterVolume', {
      min: 0, max: 100, step: 10, unit: '%',
      apply: (v) => {
        if (app.spatialAudio) {
          app.spatialAudio.setMasterVolume(v / 100);
        }
      }
    }]
  ];

  // Cycle buttons for enumerated settings (currently code-only or keyboard-shortcut-only).
  const COMFORT_PRESETS = ['sensitive', 'moderate', 'tolerant', 'disabled'];
  const SEARCH_ENGINES  = ['duckduckgo', 'google', 'bing', 'ecosia'];
  const cycles = [
    ['Comfort', 'motionSensitivity', COMFORT_PRESETS, (v) => {
      if (app.comfortSystem) {
        app.comfortSystem.setPreset(v);
      }
    }],
    [t('vr.settings.search'), 'searchEngine', SEARCH_ENGINES, (v) => {
      if (app.tabManager) {
        app.tabManager.setSearchEngine(v);
      }
    }]
  ];

  // Action buttons (non-toggle). Only shown when their target exists.
  const actions = [];
  // Immersive 360°/180° video: prompt for a URL (VR keyboard) and play it.
  actions.push([t('vr.settings.video360'), () => launchImmersiveVideo(app)]);
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
    actions.push([t('vr.settings.bookmarks'), () => {
      if (app.bookmarkPanel) {
        app.bookmarkPanel.toggle();
        // Announce the resulting open/closed state as a status message
        // (WCAG 4.1.3) so caption-reliant users know whether the panel
        // appeared or disappeared.
        showCaption(app, app.bookmarkPanel.visible ? t('vr.msg.bookmarksOpen') : t('vr.msg.bookmarksClosed'));
      }
    }]);
  }

  // Grouped, collapsible layout. The flat stack reached 19 rows / 3.56 m,
  // which subtends 72.2° vertically at this panel's 2.44 m placement — about
  // double the ~30-40° you can take in without moving your head, so the lower
  // half was effectively out of view and every new setting made it worse.
  // Sections are keyed by what the user is trying to do, and only the open
  // one occupies rows (see src/vr/ui/settingsLayout.js).
  const byKey = (list, keys) => keys
    .map((k) => list.find((e) => e[1] === k))
    .filter(Boolean);
  const actionByLabel = (label) => actions.filter((a) => a[0] === label);

  const SECTIONS = [
    ['settings.section.a11y',
      byKey(items, ['enableCaptions', 'enableGazeDwell', 'highContrast', 'enableHaptics']),
      byKey(steppers, ['captionDuration', 'captionScale', 'captionHeight', 'gazeDwellTime', 'gazeGraceTime']),
      [], []],
    ['settings.section.locomotion',
      byKey(items, ['enableTeleport', 'enableSnapTurn', 'enableSmoothMove', 'southpaw', 'enableComfort']),
      byKey(steppers, ['snapTurnAngle', 'smoothMoveSpeed']),
      cycles.filter((c) => c[1] === 'motionSensitivity'), []],
    ['settings.section.display',
      byKey(items, ['enableFFR', 'enableCurvedPanel', 'enableWindowFollow']),
      byKey(steppers, ['windowDistance']), [], []],
    ['settings.section.browsing',
      byKey(items, ['enableWebPanel']), [],
      cycles.filter((c) => c[1] === 'searchEngine'),
      actionByLabel(t('vr.settings.clearHistory'))
        .concat(actionByLabel(t('vr.settings.readerProxy')))
        .concat(actionByLabel(t('vr.settings.bookmarks')))],
    ['settings.section.audio', [], byKey(steppers, ['masterVolume']), [],
      actionByLabel(t('vr.settings.video360'))]
  ];

  // Anything not explicitly placed still has to appear — a control that
  // silently vanished because a key was mistyped would be worse than a long
  // panel. Collected into a trailing section rather than dropped.
  const placed = new Set(SECTIONS.flatMap(([, tg, st, cy]) =>
    [...tg, ...st, ...cy].map((e) => e[1])));
  const placedActions = new Set(SECTIONS.flatMap(([, , , , ac]) => ac.map((a) => a[0])));
  const leftover = [
    items.filter((e) => !placed.has(e[1])),
    steppers.filter((e) => !placed.has(e[1])),
    cycles.filter((e) => !placed.has(e[1])),
    actions.filter((a) => !placedActions.has(a[0]))
  ];
  if (leftover.some((l) => l.length)) {
    SECTIONS.push(['settings.section.other', ...leftover]);
  }

  // Build the pure layout description, then render from it.
  const sections = SECTIONS.map(([id, tg, st, cy, ac]) => ({
    id,
    controls: [
      ...tg.map((e) => ({ wide: false, make: () => compactToggleButton(b, e[0], e[1], e[2]) })),
      ...st.map((e) => ({ wide: true, make: () => stepperButton(b, e[0], e[1], e[2]) })),
      ...cy.map((e) => ({ wide: true, make: () => cycleButton(b, e[0], e[1], e[2], e[3]) })),
      ...ac.map((a) => ({ wide: true, make: () => actionButton(b, a[0], a[1]) }))
    ]
  }));

  // Persisted open/closed state. Accessibility opens by default: it is what
  // this product is for, and it is the section a user most likely came to.
  if (!Array.isArray(app.settings.openSettingsSections)) {
    app.settings.openSettingsSections = ['settings.section.a11y'];
  }
  const layout = layoutSettingsPanel(sections, app.settings.openSettingsSections);

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(SETTINGS_PANEL_W, layout.height),
    new THREE.MeshBasicMaterial({ color: 0x0a0d14, transparent: true, opacity: 0.6 })
  );
  group.add(bg);

  for (const p of layout.placements) {
    if (p.type === 'tab') {
      const btn = sectionTab(b, p.sectionId, p.w);
      btn.position.set(p.x, p.y, 0.01);
      group.add(btn);
      app._settingsPanelDrawers.push(btn._redraw);
    } else {
      const section = sections.find((sec) => sec.id === p.sectionId);
      const btn = section.controls[p.index].make();
      btn.position.set(p.x, p.y, 0.01);
      group.add(btn);
      app._settingsPanelDrawers.push(btn._redraw);
    }
  }

  // Front-left of the user, angled toward them.
  group.position.set(-1.4, 1.5, -2.0);
  group.rotation.y = Math.PI / 8;
  return group;
}

export function onWebPanelToggleChanged(app, enabled) {
  const on = enabled === undefined ? !!app.settings.enableWebPanel : !!enabled;
  if (on) {
    app._buildBrowsingSystems();
    app._attachManagedWindow();
  } else {
    app._teardownBrowsingSystems();
  }
  app.showVRToast(
    t(on ? 'vr.msg.webPanelOn' : 'vr.msg.webPanelOff'),
    { type: 'info' }
  );
}

function toggleSettingsSection(app, sectionId) {
  // Tab semantics: selecting always selects. Exactly one section is shown, so
  // the panel's height is bounded by `1 tab row + largest section` and adding
  // a 25th control can only grow it by its own section. Re-selecting the
  // active tab is a no-op rather than collapsing to an empty panel, which is
  // what a tab affordance leads a user to expect.
  const current = app.settings.openSettingsSections || [];
  if (current.length === 1 && current[0] === sectionId) {
    return;
  }
  app.updateSetting('openSettingsSections', [sectionId]);
  _rebuildSettingsPanel(app);
  showCaption(app, `${t(sectionId)}: ${t('vr.msg.sectionOpen')}`);
}

/** Unregister every interactable in the settings panel and remove it from the scene. */
function disposeSettingsPanel(app) {
  const panel = app.settingsPanel;
  if (!panel) {
    return;
  }
  panel.traverse((obj) => {
    if (obj.isMesh) {
      app.unregisterInteractable(obj);
    }
  });
  if (panel.parent) {
    panel.parent.remove(panel);
  }
}


/** Tear down and rebuild the settings panel in place, preserving visibility. */
function _rebuildSettingsPanel(app) {
  if (!app.settingsPanel) {
    return;
  }
  const wasVisible = app.settingsPanel.visible;
  const parent = app.settingsPanel.parent;
  disposeSettingsPanel(app);
  app.settingsPanel = createSettingsPanel(app);
  app.settingsPanel.visible = wasVisible;
  (parent || app.scene).add(app.settingsPanel);
}

function redrawSettingsPanel(app) {
  if (app._settingsPanelDrawers) {
    app._settingsPanelDrawers.forEach(fn => fn && fn());
  }
}

function announceSettingsButton(app, type, label, value, opts = {}, force = false) {
  const captionsEnabled = !!(app.captionSystem && app.captionSystem.enabled);
  if (!shouldAnnounceSettingsButton({
    captionsEnabled, gazeDwell: app.settings.enableGazeDwell, force
  })) {
    return;
  }
  app.captionSystem.show(settingsButtonCaption(type, label, value, opts));
}

function btnCtx(app) {
  return {
    geoCache: app._sharedGeometries,
    texPool: app._panelTextures,
    register: (m, h) => app.registerInteractable(m, h),
    settings: app.settings,
    updateSetting: (k, v) => app.updateSetting(k, v),
    announce: (...a) => announceSettingsButton(app, ...a),
    toggleSection: (id) => toggleSettingsSection(app, id)
  };
}
