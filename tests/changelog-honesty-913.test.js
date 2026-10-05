/**
 * Round 913 — changelog / spatial-voice honesty invariants.
 *
 * CHANGELOG's [Unreleased] section is a LIVE document describing current main
 * (dated release sections are historical records and out of scope here).
 * Every feature flag, module name, and path it names must still exist — dead
 * names make the file promise surface that was removed.
 *
 * SpatialAudio's voice-peer surface (createVoiceSource / removeVoiceSource /
 * updateVoicePosition) had zero src consumers — only tests called it — and
 * its JSDoc pointed at a multiplayer/WebRTC pipeline that does not exist in
 * this repo. Both classes are pinned here.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const changelog = read('CHANGELOG.md');
const unreleased = changelog.slice(changelog.indexOf('## [Unreleased]'), changelog.indexOf('## [5.7.0]'));
const spatialAudio = read('src/vr/audio/SpatialAudio.js');
const spatialTests = read('tests/spatial-audio.test.js');

const srcText = fs
  .readdirSync(path.join(ROOT, 'src'), { recursive: true })
  .filter((f) => f.endsWith('.js'))
  .map((f) => read(path.join('src', f)))
  .join('\n');

describe('CHANGELOG [Unreleased] names only live surface', () => {
  test.each([
    'enableAI',
    'enableMultiplayer',
    'enablePerfMonitorUI',
    'enableWebGPU',
    'enableSettingsPanel',
    'MultiplayerSystem',
    'AIRecommendation',
    'TextureManager',
    'WebGPU',
    'multiplayer'
  ])('[Unreleased] does not name dead surface: %s', (name) => {
    expect(unreleased).not.toContain(name);
  });

  test.each(['enableVoice', 'DevTools', 'monitoring.js'])('[Unreleased] still credits live surface: %s', (name) => {
    expect(unreleased).toContain(name);
  });

  test('[Unreleased] does not point at absent paths', () => {
    expect(unreleased).not.toContain('tests/archive');
    expect(unreleased).not.toContain('`assets/icon.svg`');
    expect(unreleased).toContain('`public/assets/icon.svg`');
  });

  test('every `enableX` flag named in [Unreleased] has a consumer in src/', () => {
    const flags = [...new Set(unreleased.match(/enable[A-Z]\w*/g) || [])];
    const dead = flags.filter((f) => !srcText.includes(f));
    expect(dead).toEqual([]);
  });
});

describe('SpatialAudio has no voice-peer surface (no WebRTC/multiplayer exists)', () => {
  test.each(['createVoiceSource', 'removeVoiceSource', 'updateVoicePosition', 'isVoice', 'multiplayer', 'WebRTC'])(
    'SpatialAudio.js does not name dead surface: %s',
    (name) => {
      expect(spatialAudio).not.toContain(name);
    }
  );

  test('tests/spatial-audio.test.js no longer exercises the removed surface', () => {
    ['createVoiceSource', 'removeVoiceSource', 'updateVoicePosition'].forEach((name) =>
      expect(spatialTests).not.toContain(name)
    );
  });
});
