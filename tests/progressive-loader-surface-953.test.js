/**
 * Invariant pins for the ProgressiveLoader dead-surface sweep (round 953).
 *
 * Dead-surface class (#1123/#1212/#1218 same class): public API declared and
 * documented but with zero consumers — `loadOnDemand`, `preload`, `getStats`,
 * and the never-registered callback channels onComplete / onError /
 * onCriticalComplete were removed, together with the write-only state they
 * were the sole readers of (`failed` map, `lazy` queue bucket,
 * `strategy.preloadNext`).
 *
 * These pins fail if the dead surface comes back, and pin the live surface
 * VRApp actually consumes so the sweep cannot regress it.
 */

const { readFileSync } = require('fs');
const { join } = require('path');

const read = (p) => readFileSync(join(__dirname, '..', p), 'utf8');
const SRC = read('src/utils/ProgressiveLoader.js');
const VRAPP = read('src/vr/VRApp.js');

describe('ProgressiveLoader: dead public surface stays removed', () => {
  test('no on-demand / preload entry points (zero call sites)', () => {
    expect(SRC).not.toMatch(/\bloadOnDemand\b/);
    expect(SRC).not.toMatch(/\bpreload\s*\(/);
  });

  test('no test-only getStats diagnostics surface', () => {
    expect(SRC).not.toMatch(/\bgetStats\s*\(/);
  });

  test('no never-registered callback channels (onComplete/onError/onCriticalComplete)', () => {
    expect(SRC).not.toMatch(/\bonComplete\b/);
    expect(SRC).not.toMatch(/\bonError\b/);
    expect(SRC).not.toMatch(/\bonCriticalComplete\b/);
  });

  test('no write-only state left behind by the removals', () => {
    expect(SRC).not.toMatch(/this\.failed\b/); // map was only read by getStats
    expect(SRC).not.toMatch(/\blazy\b/); // bucket was only fed by loadOnDemand
    expect(SRC).not.toMatch(/\bpreloadNext\b/); // flag was only read by preload
  });

  test('dependent test files no longer exercise the removed API', () => {
    expect(read('tests/progressive-loader.test.js')).not.toMatch(/getStats|preloadNext/);
    expect(read('tests/subsystems.test.js')).not.toMatch(/getStats/);
  });
});

describe('ProgressiveLoader: live surface stays intact', () => {
  test('the path VRApp uses is still there (addResource → start → get → dispose)', () => {
    for (const sig of ['addResource(', 'async start(', 'get(', 'dispose(']) {
      expect(SRC).toContain(sig);
    }
    expect(SRC).toMatch(/callbacks\s*=\s*\{\s*onProgress/);
  });

  test('VRApp still drives the loader for the shipped audio files', () => {
    expect(VRAPP).toMatch(/progressiveLoader\.addResource\(/);
    expect(VRAPP).toMatch(/progressiveLoader\.start\(\)/);
    expect(VRAPP).toMatch(/progressiveLoader\.get\(/);
    expect(VRAPP).toMatch(/progressiveLoader\.dispose\(\)/);
    expect(VRAPP).toMatch(/progressiveLoader\.callbacks\.onProgress/);
  });

  test('audio dispatch arm and network-adaptive strategy survive', () => {
    expect(SRC).toMatch(/case 'audio':\s*\n\s*return this\.loadAudio/);
    expect(SRC).toMatch(/this\.strategy\.parallelLimit\s*=/);
    expect(SRC).toMatch(/this\.strategy\.adaptiveQuality\s*=/);
  });
});
