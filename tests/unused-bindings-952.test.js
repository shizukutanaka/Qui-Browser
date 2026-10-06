/**
 * Unused-binding pin — eslint's no-unused-vars (caughtErrors enabled) flagged
 * eight bindings that later merges re-introduced after the #1174 sweep:
 * catch params the block never reads, a dead import, and three dead test vars.
 * Bare `catch {` is used for params nothing consumes (ES2019+).
 */
const { readFileSync } = require('fs');
const { join } = require('path');

const read = (p) => readFileSync(join(__dirname, '..', p), 'utf8');

test('VRApp has no unused catch params (hostnameCaption + disposeMonitoring)', () => {
  const SRC = read('src/vr/VRApp.js');
  expect(SRC).not.toMatch(/catch \(_\)/);
});

test('SpatialAudio has no unused catch param in removeSource', () => {
  const SRC = read('src/vr/audio/SpatialAudio.js');
  // Two `catch (e)` sites existed; the used one (createVoiceSource) stays.
  expect((SRC.match(/catch \(e\)/g) || []).length).toBe(1);
});

test('JapaneseIME has no unused catch param and no dead truncate import', () => {
  const SRC = read('src/vr/input/JapaneseIME.js');
  expect(SRC).not.toMatch(/catch \(_\)/);
  // \btruncate\b does not match inside truncateToWidth (no word boundary
  // before 'ToWidth'), so any hit is the dead import or a stray call.
  expect(SRC).not.toMatch(/\btruncate\b/);
});

test('bookmarkLayout still exports truncate for its real consumers', () => {
  const mod = require('../src/vr/browser/bookmarkLayout.js');
  expect(typeof mod.truncate).toBe('function');
});

test('url-display test drops the shadowed top-level setLanguage destructure', () => {
  const SRC = read('tests/url-display.test.js');
  expect(SRC).not.toMatch(/^const \{ setLanguage \} = require/m);
});

test('vr-controller-input test drops the unused srcReleased fixture', () => {
  const SRC = read('tests/vr-controller-input.test.js');
  expect(SRC).not.toMatch(/\bsrcReleased\b/);
});

test('workflow-refs test drops the unused statSync destructure', () => {
  const SRC = read('tests/workflow-refs-852.test.js');
  expect(SRC).not.toMatch(/\bstatSync\b/);
});
