/**
 * Unit tests for the pure debounce utility.
 * Uses Jest fake timers so the trailing-edge semantics are deterministic.
 */

const { debounce } = require('../src/utils/debounce.js');

describe('debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('invokes the callback once after the quiet window elapses', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d();
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('coalesces a burst of calls into a single trailing invocation', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    for (let i = 0; i < 50; i++) {
      d();
      jest.advanceTimersByTime(10); // 10 ms < wait, so the timer keeps resetting
    }
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('forwards the LAST call\'s arguments (trailing-edge semantics)', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d('first');
    d('second');
    d('third');
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });

  test('two well-separated calls fire twice (timer fully elapses between)', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d();
    jest.advanceTimersByTime(150);
    d();
    jest.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('cancel() drops a pending trailing-edge invocation', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d();
    d.cancel();
    jest.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  test('cancel() is safe to call when no timer is pending', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    expect(() => d.cancel()).not.toThrow();
    expect(() => d.cancel()).not.toThrow(); // double-cancel also safe
  });

  test('defaults the wait window to 150 ms', () => {
    const fn = jest.fn();
    const d = debounce(fn); // no explicit wait
    d();
    jest.advanceTimersByTime(149);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
