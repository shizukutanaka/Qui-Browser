import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const doc = readFileSync(join(__dirname, '../docs/ARCHITECTURE.md'), 'utf8');

describe('ARCHITECTURE.md module map matches src/', () => {
  // Every `vr/.../` row in the module map must be a real directory
  const rows = [...doc.matchAll(/\| `([^`]+)`\s*\|/g)].map((m) => m[1]);
  const dirRows = rows.filter((r) => r.endsWith('/'));
  for (const dir of dirRows) {
    test(`module-map directory exists: ${dir}`, () => {
      expect(existsSync(join(__dirname, '../src', dir))).toBe(true);
    });
  }

  test('no deleted modules listed as current', () => {
    for (const dead of [
      'vr/multiplayer',
      'vr/ar/',
      'vr/ai/',
      'ObjectPool',
      'TextureManager',
      'WebGPURenderer',
      'AIRecommendation',
      'AvatarSystem',
      'MultiplayerSystem',
      'MixedReality'
    ]) {
      expect(doc).not.toMatch(new RegExp(`\\b${dead}`));
    }
  });

  test('module map covers every real src/vr subdirectory', () => {
    const real = readdirSync(join(__dirname, '../src/vr'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `vr/${d.name}/`);
    for (const dir of real) {
      expect(doc).toContain(`\`${dir}\``);
    }
  });
});
