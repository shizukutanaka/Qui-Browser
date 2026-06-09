/**
 * Unit tests for curvedPlaneData (Quest-style curved browser panel).
 * Pure maths — no THREE / WebGL needed.
 */

const { curvedPlaneData, buildCurvedPlaneGeometry } = require('../src/vr/browser/curvedGeometry.js');

describe('curvedPlaneData', () => {
  const base = { width: 1.6, height: 1.0, radius: 2.2, segmentsX: 24, segmentsY: 1 };

  test('produces (segmentsX+1)*(segmentsY+1) vertices', () => {
    const { positions, uvs } = curvedPlaneData(base);
    const verts = (base.segmentsX + 1) * (base.segmentsY + 1);
    expect(positions.length).toBe(verts * 3);
    expect(uvs.length).toBe(verts * 2);
  });

  test('produces 6 indices per quad', () => {
    const { indices } = curvedPlaneData(base);
    expect(indices.length).toBe(base.segmentsX * base.segmentsY * 6);
  });

  test('centre column sits at z=0 (no displacement)', () => {
    // Odd-symmetric: with 24 segments the centre column index is 12.
    const { positions } = curvedPlaneData(base);
    const cols = base.segmentsX + 1;
    const centre = Math.floor(cols / 2); // 12
    const z = positions[centre * 3 + 2];
    const x = positions[centre * 3 + 0];
    expect(x).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  test('edge columns curve toward the viewer (+z) and outward in x', () => {
    const { positions } = curvedPlaneData(base);
    const cols = base.segmentsX + 1;
    // Right edge is the last column of the first (bottom) row.
    const right = cols - 1;
    const xr = positions[right * 3 + 0];
    const zr = positions[right * 3 + 2];
    expect(xr).toBeGreaterThan(0);   // bends toward +x
    expect(zr).toBeGreaterThan(0);   // wraps toward the viewer (+z)

    // Left edge mirrors the right edge.
    const xl = positions[0];
    const zl = positions[2];
    expect(xl).toBeCloseTo(-xr, 5);
    expect(zl).toBeCloseTo(zr, 5);
  });

  test('a larger radius produces a flatter curve (less z displacement)', () => {
    const tight = curvedPlaneData({ ...base, radius: 1.0 });
    const wide  = curvedPlaneData({ ...base, radius: 8.0 });
    const cols = base.segmentsX + 1;
    const edge = cols - 1;
    const zTight = tight.positions[edge * 3 + 2];
    const zWide  = wide.positions[edge * 3 + 2];
    expect(zWide).toBeLessThan(zTight);
  });

  test('arc spans the requested width (chord ≤ width, arc length ≈ width)', () => {
    const { positions } = curvedPlaneData(base);
    const cols = base.segmentsX + 1;
    const xl = positions[0];
    const xr = positions[(cols - 1) * 3];
    const chord = xr - xl;
    // The straight chord of a bent strip is slightly shorter than the arc.
    expect(chord).toBeLessThanOrEqual(base.width + 1e-6);
    expect(chord).toBeGreaterThan(base.width * 0.95); // mild curve, close to flat
  });

  test('UVs span the full 0..1 range', () => {
    const { uvs } = curvedPlaneData(base);
    expect(uvs[0]).toBeCloseTo(0, 5);       // first u
    expect(uvs[1]).toBeCloseTo(0, 5);       // first v
    const last = uvs.length;
    expect(uvs[last - 2]).toBeCloseTo(1, 5); // last u
    expect(uvs[last - 1]).toBeCloseTo(1, 5); // last v
  });

  test('top row is higher than bottom row', () => {
    const data = curvedPlaneData({ ...base, segmentsY: 2 });
    const cols = base.segmentsX + 1;
    const bottomY = data.positions[1];               // row 0, col 0, y
    const topY = data.positions[(2 * cols) * 3 + 1]; // row 2, col 0, y
    expect(topY).toBeGreaterThan(bottomY);
    expect(topY).toBeCloseTo(base.height / 2, 5);
    expect(bottomY).toBeCloseTo(-base.height / 2, 5);
  });

  test('handles degenerate segment counts without throwing', () => {
    expect(() => curvedPlaneData({ ...base, segmentsX: 0, segmentsY: 0 })).not.toThrow();
  });
});

describe('buildCurvedPlaneGeometry', () => {
  // Minimal THREE stub capturing attribute wiring.
  const THREE = {
    BufferGeometry: class {
      constructor() { this._attrs = {}; this._index = null; }
      setAttribute(name, attr) { this._attrs[name] = attr; }
      setIndex(attr) { this._index = attr; }
      computeVertexNormals() { this._normals = true; }
    },
    BufferAttribute: class { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
  };

  test('wires position, uv attributes and an index buffer', () => {
    const geo = buildCurvedPlaneGeometry(THREE, { width: 1.6, height: 1, radius: 2.2 });
    expect(geo._attrs.position.itemSize).toBe(3);
    expect(geo._attrs.uv.itemSize).toBe(2);
    expect(geo._index.itemSize).toBe(1);
    expect(geo._normals).toBe(true);
  });
});
