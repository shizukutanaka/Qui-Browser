/**
 * Unit tests for the pure numeric settings-stepper helpers.
 */
const {
  stepValue, decimalsFor, stepperRegion, formatValue,
  MINUS_MAX_U, PLUS_MIN_U
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
