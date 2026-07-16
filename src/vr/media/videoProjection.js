/**
 * Projection maths for immersive (360°/180°) video spheres.
 *
 * A 360° video is rendered by mapping an equirectangular frame onto the inside
 * of a sphere centred on the viewer. The maths here is intentionally THREE- and
 * DOM-free so it can be unit-tested without a WebGL context — `ImmersiveVideo`
 * (the runtime class) consumes these helpers and `buildVideoSphereGeometry`
 * wraps them into a THREE.SphereGeometry. This mirrors the
 * `curvedGeometry.js` split (pure data + `build…Geometry(THREE, opts)` wrapper).
 */

/**
 * Sphere angular extents for a given projection, as the trailing arguments of
 * THREE.SphereGeometry(radius, wSeg, hSeg, phiStart, phiLength, thetaStart,
 * thetaLength).
 *
 * - '360' (equirectangular): a full sphere — the frame wraps all the way round.
 * - '180' (front hemisphere): a half sphere centred on −z (the default forward
 *   view direction in three.js), so a 180° capture sits in front of the viewer.
 *
 * @param {string} projection  '360' | '180'
 * @returns {{phiStart:number, phiLength:number, thetaStart:number, thetaLength:number}}
 */
export function sphereParams(projection = '360') {
  const thetaStart = 0;
  const thetaLength = Math.PI; // full vertical sweep (pole to pole) either way
  if (projection === '180') {
    // Half sweep around y, centred on −z so it faces the viewer.
    return { phiStart: Math.PI / 2, phiLength: Math.PI, thetaStart, thetaLength };
  }
  // Default: full 360° equirectangular.
  return { phiStart: 0, phiLength: Math.PI * 2, thetaStart, thetaLength };
}

/**
 * Texture offset/repeat that crops one eye's half out of a packed stereoscopic
 * frame. Returned as plain arrays so the maths stays THREE-free; the caller
 * applies them to `texture.offset`/`texture.repeat`.
 *
 * Conventions (THREE textures have flipY=true, so v=1 is the top of the image):
 * - 'stereo-tb'  (top-bottom / over-under): LEFT eye = top half, RIGHT = bottom.
 * - 'stereo-sbs' (side-by-side / left-right): LEFT eye = left half, RIGHT = right.
 * - 'mono': whole frame for both eyes.
 *
 * @param {string} layout  'mono' | 'stereo-tb' | 'stereo-sbs'
 * @param {string} eye     'left' | 'right'
 * @returns {{offset:[number,number], repeat:[number,number]}}
 */
export function eyeUVTransform(layout = 'mono', eye = 'left') {
  if (layout === 'stereo-tb') {
    return eye === 'left'
      ? { offset: [0, 0.5], repeat: [1, 0.5] } // top half
      : { offset: [0, 0], repeat: [1, 0.5] }; // bottom half
  }
  if (layout === 'stereo-sbs') {
    return eye === 'left'
      ? { offset: [0, 0], repeat: [0.5, 1] } // left half
      : { offset: [0.5, 0], repeat: [0.5, 1] }; // right half
  }
  // mono — full frame, eye-independent.
  return { offset: [0, 0], repeat: [1, 1] };
}

/**
 * Best-effort projection/layout detection from common filename conventions
 * (e.g. `clip_360_tb.mp4`, `beach-180-sbs.webm`). Unknown URLs fall back to the
 * safe baseline: mono equirectangular 360°.
 *
 * @param {string} url
 * @returns {{projection:string, layout:string}}
 */
export function detectVideoFormat(url = '') {
  const s = String(url).toLowerCase();

  const projection = /(^|[^0-9])180([^0-9]|$)/.test(s) ? '180' : '360';

  let layout = 'mono';
  if (/(_|-|\b)(sbs|lr)(_|-|\b)|side.?by.?side|left.?right/.test(s)) {
    layout = 'stereo-sbs';
  } else if (/(_|-|\b)(tb|ou)(_|-|\b)|top.?bottom|over.?under/.test(s)) {
    layout = 'stereo-tb';
  }

  return { projection, layout };
}

/**
 * Build a THREE.SphereGeometry sized for the given projection.
 *
 * @param {object} THREE — the three module (injected to avoid a hard import)
 * @param {object} opts
 * @param {number} [opts.radius=200]          — sphere radius in metres
 * @param {string} [opts.projection='360']    — see sphereParams
 * @param {number} [opts.widthSegments=64]
 * @param {number} [opts.heightSegments=32]
 * @returns {THREE.SphereGeometry}
 */
export function buildVideoSphereGeometry(THREE, opts = {}) {
  const { radius = 200, projection = '360', widthSegments = 64, heightSegments = 32 } = opts;
  const p = sphereParams(projection);
  return new THREE.SphereGeometry(
    radius,
    widthSegments,
    heightSegments,
    p.phiStart,
    p.phiLength,
    p.thetaStart,
    p.thetaLength
  );
}
