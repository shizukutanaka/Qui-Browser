/**
 * Dead-public-surface pins — round 839.
 *
 * WindowManager exposed a speculative public API with zero call sites in src/
 * (verified including optional-chained `?.` callers):
 *   - nudgeDistance(delta) — stepper code paths call setDistance() directly
 *   - setBillboard(value)  — billboard mode was never wired to any control;
 *                            `this.billboard` stayed false forever, making the
 *                            `else if (this.billboard)` branch unreachable
 *
 * These tests fail while the dead surface exists and pass once it is removed;
 * they also pin the live surface so the sweep cannot over-delete.
 */
import { WindowManager } from '../src/vr/browser/WindowManager.js';

describe('round-839 dead public surface — gone', () => {
  test('WindowManager.prototype.nudgeDistance is gone', () => {
    expect(WindowManager.prototype.nudgeDistance).toBeUndefined();
  });

  test('WindowManager.prototype.setBillboard is gone', () => {
    expect(WindowManager.prototype.setBillboard).toBeUndefined();
  });

  test('WindowManager instances carry no billboard field', () => {
    const cam = { getWorldPosition: jest.fn(), getWorldQuaternion: jest.fn() };
    const wm = new WindowManager(cam);
    expect('billboard' in wm).toBe(false);
  });
});

describe('round-839 dead public surface — live surface pinned', () => {
  test.each(['attach', 'detach', 'setFollow', 'setDistance', 'beginGrab', 'endGrab', 'update', 'dispose'])(
    'WindowManager.prototype.%s still exists',
    (name) => {
      expect(typeof WindowManager.prototype[name]).toBe('function');
    }
  );

  test('WindowManager.prototype.isGrabbing getter still exists', () => {
    const d = Object.getOwnPropertyDescriptor(WindowManager.prototype, 'isGrabbing');
    expect(d && typeof d.get === 'function').toBe(true);
  });
});
