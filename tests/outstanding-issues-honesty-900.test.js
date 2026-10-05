import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const doc = readFileSync(join(__dirname, '../docs/OUTSTANDING_ISSUES.md'), 'utf8');

// Split the doc into sections; open (unresolved) items must reference
// files that actually exist — historical/session records may mention
// deleted files, but live todo entries must not prescribe work on them.
describe('OUTSTANDING_ISSUES.md open items reference real surfaces', () => {
  const openItems = ['### C-4', '### D-2', '### D-3'];

  test('no open item prescribes work on a deleted file', () => {
    const deletedPaths = [
      'src/vr/ar/MixedReality.js',
      'src/vr/rendering/WebGPURenderer.js',
      'src/vr/multiplayer/',
      'src/ai/AIRecommendation.js',
      'src/utils/ObjectPool.js',
      'src/utils/TextureManager.js'
    ];
    for (const p of deletedPaths) {
      expect(existsSync(join(__dirname, '..', p))).toBe(false);
    }
    for (const item of openItems) {
      const start = doc.indexOf(item);
      if (start === -1) continue;
      const end = doc.indexOf('###', start + 4);
      const section = doc.slice(start, end === -1 ? start + 3000 : end);
      // An open item may only mention a deleted file while acknowledging
      // it was deleted (i.e. it cannot silently prescribe new work on it).
      const mentionsDeleted = deletedPaths.filter((p) => section.includes(p));
      if (mentionsDeleted.length > 0) {
        expect(section).toMatch(/deleted|deleted in|resolved/i);
      }
    }
  });

  test('E-7 row is resolved — MixedReality was deleted in Session 74', () => {
    expect(doc).toMatch(/E-7.*MixedReality.*(deleted|resolved)/is);
  });

  test('files referenced by open B items still exist', () => {
    for (const p of [
      'src/utils/DeviceCompatibility.js',
      'src/vr/browser/curvedGeometry.js',
      'src/utils/ProgressiveLoader.js',
      'src/vr/browser/TabManager.js',
      'src/vr/browser/BookmarkPanel.js'
    ]) {
      expect(existsSync(join(__dirname, '..', p))).toBe(true);
    }
  });
});
