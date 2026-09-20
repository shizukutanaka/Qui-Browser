/**
 * Settings-panel button factories.
 *
 * Each factory builds a canvas-textured mesh via the shared canvasButton
 * scaffold, defines a draw(hover) repaint closure, and registers the mesh as
 * interactable. VRApp state arrives through the `b` context object rather
 * than `this`, keeping every function module-pure and unit-testable:
 *
 *   b.geoCache        Map           shared PlaneGeometry cache
 *   b.texPool         CanvasTexture[]  textures to dispose on teardown
 *   b.register(mesh, handlers)      interactable registry
 *   b.settings        object        live settings (mutated in place)
 *   b.updateSetting(key, value)     persists + live-applies
 *   b.announce(type, label, value, opts, force)  caption integration
 *   b.toggleSection(sectionId)      section expand/collapse (tabs only)
 */

import { canvasButton } from './canvasMesh.js';
import { prefersHighContrast } from '../../a11y/accessibility.js';
import { t } from '../../i18n/i18n.js';
import { buttonBg, buttonLineWidth, toggleIndicatorColors, buttonAccentColor } from './buttonStyle.js';
import { stepValue, stepperRegion, formatValue } from '../settingsStepper.js';

function registerCanvasButton(b, mesh, draw, handlers) {
  b.register(mesh, handlers);
  mesh._redraw = () => draw(false);
  return mesh;
}

/**
 * Half-width toggle button for the 2-column settings panel layout.
 * Uses a 256×96 canvas so text renders correctly at the narrower geometry size.
 */
export function compactToggleButton(b, label, key, apply) {
  const w = 256;
  const h = 96;
  const { ctx, tex, mesh } = canvasButton(b.geoCache, b.texPool, w, h, 0.43);

  const draw = (hover) => {
    const on = !!b.settings[key];
    const hc = prefersHighContrast();
    const ind = toggleIndicatorColors(on, hc, hover);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = buttonBg(hover, hc);
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ind.border;
    ctx.lineWidth = buttonLineWidth(hover, hc);
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(label, 14, 58);
    ctx.textAlign = 'right';
    ctx.fillStyle = ind.label;
    ctx.fillText(on ? 'ON' : 'OFF', w - 14, 58);
    tex.needsUpdate = true;
  };
  draw(false);

  return registerCanvasButton(b, mesh, draw, {
    onSelect: () => {
      const value = !b.settings[key];
      b.updateSetting(key, value);
      if (apply) {
        apply(value);
      }
      draw(true);
      b.announce('toggle', label, value, {}, true);
    },
    onHover: () => {
      draw(true);
      b.announce('toggle', label, !!b.settings[key]);
    },
    onHoverEnd: () => draw(false)
  });
}

export function sectionTab(b, sectionId, widthM) {
  const w = 256;
  const h = 96;
  const { ctx, tex, mesh } = canvasButton(b.geoCache, b.texPool, w, h, widthM);
  const label = t(sectionId);

  const draw = (hover) => {
    const hc = prefersHighContrast();
    const isOpen = (b.settings.openSettingsSections || []).includes(sectionId);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = buttonBg(hover, hc);
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = buttonAccentColor('#8fa0ff', hc);
    ctx.lineWidth = buttonLineWidth(hover, hc);
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    // Glyph carries the selected state without relying on hue (WCAG 1.4.1).
    // maxWidth backstop so a long translated label condenses instead of
    // escaping the tab (the discipline from the text-overflow family).
    ctx.fillText(`${isOpen ? '●' : '○'} ${label}`, w / 2, 60, w - 16);
    tex.needsUpdate = true;
  };
  draw(false);

  return registerCanvasButton(b, mesh, draw, {
    onSelect: () => b.toggleSection(sectionId),
    onHover: () => {
      draw(true);
      b.announce('action', label);
    },
    onHoverEnd: () => draw(false)
  });
}

export function actionButton(b, label, onSelect) {
  const w = 512;
  const h = 96;
  const { ctx, tex, mesh } = canvasButton(b.geoCache, b.texPool, w, h, 0.9);

  const draw = (hover) => {
    const hc = prefersHighContrast();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = buttonBg(hover, hc);
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = buttonAccentColor('#5e72e4', hc);
    ctx.lineWidth = buttonLineWidth(hover, hc);
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(label, 24, 62);
    ctx.textAlign = 'right';
    ctx.fillStyle = buttonAccentColor('#8fa0ff', hc);
    ctx.fillText('▸', w - 24, 62);
    tex.needsUpdate = true;
  };
  draw(false);

  return registerCanvasButton(b, mesh, draw, {
    onSelect: () => {
      if (onSelect) {
        onSelect();
      }
      draw(true);
      b.announce('action', label, undefined, {}, true);
    },
    onHover: () => {
      draw(true);
      b.announce('action', label);
    },
    onHoverEnd: () => draw(false)
  });
}

/**
 * Numeric stepper bound to a numeric setting: [ − | label: value | + ].
 * Selecting the left/right region steps the value (clamped to min/max,
 * snapped to step), persists it, and runs an optional live-apply callback.
 * Returns the button mesh (registered).
 */
export function stepperButton(b, label, key, cfg) {
  const { min, max, step, unit = '', apply } = cfg;
  const w = 512;
  const h = 96;
  const { ctx, tex, mesh } = canvasButton(b.geoCache, b.texPool, w, h, 0.9);


  const draw = (hover) => {
    const value = b.settings[key];
    const hc = prefersHighContrast();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = buttonBg(hover, hc);
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = buttonAccentColor('#5e72e4', hc);
    ctx.lineWidth = buttonLineWidth(hover, hc);
    ctx.strokeRect(2, 2, w - 4, h - 4);
    // − / + glyphs at the edges
    ctx.fillStyle = buttonAccentColor('#8fa0ff', hc);
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('−', w * 0.12, h / 2 + 18);
    ctx.fillText('+', w * 0.88, h / 2 + 18);
    // label + value in the middle
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(`${label}: ${formatValue(value, { step, unit })}`, w / 2, h / 2 + 11);
    tex.needsUpdate = true;
  };
  draw(false);

  const applyStep = (delta) => {
    const next = stepValue(b.settings[key], delta, { min, max, step });
    if (next !== b.settings[key]) {
      b.updateSetting(key, next); // persists (FR-9.1)
      if (apply) {
        apply(next);
      }
      b.announce('stepper', label, next, { step, unit }, true);
    }
    draw(true);
  };

  b.register(mesh, {
    onSelect: (evt) => {
      // Map the hit point to a horizontal fraction of the button to decide
      // whether the − or + region was pressed.
      // Controllers fire onSelect({ intersection: hit, controller }) and gaze
      // fires onSelect({ intersection: hit, gaze: true }); fall back to evt
      // itself for direct calls (tests / legacy).
      const rawPoint = evt?.intersection?.point ?? evt;
      let u = 0.5;
      if (rawPoint && mesh.worldToLocal) {
        const local = mesh.worldToLocal(rawPoint.clone());
        u = (local.x / 0.9) + 0.5; // PlaneGeometry width is 0.9
      }
      const region = stepperRegion(u);
      if (region === 'decrement') {
        applyStep(-1);
      } else if (region === 'increment') {
        applyStep(1);
      } else {
        draw(true);
      }
    },
    onHover: () => {
      draw(true);
      b.announce('stepper', label, b.settings[key], { step, unit });
    },
    onHoverEnd: () => draw(false)
  });
  mesh._redraw = () => draw(false);
  return mesh;
}

/**
 * Cycle button stepping through a fixed list of string options for a
 * settings key. Selecting advances to the next option (wrapping), persists
 * the setting, and calls an optional live-apply callback.
 */
export function cycleButton(b, label, key, options, apply) {
  const w = 512;
  const h = 96;
  const { ctx, tex, mesh } = canvasButton(b.geoCache, b.texPool, w, h, 0.9);

  const draw = (hover) => {
    const current = b.settings[key];
    const hc = prefersHighContrast();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = buttonBg(hover, hc);
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = buttonAccentColor('#e4a85e', hc);
    ctx.lineWidth = buttonLineWidth(hover, hc);
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(label, 24, 62);
    ctx.textAlign = 'right';
    ctx.fillStyle = buttonAccentColor('#ffcc88', hc);
    ctx.fillText(`${current} ▸`, w - 24, 62);
    tex.needsUpdate = true;
  };
  draw(false);

  return registerCanvasButton(b, mesh, draw, {
    onSelect: () => {
      const idx = options.indexOf(b.settings[key]);
      const next = options[(idx + 1) % options.length];
      b.updateSetting(key, next);
      if (apply) {
        apply(next);
      }
      draw(true);
      b.announce('cycle', label, next, {}, true);
    },
    onHover: () => {
      draw(true);
      b.announce('cycle', label, b.settings[key]);
    },
    onHoverEnd: () => draw(false)
  });
}
