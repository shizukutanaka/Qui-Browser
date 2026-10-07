/**
 * Round 975 invariant pins — ComfortSystem must not carry the dead snap-turn
 * animation surface (handleSnapTurn / animateSnapTurn / settings.snapTurn /
 * the reduceMotion option that only gated that animation).
 *
 * The live snap path is VRApp.snapTurn(): an instantaneous playerRig rotation
 * (src/vr/VRApp.js), deliberately animation-free regardless of
 * prefers-reduced-motion. ComfortSystem's parallel pathway had zero callers —
 * and its self-arming requestAnimationFrame loop was untracked (uncancellable,
 * a ghost write into camera.rotation.y on dispose, and a stale-target race on
 * concurrent snaps).
 */

const fs = require('fs');
const path = require('path');

class MockVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  distanceTo(v) {
    return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2);
  }
}
class MockShaderMaterial {
  constructor(opts) {
    Object.assign(this, opts || {});
    this.uniforms = opts ? opts.uniforms || {} : {};
    this.dispose = jest.fn();
  }
}
class MockMesh {
  constructor() {
    this.renderOrder = 0;
    this.frustumCulled = false;
    this.visible = true;
    this.position = { set: jest.fn() };
    this.geometry = { dispose: jest.fn() };
    this.material = { dispose: jest.fn() };
  }
}

jest.mock('three', () => ({
  Vector3: MockVector3,
  PlaneGeometry: class {
    dispose() {}
  },
  ShaderMaterial: MockShaderMaterial,
  Mesh: MockMesh,
  OrthographicCamera: class {},
  Scene: class {},
  WebGLRenderTarget: class {
    dispose() {}
  },
  MathUtils: {
    lerp: (a, b, t) => a + (b - a) * t,
    degToRad: (d) => (d * Math.PI) / 180
  }
}));

const { ComfortSystem, snapTurnLabel } = require('../src/vr/comfort/ComfortSystem.js');

const COMFORT_SRC = fs.readFileSync(path.join(__dirname, '../src/vr/comfort/ComfortSystem.js'), 'utf8');
const VRAPP_SRC = fs.readFileSync(path.join(__dirname, '../src/vr/VRApp.js'), 'utf8');

function makeCamera(fov = 90) {
  return {
    fov,
    position: new MockVector3(),
    rotation: { y: 0 },
    children: [],
    add(obj) {
      this.children.push(obj);
    },
    remove(obj) {
      const i = this.children.indexOf(obj);
      if (i !== -1) {
        this.children.splice(i, 1);
      }
    },
    updateProjectionMatrix: jest.fn()
  };
}

describe('dead snap-turn surface is gone', () => {
  test('prototype exposes no snap-turn methods', () => {
    expect(ComfortSystem.prototype.handleSnapTurn).toBeUndefined();
    expect(ComfortSystem.prototype.animateSnapTurn).toBeUndefined();
  });

  test('reduceMotion store/setter is gone — its only consumer was the animation', () => {
    expect(ComfortSystem.prototype.setReducedMotion).toBeUndefined();
    const cs = new ComfortSystem(makeCamera(), { reduceMotion: true });
    expect(cs.reduceMotion).toBeUndefined();
  });

  test('settings carry no snapTurn branch, before or after any preset', () => {
    const cs = new ComfortSystem(makeCamera());
    expect(cs.settings.snapTurn).toBeUndefined();
    for (const p of ['sensitive', 'moderate', 'tolerant', 'disabled']) {
      cs.setPreset(p);
      expect(cs.settings.snapTurn).toBeUndefined();
    }
  });

  test('source holds no snap-turn animation or self-arming rAF', () => {
    expect(COMFORT_SRC).not.toMatch(/requestAnimationFrame/);
    expect(COMFORT_SRC).not.toMatch(/handleSnapTurn/);
    expect(COMFORT_SRC).not.toMatch(/animateSnapTurn/);
    expect(COMFORT_SRC).not.toMatch(/setReducedMotion/);
    expect(COMFORT_SRC).not.toMatch(/snapTurn:\s*\{/);
    expect(COMFORT_SRC).not.toMatch(/this\.reduceMotion/);
  });

  test('VRApp no longer feeds ComfortSystem a reduceMotion signal', () => {
    expect(VRAPP_SRC).not.toMatch(/comfortSystem\.setReducedMotion/);
    expect(VRAPP_SRC).not.toMatch(/new ComfortSystem\(this\.camera,\s*\{\s*reduceMotion/);
  });
});

describe('live snap-turn surface stays intact', () => {
  test('snapTurnLabel still exported for the caption announce path', () => {
    expect(typeof snapTurnLabel).toBe('function');
    expect(snapTurnLabel(1, 30)).toBeTruthy();
    expect(snapTurnLabel(-1, 30)).toBeTruthy();
  });

  test('the production snap path is the instant playerRig rotation', () => {
    expect(VRAPP_SRC).toMatch(/snapTurn\(direction,\s*hand/);
    expect(VRAPP_SRC).toMatch(/this\.settings\.enableSnapTurn/);
  });

  test('comfort presets still drive vignette + FOV', () => {
    const cs = new ComfortSystem(makeCamera());
    cs.setPreset('sensitive');
    expect(cs.settings.vignette.enabled).toBe(true);
    expect(cs.settings.fov.enabled).toBe(true);
    expect(cs.settings.vignette.intensity).toBeCloseTo(0.8, 5);
    cs.setPreset('disabled');
    expect(cs.settings.vignette.enabled).toBe(false);
    expect(cs.settings.fov.enabled).toBe(false);
  });
});
