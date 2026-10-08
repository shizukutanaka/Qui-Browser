/**
 * Invariant: constructor signatures only declare dependencies the class
 * actually uses — no write-only stores of injected deps.
 *
 * Defect pinned by this file:
 *   ComfortSystem stored `this.scene` + `this.renderer` from ctor params that
 *   nothing ever read — the consumer was the post-process vignette removed in
 *   #1098 when the overlay moved onto the camera. HandTracking stored
 *   `this.renderer` since inception with zero readers (`this.scene` is the
 *   live one — it parents the hand groups). The signatures lied about needing
 *   dependencies the classes never touch.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COMFORT = path.join(ROOT, 'src', 'vr', 'comfort', 'ComfortSystem.js');
const HAND = path.join(ROOT, 'src', 'vr', 'interaction', 'HandTracking.js');

const comfortSource = fs.readFileSync(COMFORT, 'utf8');
const handSource = fs.readFileSync(HAND, 'utf8');

const { ComfortSystem } = require('../src/vr/comfort/ComfortSystem.js');
const { HandTracking } = require('../src/vr/interaction/HandTracking.js');

const makeScene = () => ({
  add: jest.fn(),
  remove: jest.fn()
});
const makeCamera = (fov = 90) => ({
  fov,
  position: { x: 0, y: 0, z: 0, distanceTo: () => 0 },
  rotation: { y: 0 },
  updateProjectionMatrix: jest.fn()
});

describe('constructor signatures only declare used dependencies', () => {
  test('ComfortSystem no longer asks for scene/renderer', () => {
    expect(comfortSource).toMatch(/constructor\(camera\b/);
    expect(comfortSource).not.toContain('this.scene = scene');
    expect(comfortSource).not.toContain('this.renderer = renderer');
  });

  test('HandTracking no longer asks for renderer', () => {
    expect(handSource).toMatch(/constructor\(scene\b/);
    expect(handSource).not.toContain('this.renderer = renderer');
  });

  test('dead stores stay absent on constructed instances', () => {
    const cs = new ComfortSystem(makeCamera());
    expect(cs.scene).toBeUndefined();
    expect(cs.renderer).toBeUndefined();
    const ht = new HandTracking(makeScene());
    expect(ht.renderer).toBeUndefined();
    expect(ht.scene).toBeDefined();
  });

  test('live deps still reachable through the lean signatures', () => {
    const cam = makeCamera();
    const cs = new ComfortSystem(cam);
    expect(cs.camera).toBe(cam);
    const scene = makeScene();
    const ht = new HandTracking(scene);
    expect(ht.scene).toBe(scene);
  });
});
