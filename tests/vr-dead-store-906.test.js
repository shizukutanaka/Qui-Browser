/**
 * Round 906 dead-store pin: fields that are assigned but never read anywhere
 * in src/ are indistinguishable from live state — removing them is
 * behaviour-preserving (same class as #1128/#1129/#1192).
 *
 * - FFRSystem.gpuLoadThresholds: constructor fills a {high,medium,low} map
 *   whose only readers (setThresholds/getGPULoad) were removed with #1123;
 *   nothing in src/ consults it — an orphaned tuning knob that suggests
 *   automatic GPU-load foveation that does not exist.
 * - PerformanceMonitor.lastFrameTime: written at init and on every endFrame
 *   but never read — frame time is consumed through stats/frameCount.
 */
import { FFRSystem } from '../src/vr/rendering/FFRSystem.js';
import { PerformanceMonitor } from '../src/utils/PerformanceMonitor.js';
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const FFR_SRC = fs.readFileSync(path.join(ROOT, 'src', 'vr', 'rendering', 'FFRSystem.js'), 'utf8');
const PM_SRC = fs.readFileSync(path.join(ROOT, 'src', 'utils', 'PerformanceMonitor.js'), 'utf8');

describe('FFRSystem threshold surface', () => {
  test('exposes no gpuLoadThresholds — the dead reader pair was removed at #1123', () => {
    const ffr = new FFRSystem();
    expect('gpuLoadThresholds' in ffr).toBe(false);
  });
  test('source has no gpuLoadThresholds assignment left', () => {
    expect(FFR_SRC).not.toMatch(/this\.gpuLoadThresholds\s*=/);
  });
});

describe('PerformanceMonitor frame-timing surface', () => {
  test('exposes no lastFrameTime — frame time lives in stats/frameCount', () => {
    const pm = new PerformanceMonitor();
    expect('lastFrameTime' in pm).toBe(false);
    expect(pm.frameStartTime).toBe(0);
  });
  test('source has no lastFrameTime assignment left', () => {
    expect(PM_SRC).not.toMatch(/this\.lastFrameTime\s*=/);
  });
});
