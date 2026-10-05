/**
 * The texture-compression pipeline was dead configuration end to end:
 *
 * - `settings.enableTextureCompression` was declared in the defaults (so it
 *   persisted via the loadPersistedSettings whitelist) and read once — the
 *   construction gate in initializeSystems — but no path in the product
 *   could write it: no settings row, no voice toggle, no URL param.
 * - `VRApp.loadTexture` was the pipeline's only consumer and had zero call
 *   sites (referenced only by its own JSDoc).
 * - `ProgressiveLoader.loadTexture` delegated to `window.textureManager`,
 *   a global VRApp never assigned — the branch could never fire.
 *
 * The key, the gate, the field, the wrapper method, the stats/dispose
 * blocks and the dead delegation were removed; TextureManager.js and its
 * test file went with them (the module is now unreferenced).
 *
 * These tests pin the surviving contracts: no stray API surface remains,
 * stats don't consult a foreign manager, and the progressive loader never
 * hands a load to a global that doesn't exist.
 */
import * as THREE from 'three';

jest.mock('three/examples/jsm/webxr/VRButton.js', () => ({
  VRButton: { createButton: () => ({}) }
}));
jest.mock('three/examples/jsm/webxr/XRControllerModelFactory.js', () => ({
  XRControllerModelFactory: class {
    createControllerModel() {
      return {};
    }
  }
}));

import { VRApp } from '../src/vr/VRApp.js';
import { ProgressiveLoader } from '../src/utils/ProgressiveLoader.js';

describe('dead texture pipeline removed', () => {
  test('VRApp no longer exposes the uncalled loadTexture wrapper', () => {
    expect(VRApp.prototype.loadTexture).toBeUndefined();
  });

  test('getPerformanceStats ignores a foreign textureManager', () => {
    const app = Object.create(VRApp.prototype);
    app.renderer = {
      info: { memory: { geometries: 0, textures: 0 }, programs: [] }
    };
    app.performanceMonitor = {
      fps: 90,
      frameTime: 11.1,
      memoryUsed: 42,
      drawCalls: 5,
      triangles: 1000
    };
    app.ffrSystem = null;
    app.textureManager = {
      getMemoryStats: () => ({ usedMB: 1, maxMB: 2, compressionRatio: 0.5 })
    };
    const stats = app.getPerformanceStats();
    expect(stats.textureMemory).toBeUndefined();
    expect(stats.textureCompression).toBeUndefined();
  });

  test('ProgressiveLoader never delegates to a foreign window.textureManager', async () => {
    const delegated = jest.fn(async () => new THREE.Texture());
    global.window = { textureManager: { loadTexture: delegated } };
    try {
      const loader = new ProgressiveLoader();
      loader.loadImage = jest.fn(async () => new THREE.Texture());
      await loader.loadTexture('assets/x.png');
      expect(delegated).not.toHaveBeenCalled();
      expect(loader.loadImage).toHaveBeenCalledWith('assets/x.png');
    } finally {
      delete global.window;
    }
  });
});
