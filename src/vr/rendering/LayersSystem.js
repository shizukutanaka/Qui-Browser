/**
 * FR-1.5: WebXR Layers for sharp in-VR browser-panel text.
 *
 * XRWebGLBinding.createQuadLayer() composites content at the native display
 * resolution, outside the foveated eye-buffer.  Text and fine detail in
 * browser panels are visibly cleaner than the standard CanvasTexture path.
 *
 * Runtime support (2024):
 *   ✅ Meta Quest 2/3  (Oculus Browser 25+, `layers` optional-feature required)
 *   ✅ Pico 4          (recent firmware)
 *   ❌ Desktop WebXR   (graceful fallback to Three.js plane mesh)
 *
 * The session must have been requested with `optionalFeatures: ['layers']`.
 * Without that flag `XRWebGLBinding` exists but `createQuadLayer` throws.
 * VRApp.setupVR() is responsible for adding that feature request.
 */

export class LayersSystem {
  constructor() {
    this.supported = false;
    /** @type {XRWebGLBinding|null} */
    this.glBinding   = null;
    this._gl         = null;
    /** @type {Map<string, XRQuadLayer>} */
    this._layers     = new Map();
    this._blitWarned = false;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Bind to the active XR session.  Returns true when quad layers are usable.
   * @param {XRSession}                session
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   */
  initialize(session, gl) {
    if (!session || !gl) {
      return false;
    }

    if (typeof XRWebGLBinding === 'undefined') {
      console.info('LayersSystem: XRWebGLBinding unavailable — using mesh fallback');
      return false;
    }

    try {
      this.glBinding = new XRWebGLBinding(session, gl);
      this._gl = gl;
      this.supported = true;
      console.info('LayersSystem: WebXR Layers API initialised');
      return true;
    } catch (e) {
      console.warn('LayersSystem: XRWebGLBinding init failed', e);
      return false;
    }
  }

  dispose() {
    this._layers.clear();
    this.glBinding   = null;
    this._gl         = null;
    this.supported   = false;
    this._blitWarned = false;
  }

  // ── Layer creation / removal ───────────────────────────────────────────────

  /**
   * Create an XRQuadLayer for a browser-panel content area.
   *
   * @param {object}           opts
   * @param {string}           opts.id            — unique key for this layer
   * @param {XRSpace}          opts.space          — reference space (e.g. local-floor)
   * @param {XRRigidTransform} [opts.transform]    — pose in that space
   * @param {number}           opts.width          — physical width  (metres)
   * @param {number}           opts.height         — physical height (metres)
   * @param {number}           [opts.pixelWidth]   — texture resolution x  (default 2048)
   * @param {number}           [opts.pixelHeight]  — texture resolution y  (default 1280)
   * @returns {XRQuadLayer|null}  null when unsupported or on error
   */
  createQuadLayer({ id, space, transform, width, height,
    pixelWidth = 2048, pixelHeight = 1280 }) {
    if (!this.supported || !this.glBinding) {
      return null;
    }

    try {
      const layer = this.glBinding.createQuadLayer({
        space,
        colorFormat : 0x8058, // GL_RGBA8
        width,
        height,
        viewPixelWidth  : pixelWidth,
        viewPixelHeight : pixelHeight,
        layout   : 'mono',
        isStatic : false
      });
      if (transform) {
        layer.transform = transform;
      }
      this._layers.set(id, layer);
      return layer;
    } catch (e) {
      console.warn('LayersSystem: createQuadLayer failed', e);
      return null;
    }
  }

  /**
   * Remove the layer with the given id and update the session render state.
   * @param {string}    id
   * @param {XRSession} session
   * @param {XRLayer}   [baseLayer]
   */
  removeLayer(id, session, baseLayer) {
    this._layers.delete(id);
    if (session) {
      this.updateRenderState(session, baseLayer);
    }
  }

  // ── Per-frame rendering ────────────────────────────────────────────────────

  /**
   * Blit a canvas onto a quad layer's sub-image for the current frame.
   * Must be called every frame the canvas content changes.
   *
   * @param {XRQuadLayer}                          layer
   * @param {HTMLCanvasElement|OffscreenCanvas}    source
   * @param {XRFrame}                              frame
   * @param {XRView[]}                             views
   */
  renderCanvasToLayer(layer, source, frame, views) {
    if (!this.supported || !this.glBinding || !frame || !views || !views.length) {
      return;
    }

    const gl = this._gl;
    if (!gl) {
      return;
    }

    try {
      for (const view of views) {
        const sub = this.glBinding.getViewSubImage(layer, view);
        if (!sub || !sub.framebuffer) {
          continue;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, sub.framebuffer);
        gl.viewport(sub.viewport.x, sub.viewport.y,
          sub.viewport.width, sub.viewport.height);
        // Upload the canvas pixels into the layer's backing texture.
        gl.bindTexture(gl.TEXTURE_2D, sub.colorTexture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, source);
      }
    } catch (e) {
      if (!this._blitWarned) {
        console.warn('LayersSystem: renderCanvasToLayer error', e);
        this._blitWarned = true;
      }
    } finally {
      if (gl) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
    }
  }

  // ── Render-state management ────────────────────────────────────────────────

  /**
   * Commit the current layer stack into the session's render state.
   * Call after creating or removing layers, and once on session start.
   *
   * Layer order: baseLayer (projection / Three.js background) first, then quad
   * layers composited on top at native resolution.
   *
   * @param {XRSession} session
   * @param {XRLayer}   [baseLayer]  — `renderer.xr.getBaseLayer()` or equivalent
   */
  updateRenderState(session, baseLayer) {
    if (!session || !this.supported) {
      return;
    }
    const quads  = [...this._layers.values()];
    const layers = baseLayer ? [baseLayer, ...quads] : quads;
    try {
      session.updateRenderState({ layers });
    } catch (e) {
      console.warn('LayersSystem: updateRenderState failed', e);
    }
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  /** true when XRWebGLBinding is available on this runtime. */
  get isSupported() {
    return this.supported;
  }

  /** Number of active quad layers. */
  get count() {
    return this._layers.size;
  }

  /** Retrieve a layer by id (for position updates etc.). */
  getLayer(id) {
    return this._layers.get(id) || null;
  }
}
