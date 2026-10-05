/**
 * Class seal for the two claims tests/setup.js makes about the shared
 * test environment:
 *
 * 1. "navigator.xr stub prevents undefined-property errors for modules that
 *    do a feature check ('xr' in navigator)" — backwards. `in` never throws
 *    on a plain `{}`; assigning `navigator.xr = undefined` makes the `in`
 *    check TRUE, so a module that detects XR via `in` (src/main.js does)
 *    would take the XR path and crash on `.isSessionSupported`. The honest
 *    stub is `navigator` existing WITHOUT the `xr` property.
 *
 * 2. "localStorage is cleared automatically between tests by jest's
 *    clearMocks/resetMocks" — false. Those flags only reset jest.fn() state;
 *    the shim's Map persists across tests within a file (every consumer
 *    compensates with a manual localStorage.clear()).
 */
describe('tests/setup.js honesty', () => {
  test('does not fake XR feature presence to `in` feature checks', () => {
    expect('xr' in navigator).toBe(false);
    expect(navigator.xr).toBeUndefined();
  });

  // Order-sensitive isolation probe: jest runs tests in file order.
  test('localStorage shim stores values within a test', () => {
    localStorage.setItem('__setup_sentinel_888__', '1');
    expect(localStorage.getItem('__setup_sentinel_888__')).toBe('1');
  });

  test('localStorage shim does not leak state into the next test', () => {
    expect(localStorage.getItem('__setup_sentinel_888__')).toBeNull();
  });
});
