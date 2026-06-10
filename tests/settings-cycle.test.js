/**
 * Unit tests for the cycle-button option logic used by makeCycleButton.
 *
 * The button itself is a canvas/Three.js object wired in VRApp, so here we
 * test the underlying cycling behaviour in isolation: given an ordered list
 * of options and a current value, step to the next (wrapping).
 */

/** Minimal replica of makeCycleButton's step logic. */
function cycleNext(options, current) {
  const idx = options.indexOf(current);
  return options[(idx + 1) % options.length];
}

describe('comfort preset cycling', () => {
  const PRESETS = ['sensitive', 'moderate', 'tolerant', 'disabled'];

  test('advances from first to second', () => {
    expect(cycleNext(PRESETS, 'sensitive')).toBe('moderate');
  });

  test('advances through the middle', () => {
    expect(cycleNext(PRESETS, 'moderate')).toBe('tolerant');
    expect(cycleNext(PRESETS, 'tolerant')).toBe('disabled');
  });

  test('wraps from last back to first', () => {
    expect(cycleNext(PRESETS, 'disabled')).toBe('sensitive');
  });

  test('returns first option when current is unknown', () => {
    // indexOf returns -1; (-1 + 1) % n = 0
    expect(cycleNext(PRESETS, 'unknown')).toBe('sensitive');
  });
});

describe('search engine cycling', () => {
  const ENGINES = ['duckduckgo', 'google', 'bing', 'ecosia'];

  test('advances from duckduckgo to google', () => {
    expect(cycleNext(ENGINES, 'duckduckgo')).toBe('google');
  });

  test('wraps from ecosia back to duckduckgo', () => {
    expect(cycleNext(ENGINES, 'ecosia')).toBe('duckduckgo');
  });

  test('covers all four engines in a full cycle', () => {
    let current = 'duckduckgo';
    const visited = [current];
    for (let i = 0; i < ENGINES.length - 1; i++) {
      current = cycleNext(ENGINES, current);
      visited.push(current);
    }
    expect(visited).toEqual(ENGINES);
    // One more step wraps back to the start
    expect(cycleNext(ENGINES, current)).toBe('duckduckgo');
  });
});
