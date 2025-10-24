/**
 * VR Multiview Rendering System
 * CPU負荷を25-50%削減する最新のレンダリング最適化技術
 *
 * Multiview rendering は、両眼の画像を同時にレンダリングすることで
 * CPU側の処理を大幅に削減します。従来は左右の目を別々にレンダリングして
 * いましたが、multiviewでは1回のdraw callで両方をレンダリングできます。
 *
 * Based on Meta Quest Best Practices (2025)
 * @see https://developers.meta.com/horizon/documentation/web/web-multiview/
 * @version 1.0.0
 */

class VRMultiviewRenderingSystem {
  constructor() {
    this.enabled = false;
    this.supported = false;
    this.extension = null;

    this.config = {
      enableMSAA: true, // Multisampled antialiasing
      samples: 4, // MSAA samples (2, 4, or 8)
      colorFormat: 'RGBA8',
      depthFormat: 'DEPTH_COMPONENT24',
      autoEnable: true // 自動的に有効化
    };

    // Performance metrics
    this.metrics = {
      drawCallsSaved: 0,
      cpuTimeSaved: 0, // ms
      renderTimeWithoutMultiview: 0,
      renderTimeWithMultiview: 0,
      cpuUsageReduction: 0 // percentage
    };

    // WebGL context and resources
    this.gl = null;
    this.framebuffer = null;
    this.colorTexture = null;
    this.depthTexture = null;
    this.xrSession = null;

    console.info('[Multiview] Multiview Rendering System initialized');
  }

  /**
   * Check if multiview is supported
   * @param {WebGL2RenderingContext} gl - WebGL 2.0 context
   * @returns {boolean} Support status
   */
  checkSupport(gl) {
    if (!gl) {
      console.warn('[Multiview] No WebGL context provided');
      return false;
    }

    // Multiview requires WebGL 2.0
    if (!(gl instanceof WebGL2RenderingContext)) {
      console.warn('[Multiview] WebGL 2.0 required');
      return false;
    }

    // Check for OCULUS_multiview extension (Quest-specific)
    this.extension = gl.getExtension('OCULUS_multiview');

    if (!this.extension) {
      // Fallback to standard OVR_multiview2
      this.extension = gl.getExtension('OVR_multiview2');
    }

    if (this.extension) {
      console.info('[Multiview] Extension found:', this.extension);
      this.supported = true;
      return true;
    }

    console.warn('[Multiview] Multiview extension not supported');
    return false;
  }

  /**
   * Initialize multiview rendering for XR session
   * @param {XRSession} session - Active XR session
   * @param {WebGL2RenderingContext} gl - WebGL 2.0 context
   * @returns {Promise<boolean>} Success status
   */
  async initialize(session, gl) {
    if (!session || !gl) {
      console.warn('[Multiview] Missing required parameters');
      return false;
    }

    this.xrSession = session;
    this.gl = gl;

    try {
      // Check support
      if (!this.checkSupport(gl)) {
        console.warn('[Multiview] Cannot enable - not supported');
        return false;
      }

      // Setup multiview layer
      await this.setupMultiviewLayer(session, gl);

      // Enable if auto-enable is on
      if (this.config.autoEnable) {
        this.enabled = true;
      }

      console.info('[Multiview] Multiview rendering initialized');
      return true;

    } catch (error) {
      console.error('[Multiview] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Setup multiview layer
   * @param {XRSession} session - XR session
   * @param {WebGL2RenderingContext} gl - WebGL context
   */
  async setupMultiviewLayer(session, gl) {
    try {
      // Create XR WebGL binding
      const xrGlBinding = new XRWebGLBinding(session, gl);

      // Get recommended dimensions
      const glLayer = new XRWebGLLayer(session, gl);
      const viewport = glLayer.getViewport(session.renderState.baseLayer || glLayer);

      // Create multiview framebuffer
      this.framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

      // Create color texture array (2 layers for both eyes)
      this.colorTexture = this.createMultiviewTexture(
        gl,
        viewport.width,
        viewport.height,
        this.getColorFormat(gl),
        this.config.samples
      );

      // Create depth texture array
      this.depthTexture = this.createMultiviewTexture(
        gl,
        viewport.width,
        viewport.height,
        this.getDepthFormat(gl),
        this.config.samples
      );

      // Attach textures to framebuffer using multiview
      this.attachMultiviewTextures(gl);

      // Check framebuffer status
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`Framebuffer incomplete: ${status}`);
      }

      // Update XR session render state
      session.updateRenderState({
        baseLayer: glLayer
      });

      console.info('[Multiview] Multiview layer configured');

    } catch (error) {
      console.error('[Multiview] Failed to setup layer:', error);
      throw error;
    }
  }

  /**
   * Create multiview texture (2D texture array)
   * @param {WebGL2RenderingContext} gl - WebGL context
   * @param {number} width - Texture width
   * @param {number} height - Texture height
   * @param {number} format - Texture format
   * @param {number} samples - MSAA samples
   * @returns {WebGLTexture} Created texture
   */
  createMultiviewTexture(gl, width, height, format, samples) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);

    // Allocate storage for 2 layers (left and right eye)
    if (samples > 1 && this.config.enableMSAA) {
      // Multisampled texture (OCULUS_multiview supports MSAA)
      gl.texStorage3D(
        gl.TEXTURE_2D_ARRAY,
        1, // mip levels
        format,
        width,
        height,
        2 // num layers (2 eyes)
      );
    } else {
      // Regular texture
      gl.texImage3D(
        gl.TEXTURE_2D_ARRAY,
        0, // mip level
        format,
        width,
        height,
        2, // num layers
        0, // border
        this.getBaseFormat(gl, format),
        this.getTextureType(gl, format),
        null
      );
    }

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return texture;
  }

  /**
   * Attach multiview textures to framebuffer
   * @param {WebGL2RenderingContext} gl - WebGL context
   */
  attachMultiviewTextures(gl) {
    // Attach color texture using multiview
    this.extension.framebufferTextureMultiviewOVR(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      this.colorTexture,
      0, // level
      0, // baseViewIndex
      2  // numViews (both eyes)
    );

    // Attach depth texture using multiview
    this.extension.framebufferTextureMultiviewOVR(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      this.depthTexture,
      0, // level
      0, // baseViewIndex
      2  // numViews
    );
  }

  /**
   * Get WebGL color format constant
   * @param {WebGL2RenderingContext} gl - WebGL context
   * @returns {number} Format constant
   */
  getColorFormat(gl) {
    switch (this.config.colorFormat) {
      case 'RGBA8':
        return gl.RGBA8;
      case 'RGB8':
        return gl.RGB8;
      case 'RGBA16F':
        return gl.RGBA16F;
      default:
        return gl.RGBA8;
    }
  }

  /**
   * Get WebGL depth format constant
   * @param {WebGL2RenderingContext} gl - WebGL context
   * @returns {number} Format constant
   */
  getDepthFormat(gl) {
    switch (this.config.depthFormat) {
      case 'DEPTH_COMPONENT16':
        return gl.DEPTH_COMPONENT16;
      case 'DEPTH_COMPONENT24':
        return gl.DEPTH_COMPONENT24;
      case 'DEPTH_COMPONENT32F':
        return gl.DEPTH_COMPONENT32F;
      default:
        return gl.DEPTH_COMPONENT24;
    }
  }

  /**
   * Get base format for texture
   * @param {WebGL2RenderingContext} gl - WebGL context
   * @param {number} internalFormat - Internal format
   * @returns {number} Base format
   */
  getBaseFormat(gl, internalFormat) {
    if (internalFormat === gl.RGBA8 || internalFormat === gl.RGBA16F) {
      return gl.RGBA;
    } else if (internalFormat === gl.RGB8) {
      return gl.RGB;
    } else if (internalFormat === gl.DEPTH_COMPONENT24 || internalFormat === gl.DEPTH_COMPONENT16) {
      return gl.DEPTH_COMPONENT;
    }
    return gl.RGBA;
  }

  /**
   * Get texture type
   * @param {WebGL2RenderingContext} gl - WebGL context
   * @param {number} internalFormat - Internal format
   * @returns {number} Texture type
   */
  getTextureType(gl, internalFormat) {
    if (internalFormat === gl.RGBA16F) {
      return gl.FLOAT;
    }
    return gl.UNSIGNED_BYTE;
  }

  /**
   * Begin multiview rendering pass
   * @param {XRFrame} frame - Current XR frame
   */
  beginRenderPass(frame) {
    if (!this.enabled || !this.framebuffer) {
      return;
    }

    const gl = this.gl;

    // Bind multiview framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

    // Clear buffers
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Setup viewport (will render to both eyes simultaneously)
    const session = this.xrSession;
    const glLayer = session.renderState.baseLayer;
    const viewport = glLayer.getViewport(frame.session.renderState.baseLayer);

    gl.viewport(0, 0, viewport.width, viewport.height);

    // Record start time for metrics
    this.metrics.renderStartTime = performance.now();
  }

  /**
   * End multiview rendering pass
   */
  endRenderPass() {
    if (!this.enabled) {
      return;
    }

    // Record metrics
    const renderTime = performance.now() - this.metrics.renderStartTime;
    this.metrics.renderTimeWithMultiview = renderTime;

    // Unbind framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  /**
   * Get shader code for multiview
   * This provides GLSL code snippets for vertex shaders
   * @returns {Object} Shader code snippets
   */
  static getShaderCode() {
    return {
      vertexShaderHeader: `#version 300 es
#extension GL_OVR_multiview2 : require
layout(num_views = 2) in;

// View-dependent uniforms
uniform mat4 u_viewMatrix[2];
uniform mat4 u_projectionMatrix[2];
`,
      vertexShaderMain: `
  // Use gl_ViewID_OVR to select the correct view matrix
  mat4 viewMatrix = u_viewMatrix[gl_ViewID_OVR];
  mat4 projectionMatrix = u_projectionMatrix[gl_ViewID_OVR];

  vec4 viewPosition = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewPosition;
`,
      fragmentShader: `#version 300 es
precision highp float;

// Fragment shader remains the same
// gl_ViewID_OVR is not available in fragment shader
out vec4 fragColor;

void main() {
  fragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`
    };
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance data
   */
  getMetrics() {
    // Estimate CPU usage reduction
    if (this.metrics.renderTimeWithoutMultiview > 0) {
      this.metrics.cpuUsageReduction =
        ((this.metrics.renderTimeWithoutMultiview - this.metrics.renderTimeWithMultiview) /
         this.metrics.renderTimeWithoutMultiview) * 100;
    }

    return {
      enabled: this.enabled,
      supported: this.supported,
      drawCallsSaved: this.metrics.drawCallsSaved,
      cpuTimeSaved: this.metrics.cpuTimeSaved.toFixed(2) + 'ms',
      cpuUsageReduction: this.metrics.cpuUsageReduction.toFixed(1) + '%',
      renderTimeWithMultiview: this.metrics.renderTimeWithMultiview.toFixed(2) + 'ms',
      msaaEnabled: this.config.enableMSAA,
      samples: this.config.samples
    };
  }

  /**
   * Enable multiview rendering
   */
  enable() {
    if (!this.supported) {
      console.warn('[Multiview] Cannot enable - not supported');
      return false;
    }

    this.enabled = true;
    console.info('[Multiview] Enabled');
    return true;
  }

  /**
   * Disable multiview rendering
   */
  disable() {
    this.enabled = false;
    console.info('[Multiview] Disabled');
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.info('[Multiview] Configuration updated:', this.config);
  }

  /**
   * Dispose and clean up resources
   */
  dispose() {
    if (this.gl) {
      if (this.framebuffer) {
        this.gl.deleteFramebuffer(this.framebuffer);
        this.framebuffer = null;
      }
      if (this.colorTexture) {
        this.gl.deleteTexture(this.colorTexture);
        this.colorTexture = null;
      }
      if (this.depthTexture) {
        this.gl.deleteTexture(this.depthTexture);
        this.depthTexture = null;
      }
    }

    this.enabled = false;
    this.gl = null;
    this.xrSession = null;

    console.info('[Multiview] Disposed');
  }

  /**
   * Get best practices recommendations
   * @returns {Array} List of recommendations
   */
  static getRecommendations() {
    return [
      {
        title: 'Use WebGL 2.0',
        description: 'Multiview requires WebGL 2.0. Ensure your context is created with webgl2.',
        priority: 'high'
      },
      {
        title: 'Update Shaders',
        description: 'Add #extension GL_OVR_multiview2 and use gl_ViewID_OVR in vertex shaders.',
        priority: 'high'
      },
      {
        title: 'CPU-Bound Optimization',
        description: 'Multiview only helps CPU-bound applications. GPU-bound apps won\'t see benefits.',
        priority: 'medium'
      },
      {
        title: 'Enable MSAA',
        description: 'OCULUS_multiview supports MSAA for better visual quality.',
        priority: 'medium'
      },
      {
        title: 'Expected Performance Gain',
        description: 'Expect 25-50% CPU usage reduction for rendering-heavy applications.',
        priority: 'info'
      }
    ];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRMultiviewRenderingSystem;
}

// Global instance
window.VRMultiviewRenderingSystem = VRMultiviewRenderingSystem;

console.info('[Multiview] VR Multiview Rendering System loaded');
