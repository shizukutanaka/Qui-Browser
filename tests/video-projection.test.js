/**
 * Unit tests for the immersive-video projection maths.
 * Pure maths — no THREE / WebGL / DOM needed (the runtime ImmersiveVideo class
 * that consumes these helpers is exercised separately/in-VR).
 */

const {
  sphereParams,
  eyeUVTransform,
  detectVideoFormat,
  buildVideoSphereGeometry
} = require('../src/vr/media/videoProjection.js');

describe('sphereParams', () => {
  test('360 spans the full sphere', () => {
    const p = sphereParams('360');
    expect(p.phiStart).toBeCloseTo(0, 6);
    expect(p.phiLength).toBeCloseTo(Math.PI * 2, 6);
    expect(p.thetaStart).toBeCloseTo(0, 6);
    expect(p.thetaLength).toBeCloseTo(Math.PI, 6);
  });

  test('180 spans a front hemisphere centred on −z', () => {
    const p = sphereParams('180');
    expect(p.phiLength).toBeCloseTo(Math.PI, 6); // half the horizontal sweep
    expect(p.phiStart).toBeCloseTo(Math.PI / 2, 6); // centred forward
    expect(p.thetaLength).toBeCloseTo(Math.PI, 6); // still pole-to-pole
  });

  test('defaults to 360 for unknown projection', () => {
    expect(sphereParams().phiLength).toBeCloseTo(Math.PI * 2, 6);
    expect(sphereParams('weird').phiLength).toBeCloseTo(Math.PI * 2, 6);
  });
});

describe('eyeUVTransform', () => {
  test('mono returns the full frame for either eye', () => {
    for (const eye of ['left', 'right']) {
      expect(eyeUVTransform('mono', eye)).toEqual({ offset: [0, 0], repeat: [1, 1] });
    }
  });

  test('top-bottom crops left=top, right=bottom', () => {
    expect(eyeUVTransform('stereo-tb', 'left')).toEqual({ offset: [0, 0.5], repeat: [1, 0.5] });
    expect(eyeUVTransform('stereo-tb', 'right')).toEqual({ offset: [0, 0], repeat: [1, 0.5] });
  });

  test('side-by-side crops left=left half, right=right half', () => {
    expect(eyeUVTransform('stereo-sbs', 'left')).toEqual({ offset: [0, 0], repeat: [0.5, 1] });
    expect(eyeUVTransform('stereo-sbs', 'right')).toEqual({ offset: [0.5, 0], repeat: [0.5, 1] });
  });

  test('each eye sees a non-overlapping half of a stereo frame', () => {
    // TB: vertical offsets differ by exactly the repeat height.
    const lt = eyeUVTransform('stereo-tb', 'left');
    const rt = eyeUVTransform('stereo-tb', 'right');
    expect(Math.abs(lt.offset[1] - rt.offset[1])).toBeCloseTo(lt.repeat[1], 6);
    // SBS: horizontal offsets differ by exactly the repeat width.
    const ls = eyeUVTransform('stereo-sbs', 'left');
    const rs = eyeUVTransform('stereo-sbs', 'right');
    expect(Math.abs(ls.offset[0] - rs.offset[0])).toBeCloseTo(ls.repeat[0], 6);
  });

  test('unknown layout falls back to mono', () => {
    expect(eyeUVTransform('nope', 'left')).toEqual({ offset: [0, 0], repeat: [1, 1] });
  });
});

describe('detectVideoFormat', () => {
  test('defaults to mono 360 when there are no hints', () => {
    expect(detectVideoFormat('https://cdn.example.com/clip.mp4')).toEqual({ projection: '360', layout: 'mono' });
    expect(detectVideoFormat('')).toEqual({ projection: '360', layout: 'mono' });
  });

  test('detects 180 projection', () => {
    expect(detectVideoFormat('beach_180.mp4').projection).toBe('180');
    expect(detectVideoFormat('VR180-clip.webm').projection).toBe('180');
  });

  test('does not mistake numbers like 1800 or 360p resolution for projection', () => {
    expect(detectVideoFormat('clip_1800kbps.mp4').projection).toBe('360');
  });

  test('detects side-by-side layout', () => {
    expect(detectVideoFormat('movie_360_sbs.mp4').layout).toBe('stereo-sbs');
    expect(detectVideoFormat('movie-180-LR.mp4').layout).toBe('stereo-sbs');
  });

  test('detects top-bottom layout', () => {
    expect(detectVideoFormat('movie_360_tb.mp4').layout).toBe('stereo-tb');
    expect(detectVideoFormat('movie_over-under.mp4').layout).toBe('stereo-tb');
  });

  test('combines projection and layout', () => {
    expect(detectVideoFormat('vid_180_sbs.webm')).toEqual({ projection: '180', layout: 'stereo-sbs' });
  });
});

describe('buildVideoSphereGeometry', () => {
  // Minimal THREE stub capturing SphereGeometry constructor args.
  const THREE = {
    SphereGeometry: class {
      constructor(radius, wSeg, hSeg, phiStart, phiLength, thetaStart, thetaLength) {
        this.parameters = { radius, wSeg, hSeg, phiStart, phiLength, thetaStart, thetaLength };
      }
    }
  };

  test('passes 360 extents and defaults to radius 200', () => {
    const geo = buildVideoSphereGeometry(THREE, {});
    expect(geo.parameters.radius).toBe(200);
    expect(geo.parameters.phiLength).toBeCloseTo(Math.PI * 2, 6);
    expect(geo.parameters.thetaLength).toBeCloseTo(Math.PI, 6);
  });

  test('passes 180 extents and a custom radius', () => {
    const geo = buildVideoSphereGeometry(THREE, { projection: '180', radius: 50 });
    expect(geo.parameters.radius).toBe(50);
    expect(geo.parameters.phiLength).toBeCloseTo(Math.PI, 6);
  });
});
