// Round-919 invariant: a private method must not declare a parameter its body
// never reads. `updateSystems` accepted `timestamp` from the render loop yet
// derived every clock value from `performance.now()` — the signature lied
// about needing the rAF timestamp (same class as the `anchor` dead param).
import { readFileSync } from 'fs';
import { join } from 'path';

const VRAPP = join(__dirname, '..', 'src', 'vr', 'VRApp.js');
const src = readFileSync(VRAPP, 'utf8');

describe('dead-parameter honesty: VRApp.updateSystems', () => {
  test('signature declares only the params the body consumes (xrFrame, dt)', () => {
    expect(src).toMatch(/updateSystems\(xrFrame,\s*dt\s*=\s*0\.016\)\s*\{/);
    expect(src).not.toMatch(/updateSystems\(timestamp/);
  });

  test('the render loop call site does not forward the unused timestamp', () => {
    expect(src).not.toMatch(/updateSystems\(timestamp/);
    expect(src).toMatch(/this\.updateSystems\(xrFrame,\s*dt\)/);
  });

  test('render() keeps its (timestamp, xrFrame) callback contract', () => {
    // render() is the setAnimationLoop callback — the runtime calls it with
    // (time, frame), so the signature must keep the rAF contract even though
    // dt is derived from performance.now() for a single shared clock.
    expect(src).toMatch(/render\(timestamp,\s*xrFrame\)\s*\{/);
  });
});
