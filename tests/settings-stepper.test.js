/**
 * Unit tests for the pure numeric settings-stepper helpers.
 */
const {
  stepValue, decimalsFor, stepperRegion, formatValue, settingsButtonCaption,
  shouldAnnounceSettingsButton, MINUS_MAX_U, PLUS_MIN_U
} = require('../src/vr/settingsStepper.js');

describe('stepValue', () => {
  const opts = { min: 15, max: 90, step: 15 };

  test('increments by one step', () => {
    expect(stepValue(30, 1, opts)).toBe(45);
  });
  test('decrements by one step', () => {
    expect(stepValue(30, -1, opts)).toBe(15);
  });
  test('clamps at max', () => {
    expect(stepValue(90, 1, opts)).toBe(90);
  });
  test('clamps at min', () => {
    expect(stepValue(15, -1, opts)).toBe(15);
  });

  test('snaps off-grid values to the grid', () => {
    expect(stepValue(32, 1, opts)).toBe(45); // 32+15=47 → snap to 45
  });

  test('handles fractional steps without FP dust', () => {
    const o = { min: 0.5, max: 4.0, step: 0.5 };
    expect(stepValue(1.0, 1, o)).toBe(1.5);
    expect(stepValue(1.5, 1, o)).toBe(2.0);
    // classic 0.1 dust case
    const o2 = { min: 0, max: 1, step: 0.1 };
    expect(stepValue(0.2, 1, o2)).toBe(0.3);
  });

  test('multi-step delta works', () => {
    expect(stepValue(15, 2, opts)).toBe(45);
  });
});

describe('decimalsFor', () => {
  test('integer step → 0 decimals', () => {
    expect(decimalsFor(15)).toBe(0);
  });
  test('0.5 → 1 decimal', () => {
    expect(decimalsFor(0.5)).toBe(1);
  });
  test('0.25 → 2 decimals', () => {
    expect(decimalsFor(0.25)).toBe(2);
  });
});

describe('stepperRegion', () => {
  test('left region decrements', () => {
    expect(stepperRegion(0.1)).toBe('decrement');
    expect(stepperRegion(MINUS_MAX_U - 0.01)).toBe('decrement');
  });
  test('right region increments', () => {
    expect(stepperRegion(0.9)).toBe('increment');
    expect(stepperRegion(PLUS_MIN_U + 0.01)).toBe('increment');
  });
  test('middle is none', () => {
    expect(stepperRegion(0.5)).toBe('none');
  });
});

describe('formatValue', () => {
  test('integer step formats with no decimals + unit', () => {
    expect(formatValue(30, { step: 15, unit: '°' })).toBe('30°');
  });
  test('fractional step keeps decimals', () => {
    expect(formatValue(1.5, { step: 0.5, unit: ' m/s' })).toBe('1.5 m/s');
  });
  test('defaults work', () => {
    expect(formatValue(3)).toBe('3');
  });
});

describe('settingsButtonCaption — gaze-dwell hover announcement text', () => {
  test('toggle ON announces label and state', () => {
    expect(settingsButtonCaption('toggle', 'Teleport', true)).toBe('Teleport: ON');
  });

  test('toggle OFF announces label and state', () => {
    expect(settingsButtonCaption('toggle', 'Snap Turn', false)).toBe('Snap Turn: OFF');
  });

  test('stepper announces label and formatted value', () => {
    expect(settingsButtonCaption('stepper', 'Snap Angle', 30, { step: 15, unit: '°' }))
      .toBe('Snap Angle: 30°');
    expect(settingsButtonCaption('stepper', 'Move Speed', 1.5, { step: 0.5, unit: ' m/s' }))
      .toBe('Move Speed: 1.5 m/s');
  });

  test('cycle announces label and current selection', () => {
    expect(settingsButtonCaption('cycle', 'Comfort', 'sensitive')).toBe('Comfort: sensitive');
    expect(settingsButtonCaption('cycle', 'Search', 'duckduckgo')).toBe('Search: duckduckgo');
  });

  test('action announces just the label', () => {
    expect(settingsButtonCaption('action', '360° Video', undefined)).toBe('360° Video');
    expect(settingsButtonCaption('action', 'Bookmarks', null)).toBe('Bookmarks');
  });

  test('unknown type falls back to label', () => {
    expect(settingsButtonCaption('unknown', 'Widget', true)).toBe('Widget');
  });
});

describe('shouldAnnounceSettingsButton — caption gate', () => {
  test('never announces when captions are disabled', () => {
    expect(shouldAnnounceSettingsButton({ captionsEnabled: false, gazeDwell: true, force: true })).toBe(false);
    expect(shouldAnnounceSettingsButton({ captionsEnabled: false, gazeDwell: true, force: false })).toBe(false);
  });

  test('hover (force=false) announces only while gaze-dwell is active', () => {
    expect(shouldAnnounceSettingsButton({ captionsEnabled: true, gazeDwell: true, force: false })).toBe(true);
    expect(shouldAnnounceSettingsButton({ captionsEnabled: true, gazeDwell: false, force: false })).toBe(false);
  });

  test('select (force=true) announces even without gaze-dwell', () => {
    expect(shouldAnnounceSettingsButton({ captionsEnabled: true, gazeDwell: false, force: true })).toBe(true);
    expect(shouldAnnounceSettingsButton({ captionsEnabled: true, gazeDwell: true, force: true })).toBe(true);
  });

  test('force defaults to false (hover semantics)', () => {
    expect(shouldAnnounceSettingsButton({ captionsEnabled: true, gazeDwell: false })).toBe(false);
    expect(shouldAnnounceSettingsButton({ captionsEnabled: true, gazeDwell: true })).toBe(true);
  });
});
