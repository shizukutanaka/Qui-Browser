/**
 * Curved panel geometry for in-VR browser windows.
 *
 * The Meta Quest Browser's most-requested ergonomics feature is a curved
 * screen: bending a large flat window into a gentle concave arc keeps every
 * point roughly equidistant from the eye, which improves readability and
 * reduces the keystone distortion of a flat plane viewed up close.
 *
 * `curvedPlaneData` bends a width×height plane around a vertical axis located
 * `radius` metres in front of the viewer (concave toward the user): the centre
 * column stays at z=0 and the side columns wrap toward the user (+z in the
 * panel's local space, where +z faces the viewer). Returns raw typed arrays so
 * the maths is testable without a WebGL context; `buildCurvedPlaneGeometry`
 * wraps them into a THREE.BufferGeometry.
 */

/**
 * Compute vertex positions / UVs / indices for a curved plane.
 *
 * @param {object} opts
 * @param {number} opts.width            — panel width in metres
 * @param {number} opts.height           — panel height in metres
 * @param {number} opts.radius           — curve radius (≈ viewing distance)
 * @param {number} [opts.segmentsX=24]   — horizontal subdivisions
 * @param {number} [opts.segmentsY=1]    — vertical subdivisions
 * @returns {{positions:Float32Array, uvs:Float32Array, indices:Uint16Array}}
 */
export function curvedPlaneData({ width, height, radius, segmentsX = 24, segmentsY = 1 }) {
  const sx = Math.max(1, Math.floor(segmentsX));
  const sy = Math.max(1, Math.floor(segmentsY));
  const cols = sx + 1;
  const rows = sy + 1;

  const positions = new Float32Array(cols * rows * 3);
  const uvs       = new Float32Array(cols * rows * 2);

  // Total subtended angle: arc length (width) / radius, centred on 0.
  const halfAngle = width / (2 * radius);

  let p = 0, u = 0;
  for (let r = 0; r < rows; r++) {
    const v  = r / sy;            // 0 (bottom) → 1 (top)
    const py = (v - 0.5) * height;
    for (let c = 0; c < cols; c++) {
      const hx = c / sx;          // 0 (left) → 1 (right)
      // Angle for this column, from -halfAngle to +halfAngle.
      const angle = (hx - 0.5) * 2 * halfAngle;
      positions[p++] = radius * Math.sin(angle);          // x
      positions[p++] = py;                                // y
      positions[p++] = radius * (1 - Math.cos(angle));    // z toward viewer
      uvs[u++] = hx;
      uvs[u++] = v;
    }
  }

  // Two triangles per quad.
  const indices = new Uint16Array(sx * sy * 6);
  let i = 0;
  for (let r = 0; r < sy; r++) {
    for (let c = 0; c < sx; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      // CCW winding so the concave (+z) face points at the viewer.
      indices[i++] = a; indices[i++] = d; indices[i++] = b;
      indices[i++] = b; indices[i++] = d; indices[i++] = e;
    }
  }

  return { positions, uvs, indices };
}

/**
 * Build a THREE.BufferGeometry for a curved plane.
 *
 * @param {object}  THREE — the three module (injected to avoid a hard import)
 * @param {object}  opts  — see curvedPlaneData
 * @returns {THREE.BufferGeometry}
 */
export function buildCurvedPlaneGeometry(THREE, opts) {
  const { positions, uvs, indices } = curvedPlaneData(opts);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  if (geo.computeVertexNormals) {
    geo.computeVertexNormals();
  }
  return geo;
}
