/**
 * Class-pinning test for the dead-public-surface class (#1123–#1135 same shape)
 * on the parts of FFRSystem.js this round owns.
 *
 * setDynamicFFR(gpuLoad) has zero call sites in src/ and tests/ — the render
 * loop drives foveation through trackHeadPose → updatePredictedGazeFoveation →
 * adjustIntensity instead. The trailing Usage Example additionally prescribes
 * `performanceMonitor.getGPULoad()`, a method that exists nowhere.
 * (gpuLoadThresholds/setThresholds are a separate dead pair owned by PR #1123.)
 *
 * Pinned: the dead method and the phantom doc call stay gone.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../src/vr/rendering/FFRSystem.js');

describe('FFRSystem dead surface', () => {
  const src = fs.readFileSync(FILE, 'utf8');

  test('no setDynamicFFR method or reference survives', () => {
    expect(/setDynamicFFR/.test(src)).toBe(false);
  });

  test('no comment/example prescribes the non-existent getGPULoad()', () => {
    expect(/getGPULoad/.test(src)).toBe(false);
  });

  test('live surface remains defined: initialize, enable, disable, trackHeadPose, updatePredictedGazeFoveation, adjustIntensity, dispose', () => {
    for (const name of [
      'initialize',
      'enable',
      'disable',
      'trackHeadPose',
      'updatePredictedGazeFoveation',
      'adjustIntensity',
      'dispose'
    ]) {
      expect(src).toMatch(new RegExp(`^ {2}(?:async )?${name}\\s*\\(`, 'm'));
    }
  });
});
