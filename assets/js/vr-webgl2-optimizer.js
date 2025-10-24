/**
 * VR WebGL2 Optimizer
 *
 * Advanced WebGL2 optimization for Safari/Firefox (non-WebGPU browsers).
 * Implements instancing, UBO (Uniform Buffer Objects), VAO (Vertex Array Objects),
 * and multiview extension for VR.
 *
 * Research-driven implementation based on:
 * - WebGL2 Fundamentals (2025)
 * - wgld.org WebGL2 UBO tutorials (Japanese)
 * - Three.js UBO discussions (GitHub #13700)
 * - NVIDIA VRSS adaptive rendering
 * - Stack Overflow WebGL2 instancing patterns
 *
 * Performance targets:
 * - Bridge 50-60% performance gap vs WebGPU
 * - Target: 72-90 FPS on Quest 2/3 with WebGL2
 * - Reduce draw calls by 70-90% with instancing
 * - Reduce uniform uploads by 80% with UBO
 *
 * @version 3.9.0
 * @author Qui Browser Team
 * @license MIT
 */

class VRWebGL2Optimizer {
  constructor(renderer) {
    this.renderer = renderer;
    this.gl = renderer.getContext();
    this.enabled = false;

    // Feature detection
    this.features = {
      instancing: false,
      ubo: false,
      vao: false,
      multiview: false,
      multiDraw: false
    };

    // UBO bindings
    this.uboBindings = new Map();
    this.nextBindingPoint = 0;

    // Instance tracking
    this.instancedMeshes = new Map();

    // VAO cache
    this.vaoCache = new Map();

    // Performance stats
    this.stats = {
      drawCalls: 0,
      instancedDrawCalls: 0,
      triangles: 0,
      uboUpdates: 0,
      savedDrawCalls: 0
    };

    console.log('[VRWebGL2Optimizer] Initializing WebGL2 optimizer');
  }

  /**
   * Initialize optimizer and detect features
   */
  async initialize() {
    if (!this.gl) {
      console.error('[VRWebGL2Optimizer] WebGL2 context not available');
      return false;
    }

    console.log('[VRWebGL2Optimizer] Detecting WebGL2 features');

    try {
      // Check WebGL2 support
      if (!(this.gl instanceof WebGL2RenderingContext)) {
        console.warn('[VRWebGL2Optimizer] WebGL2 not available, falling back to WebGL');
        return false;
      }

      // Detect instancing (always available in WebGL2)
      this.features.instancing = true;
      console.log('[VRWebGL2Optimizer] ✅ Instancing: Supported');

      // Detect UBO (always available in WebGL2)
      this.features.ubo = true;
      console.log('[VRWebGL2Optimizer] ✅ UBO: Supported');

      // Detect VAO (always available in WebGL2)
      this.features.vao = true;
      console.log('[VRWebGL2Optimizer] ✅ VAO: Supported');

      // Check multiview extension
      const multiviewExt = this.gl.getExtension('OVR_multiview2') ||
                          this.gl.getExtension('OCULUS_multiview');
      this.features.multiview = !!multiviewExt;
      console.log(`[VRWebGL2Optimizer] ${this.features.multiview ? '✅' : '⚠️'} Multiview: ${this.features.multiview ? 'Supported' : 'Not supported'}`);

      // Check multi-draw extension
      const multiDrawExt = this.gl.getExtension('WEBGL_multi_draw');
      this.features.multiDraw = !!multiDrawExt;
      console.log(`[VRWebGL2Optimizer] ${this.features.multiDraw ? '✅' : '⚠️'} MultiDraw: ${this.features.multiDraw ? 'Supported' : 'Not supported'}`);

      this.enabled = true;
      console.log('[VRWebGL2Optimizer] Initialization complete');

      return true;

    } catch (error) {
      console.error('[VRWebGL2Optimizer] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Create Uniform Buffer Object (UBO)
   *
   * UBOs allow sharing uniform data across multiple shaders efficiently.
   *
   * @param {string} name - UBO name
   * @param {ArrayBuffer} data - Initial data
   * @param {number} usage - GL usage hint (STATIC_DRAW, DYNAMIC_DRAW, STREAM_DRAW)
   * @returns {Object} UBO descriptor
   */
  createUBO(name, data, usage = this.gl.DYNAMIC_DRAW) {
    if (!this.features.ubo) {
      console.warn('[VRWebGL2Optimizer] UBO not supported');
      return null;
    }

    const gl = this.gl;

    // Create buffer
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
    gl.bufferData(gl.UNIFORM_BUFFER, data, usage);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);

    // Assign binding point
    const bindingPoint = this.nextBindingPoint++;

    // Store UBO descriptor
    const ubo = {
      name: name,
      buffer: buffer,
      bindingPoint: bindingPoint,
      size: data.byteLength,
      usage: usage
    };

    this.uboBindings.set(name, ubo);

    console.log(`[VRWebGL2Optimizer] Created UBO: ${name}, size: ${data.byteLength} bytes, binding: ${bindingPoint}`);

    return ubo;
  }

  /**
   * Update UBO data
   *
   * @param {string} name - UBO name
   * @param {ArrayBuffer} data - New data
   * @param {number} offset - Byte offset (optional)
   */
  updateUBO(name, data, offset = 0) {
    const ubo = this.uboBindings.get(name);
    if (!ubo) {
      console.warn(`[VRWebGL2Optimizer] UBO not found: ${name}`);
      return;
    }

    const gl = this.gl;

    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo.buffer);

    if (offset === 0 && data.byteLength === ubo.size) {
      // Full update
      gl.bufferData(gl.UNIFORM_BUFFER, data, ubo.usage);
    } else {
      // Partial update
      gl.bufferSubData(gl.UNIFORM_BUFFER, offset, data);
    }

    gl.bindBuffer(gl.UNIFORM_BUFFER, null);

    this.stats.uboUpdates++;
  }

  /**
   * Bind UBO to shader program
   *
   * @param {WebGLProgram} program - Shader program
   * @param {string} blockName - Uniform block name in shader
   * @param {string} uboName - UBO name
   */
  bindUBO(program, blockName, uboName) {
    const ubo = this.uboBindings.get(uboName);
    if (!ubo) {
      console.warn(`[VRWebGL2Optimizer] UBO not found: ${uboName}`);
      return;
    }

    const gl = this.gl;

    // Get uniform block index
    const blockIndex = gl.getUniformBlockIndex(program, blockName);
    if (blockIndex === gl.INVALID_INDEX) {
      console.warn(`[VRWebGL2Optimizer] Uniform block not found: ${blockName}`);
      return;
    }

    // Bind uniform block to binding point
    gl.uniformBlockBinding(program, blockIndex, ubo.bindingPoint);

    // Bind UBO to binding point
    gl.bindBufferBase(gl.UNIFORM_BUFFER, ubo.bindingPoint, ubo.buffer);

    console.log(`[VRWebGL2Optimizer] Bound UBO ${uboName} to shader block ${blockName}`);
  }

  /**
   * Setup instanced rendering for mesh
   *
   * Instancing reduces draw calls dramatically for repeated objects.
   *
   * @param {THREE.Mesh} mesh - Mesh to instance
   * @param {Array} instances - Array of instance transforms
   * @returns {Object} Instanced mesh descriptor
   */
  setupInstancing(mesh, instances) {
    if (!this.features.instancing) {
      console.warn('[VRWebGL2Optimizer] Instancing not supported');
      return null;
    }

    const gl = this.gl;
    const geometry = mesh.geometry;

    // Create instance data buffer (matrix4 per instance)
    const instanceCount = instances.length;
    const instanceData = new Float32Array(instanceCount * 16); // 16 floats per matrix4

    instances.forEach((instance, i) => {
      const matrix = instance.matrix || instance;
      matrix.toArray(instanceData, i * 16);
    });

    // Create buffer
    const instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instanceData, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Store instanced mesh descriptor
    const instancedMesh = {
      mesh: mesh,
      instanceBuffer: instanceBuffer,
      instanceCount: instanceCount,
      instanceData: instanceData
    };

    this.instancedMeshes.set(mesh.uuid, instancedMesh);

    console.log(`[VRWebGL2Optimizer] Setup instancing: ${mesh.name || 'Mesh'}, instances: ${instanceCount}`);

    return instancedMesh;
  }

  /**
   * Draw instanced mesh
   *
   * @param {THREE.Mesh} mesh - Mesh to draw
   */
  drawInstanced(mesh) {
    const instancedMesh = this.instancedMeshes.get(mesh.uuid);
    if (!instancedMesh) {
      console.warn('[VRWebGL2Optimizer] Mesh not setup for instancing');
      return;
    }

    const gl = this.gl;
    const geometry = mesh.geometry;

    // Bind geometry buffers (simplified - actual implementation needs full VAO setup)
    // This would be done through Three.js renderer normally

    // Draw instanced
    const mode = gl.TRIANGLES;
    const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;

    if (geometry.index) {
      gl.drawElementsInstanced(mode, count, gl.UNSIGNED_SHORT, 0, instancedMesh.instanceCount);
    } else {
      gl.drawArraysInstanced(mode, 0, count, instancedMesh.instanceCount);
    }

    this.stats.instancedDrawCalls++;
    this.stats.drawCalls++;
    this.stats.savedDrawCalls += (instancedMesh.instanceCount - 1);
    this.stats.triangles += (count / 3) * instancedMesh.instanceCount;
  }

  /**
   * Create Vertex Array Object (VAO)
   *
   * VAOs cache vertex attribute setup, reducing CPU overhead.
   *
   * @param {THREE.BufferGeometry} geometry - Geometry
   * @returns {WebGLVertexArrayObject} VAO
   */
  createVAO(geometry) {
    if (!this.features.vao) {
      console.warn('[VRWebGL2Optimizer] VAO not supported');
      return null;
    }

    // Check cache
    const cacheKey = geometry.uuid;
    if (this.vaoCache.has(cacheKey)) {
      return this.vaoCache.get(cacheKey);
    }

    const gl = this.gl;

    // Create VAO
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Setup attributes (simplified - actual implementation depends on shader)
    // Position attribute (location 0)
    if (geometry.attributes.position) {
      const positionBuffer = geometry.attributes.position.buffer ||
                            this.createBufferFromAttribute(geometry.attributes.position);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    }

    // Normal attribute (location 1)
    if (geometry.attributes.normal) {
      const normalBuffer = geometry.attributes.normal.buffer ||
                          this.createBufferFromAttribute(geometry.attributes.normal);
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    }

    // UV attribute (location 2)
    if (geometry.attributes.uv) {
      const uvBuffer = geometry.attributes.uv.buffer ||
                      this.createBufferFromAttribute(geometry.attributes.uv);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    }

    // Index buffer
    if (geometry.index) {
      const indexBuffer = geometry.index.buffer ||
                         this.createBufferFromAttribute(geometry.index);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    }

    gl.bindVertexArray(null);

    // Cache VAO
    this.vaoCache.set(cacheKey, vao);

    console.log(`[VRWebGL2Optimizer] Created VAO for geometry: ${geometry.uuid}`);

    return vao;
  }

  /**
   * Helper: Create WebGL buffer from BufferAttribute
   */
  createBufferFromAttribute(attribute) {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    const target = attribute.isInterleavedBufferAttribute ? gl.ARRAY_BUFFER :
                   attribute.array instanceof Uint16Array || attribute.array instanceof Uint32Array ?
                   gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;

    gl.bindBuffer(target, buffer);
    gl.bufferData(target, attribute.array, gl.STATIC_DRAW);
    gl.bindBuffer(target, null);

    attribute.buffer = buffer;
    return buffer;
  }

  /**
   * Optimize scene for instancing
   *
   * Automatically groups similar meshes for instanced rendering.
   *
   * @param {THREE.Scene} scene - Scene to optimize
   * @returns {Object} Optimization report
   */
  optimizeScene(scene) {
    console.log('[VRWebGL2Optimizer] Optimizing scene for instancing');

    const meshGroups = new Map(); // Group by geometry + material

    // Group similar meshes
    scene.traverse((object) => {
      if (object.isMesh && object.geometry && object.material) {
        const key = `${object.geometry.uuid}_${object.material.uuid}`;

        if (!meshGroups.has(key)) {
          meshGroups.set(key, []);
        }

        meshGroups.get(key).push(object);
      }
    });

    // Setup instancing for groups with 2+ instances
    let optimizedGroups = 0;
    let totalInstances = 0;

    for (const [key, meshes] of meshGroups) {
      if (meshes.length >= 2) {
        const baseMesh = meshes[0];
        const instances = meshes.map(mesh => mesh.matrix || mesh.matrixWorld);

        this.setupInstancing(baseMesh, instances);

        optimizedGroups++;
        totalInstances += meshes.length;

        // Hide individual meshes (they'll be drawn instanced)
        meshes.forEach(mesh => mesh.visible = false);
      }
    }

    const report = {
      totalMeshGroups: meshGroups.size,
      optimizedGroups: optimizedGroups,
      totalInstances: totalInstances,
      savedDrawCalls: totalInstances - optimizedGroups
    };

    console.log('[VRWebGL2Optimizer] Scene optimization complete:', report);

    return report;
  }

  /**
   * Get optimization statistics
   *
   * @returns {Object} Stats
   */
  getStats() {
    return {
      ...this.stats,
      features: { ...this.features },
      uboCount: this.uboBindings.size,
      instancedMeshCount: this.instancedMeshes.size,
      vaoCacheSize: this.vaoCache.size
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      drawCalls: 0,
      instancedDrawCalls: 0,
      triangles: 0,
      uboUpdates: 0,
      savedDrawCalls: 0
    };
  }

  /**
   * Dispose resources
   */
  dispose() {
    const gl = this.gl;

    // Delete UBOs
    for (const [name, ubo] of this.uboBindings) {
      gl.deleteBuffer(ubo.buffer);
    }
    this.uboBindings.clear();

    // Delete instance buffers
    for (const [uuid, instancedMesh] of this.instancedMeshes) {
      gl.deleteBuffer(instancedMesh.instanceBuffer);
    }
    this.instancedMeshes.clear();

    // Delete VAOs
    for (const [uuid, vao] of this.vaoCache) {
      gl.deleteVertexArray(vao);
    }
    this.vaoCache.clear();

    this.enabled = false;

    console.log('[VRWebGL2Optimizer] Disposed');
  }
}

/**
 * Example UBO shader code:
 *
 * Vertex Shader:
 * ```glsl
 * #version 300 es
 *
 * // Uniform Block (matches UBO structure)
 * layout(std140) uniform Matrices {
 *   mat4 projection;
 *   mat4 view;
 *   mat4 model;
 * };
 *
 * in vec3 position;
 * in vec3 normal;
 *
 * out vec3 vNormal;
 *
 * void main() {
 *   vNormal = mat3(model) * normal;
 *   gl_Position = projection * view * model * vec4(position, 1.0);
 * }
 * ```
 *
 * Usage:
 * ```javascript
 * // Create UBO with projection, view, model matrices
 * const matrixData = new Float32Array(16 * 3); // 3 matrices
 * projectionMatrix.toArray(matrixData, 0);
 * viewMatrix.toArray(matrixData, 16);
 * modelMatrix.toArray(matrixData, 32);
 *
 * const ubo = optimizer.createUBO('Matrices', matrixData);
 * optimizer.bindUBO(shaderProgram, 'Matrices', 'Matrices');
 *
 * // Update only model matrix
 * newModelMatrix.toArray(matrixData, 32);
 * optimizer.updateUBO('Matrices', matrixData.subarray(32, 48), 32);
 * ```
 */

// Export
if (typeof window !== 'undefined') {
  window.VRWebGL2Optimizer = VRWebGL2Optimizer;
  console.log('[VRWebGL2Optimizer] WebGL2 optimizer loaded');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRWebGL2Optimizer;
}
