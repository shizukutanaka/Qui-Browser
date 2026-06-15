/**
 * Lifecycle tests for ImmersiveVideo (the 360°/180° runtime class). THREE and
 * the DOM (video + canvas) are mocked so play()/stop() can be exercised
 * headlessly. The pure projection maths is covered in video-projection.test.js.
 *
 * The headline assertion is the resource-disposal contract: every GPU object a
 * play() allocates — sphere geometry/material, video textures, AND the HUD
 * button geometry/material/textures — must be released by stop(), so opening
 * and closing the player repeatedly (the expected general-user flow) doesn't
 * leak.
 */

// ── THREE mock ────────────────────────────────────────────────────────────────
// Stub classes register themselves so the test can assert every allocated
// disposable was released. A registry is exposed on the mocked module (rather
// than an outer variable) to satisfy jest's mock-factory hoisting rules.
jest.mock('three', () => {
  const registry = { disposables: [] };

  class V3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  }
  class Disp {
    constructor() { this.disposed = false; registry.disposables.push(this); }
    dispose() { this.disposed = true; }
  }
  class SphereGeometry extends Disp {
    constructor(...args) { super(); this.args = args; }
    scale() { return this; }
  }
  class PlaneGeometry extends Disp {
    constructor(w, h) { super(); this.w = w; this.h = h; }
  }
  class MeshBasicMaterial extends Disp {
    constructor(opts) { super(); this.opts = opts; }
  }
  class VideoTexture extends Disp {
    constructor(video) {
      super();
      this.video = video;
      this.colorSpace = null;
      this.offset = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
      this.repeat = { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } };
    }
  }
  class CanvasTexture extends Disp {
    constructor() { super(); this.needsUpdate = false; this.colorSpace = null; }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry;
      this.material = material;
      this.position = new V3();
      this.userData = {};
      this.frustumCulled = true;
      this.layers = { set() {}, enable() {} };
    }
  }
  class Group {
    constructor() {
      this.name = '';
      this.children = [];
      this.parent = null;
      this.position = { set() {} };
    }
    add(...objs) { for (const o of objs) this.children.push(o); }
    remove(o) { this.children = this.children.filter((x) => x !== o); }
  }

  return {
    __registry: registry,
    Vector3: V3,
    SphereGeometry,
    PlaneGeometry,
    MeshBasicMaterial,
    VideoTexture,
    CanvasTexture,
    Mesh,
    Group,
    SRGBColorSpace: 'srgb'
  };
});

// ── DOM mock (video + canvas) ──────────────────────────────────────────────────
// Plain functions (not jest.fn) so jest.config resetMocks:true doesn't wipe them.
const ctxStub = {
  fillRect() {}, fillText() {}, strokeRect() {}, clearRect() {},
  set fillStyle(v) {}, set strokeStyle(v) {},
  set font(v) {}, set textAlign(v) {}, set lineWidth(v) {}
};
// When true, the next created <video>'s play() models a browser Autoplay Policy
// rejection: the promise rejects and no 'playing' event fires (so the element
// stays paused). Reset per-test in beforeEach.
let nextVideoAutoplayBlocked = false;
function makeVideoEl() {
  return {
    crossOrigin: '', loop: false, playsInline: false, preload: '', src: '', paused: true,
    _listeners: {},
    setAttribute() {}, removeAttribute() { this.src = ''; },
    play() {
      if (nextVideoAutoplayBlocked) {
        // Stays paused; mirrors a rejected play() promise with no 'playing' event.
        return { catch(cb) { cb(new Error('NotAllowedError')); return this; } };
      }
      // A real <video> fires 'playing' once playback actually starts.
      this.paused = false;
      this._emit('playing');
      return { catch() {} };
    },
    pause() { this.paused = true; },
    load() {},
    addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
      this._listeners[type] = (this._listeners[type] || []).filter((f) => f !== fn);
    },
    // Test helper: invoke every handler registered for `type`.
    _emit(type) { for (const fn of this._listeners[type] || []) fn(); }
  };
}
global.document = global.document || {};
global.document.createElement = (tag) =>
  tag === 'video' ? makeVideoEl() : { width: 0, height: 0, getContext: () => ctxStub };

const THREE = require('three');
const { ImmersiveVideo } = require('../src/vr/media/ImmersiveVideo.js');

// ── Fixtures ───────────────────────────────────────────────────────────────────
function makeCamera() {
  return {
    layers: { enable() {}, set() {} },
    children: [],
    add(o) { o.parent = this; this.children.push(o); },
    remove(o) { this.children = this.children.filter((x) => x !== o); },
    getWorldPosition(v) { v.set(1, 2, 3); return v; }
  };
}
function makeHarness() {
  const scene = {
    children: [],
    add(o) { scene.children.push(o); },
    remove(o) { scene.children = scene.children.filter((x) => x !== o); }
  };
  const camera = makeCamera();
  const register = jest.fn();
  const unregister = jest.fn();
  const onError = jest.fn();
  const iv = new ImmersiveVideo(scene, camera, {}, {
    registerInteractable: register,
    unregisterInteractable: unregister,
    onError
  });
  return { iv, scene, camera, register, unregister, onError };
}

beforeEach(() => {
  THREE.__registry.disposables.length = 0;
  nextVideoAutoplayBlocked = false;
});

describe('ImmersiveVideo lifecycle', () => {
  test('play(mono) adds one sphere and a HUD parented to the camera', () => {
    const { iv, scene, camera, register } = makeHarness();
    iv.play('https://cdn.example.com/clip.mp4');

    expect(iv.active).toBe(true);
    expect(scene.children).toHaveLength(1);   // one sphere
    expect(camera.children).toHaveLength(1);  // HUD group
    expect(camera.children[0].children).toHaveLength(2); // Pause + Exit
    expect(register).toHaveBeenCalledTimes(2);
    expect(iv.playing).toBe(true);
  });

  test('stereo side-by-side URL builds a sphere per eye with cropped UVs', () => {
    const { iv, scene } = makeHarness();
    iv.play('https://cdn.example.com/beach_360_sbs.mp4');

    expect(scene.children).toHaveLength(2);
    // Two distinct VideoTextures, each cropped to half the frame width.
    const texes = THREE.__registry.disposables.filter((d) => d.video);
    expect(texes).toHaveLength(2);
    expect(texes.every((t) => t.repeat.x === 0.5)).toBe(true);
  });

  test('stop() releases EVERY allocated GPU resource (no leak)', () => {
    const { iv, scene, camera, unregister } = makeHarness();
    iv.play('https://cdn.example.com/clip.mp4');

    const allocated = THREE.__registry.disposables.slice();
    expect(allocated.length).toBeGreaterThan(0);

    iv.stop();

    // Scene + HUD detached, interactables unregistered…
    expect(scene.children).toHaveLength(0);
    expect(camera.children).toHaveLength(0);
    expect(unregister).toHaveBeenCalledTimes(2);
    expect(iv.active).toBe(false);
    expect(iv.playing).toBe(false);

    // …and crucially every disposable — including the HUD button geometry and
    // material that the leak fix now disposes — was released exactly once.
    for (const d of allocated) expect(d.disposed).toBe(true);
  });

  test('play() replaces a previous video, disposing the old resources', () => {
    const { iv, scene } = makeHarness();
    iv.play('https://cdn.example.com/first.mp4');
    const first = THREE.__registry.disposables.slice();

    iv.play('https://cdn.example.com/second.mp4');

    for (const d of first) expect(d.disposed).toBe(true); // old set freed
    expect(scene.children).toHaveLength(1);               // only the new sphere
  });

  test('a video element "error" surfaces a message via onError', () => {
    const { iv, onError } = makeHarness();
    iv.play('https://cdn.example.com/broken.mp4');

    expect(onError).not.toHaveBeenCalled();
    iv.video._emit('error');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatch(/load video/i);
  });

  test('stop() removes the error listener (no report after teardown)', () => {
    const { iv, onError } = makeHarness();
    iv.play('https://cdn.example.com/clip.mp4');
    const video = iv.video; // captured before stop() nulls it

    iv.stop();
    video._emit('error');

    expect(onError).not.toHaveBeenCalled();
  });

  test('playing flips true only when playback actually starts', () => {
    const { iv } = makeHarness();
    iv.play('https://cdn.example.com/clip.mp4'); // mock play() emits 'playing'
    expect(iv.playing).toBe(true);
  });

  test('blocked autoplay leaves playing false until a real "playing" event', () => {
    nextVideoAutoplayBlocked = true;
    const { iv } = makeHarness();
    iv.play('https://cdn.example.com/clip.mp4');

    // Autoplay was rejected: the sphere exists but nothing is playing, so the
    // state must NOT lie (the visibilitychange guard reads iv.playing).
    expect(iv.active).toBe(true);
    expect(iv.playing).toBe(false);

    // A later gesture-driven play fires 'playing' and flips the state.
    iv.video._emit('playing');
    expect(iv.playing).toBe(true);
  });

  test('stop() removes the playing listener (no late state flip after teardown)', () => {
    const { iv } = makeHarness();
    nextVideoAutoplayBlocked = true;       // start paused so playing is false
    iv.play('https://cdn.example.com/clip.mp4');
    const video = iv.video;                // captured before stop() nulls it

    iv.stop();
    video._emit('playing');

    expect(iv.playing).toBe(false);
  });

  test('stop() is a safe no-op before any play()', () => {
    const { iv, scene } = makeHarness();
    expect(() => iv.stop()).not.toThrow();
    expect(iv.active).toBe(false);
    expect(iv.playing).toBe(false);
    expect(scene.children).toHaveLength(0);
  });

  test('togglePause() pauses then resumes the underlying video', () => {
    const { iv } = makeHarness();
    iv.play('https://cdn.example.com/clip.mp4');
    expect(iv.playing).toBe(true);

    iv.togglePause();                       // pause
    expect(iv.video.paused).toBe(true);
    expect(iv.playing).toBe(false);

    iv.togglePause();                       // resume
    expect(iv.video.paused).toBe(false);
    expect(iv.playing).toBe(true);
  });

  test('update() re-centres the sphere on the head each frame', () => {
    const { iv, scene } = makeHarness();
    iv.play('https://cdn.example.com/clip.mp4');
    iv.update();
    const sphere = scene.children[0];
    expect([sphere.position.x, sphere.position.y, sphere.position.z]).toEqual([1, 2, 3]);
  });
});
