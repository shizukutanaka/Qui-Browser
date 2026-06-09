// VR Browser Client-Side Implementation
// Extracted from vr-browser.html for CSP compliance and testability.

class QuiVRBrowserClient {
  constructor() {
    this.xrSession = null;
    this.xrRefSpace = null;
    this.gl = null;
    this.canvas = null;
    this.isVRActive = false;

    // Performance tracking
    this.frameCount = 0;
    this.lastTime = 0;
    this.fps = 0;

    // UI elements
    this.enterVRBtn = document.getElementById('enter-vr-btn');
    this.statusText = document.getElementById('status');
    this.performanceStats = document.getElementById('performance-stats');
    this.uiOverlay = document.getElementById('ui-overlay');
    this.urlBar = document.getElementById('url-bar');
    this.canvas = document.getElementById('canvas');

    // Bound XR session end handler stored for clean removal.
    this._onXREnd = () => this.exitVR();

    this.init();
  }

  async init() {
    if (!navigator.xr) {
      this.updateStatus('WebXR not supported in this browser');
      this.enterVRBtn.disabled = true;
      return;
    }

    const vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
    if (!vrSupported) {
      this.updateStatus('VR mode not supported on this device');
      this.enterVRBtn.disabled = true;
      return;
    }

    this.updateStatus('VR Ready — Click to enter VR');
    this.enterVRBtn.disabled = false;

    this.enterVRBtn.addEventListener('click', () => this.enterVR());
  }

  async enterVR() {
    try {
      this.updateStatus('Entering VR mode…');

      this.xrSession = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local'],
        optionalFeatures: ['hand-tracking', 'layers']
      });

      await this.setupWebGL();

      const glLayer = new XRWebGLLayer(this.xrSession, this.gl);
      await this.xrSession.updateRenderState({ baseLayer: glLayer });

      this.xrRefSpace = await this.xrSession.requestReferenceSpace('local');

      this.setupFoveatedRendering(glLayer);

      this.xrSession.addEventListener('end', this._onXREnd);

      this.uiOverlay.classList.add('hidden');
      this.performanceStats.style.display = 'block';
      this.canvas.style.display = 'block';

      this.isVRActive = true;
      this.xrSession.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame));

      console.debug('[Qui VR] VR mode activated');
    } catch (error) {
      console.error('[Qui VR] Failed to enter VR:', error);
      this.updateStatus('Failed to enter VR: ' + error.message);
    }
  }

  async setupWebGL() {
    const gl = this.canvas.getContext('webgl2', {
      xrCompatible: true,
      alpha: false,
      antialias: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance'
    });

    if (!gl) {
      throw new Error('WebGL2 not supported');
    }

    this.gl = gl;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      document.getElementById('gpu').textContent = renderer;
    }
  }

  setupFoveatedRendering(glLayer) {
    if (typeof glLayer.fixedFoveation !== 'undefined') {
      glLayer.fixedFoveation = 0.5;
      document.getElementById('foveation').textContent = 'Medium';
      console.debug('[Qui VR] Foveated rendering enabled');
    }
  }

  onXRFrame(time, frame) {
    const session = frame.session;

    session.requestAnimationFrame((t, f) => this.onXRFrame(t, f));

    this.updatePerformanceStats(time);

    const pose = frame.getViewerPose(this.xrRefSpace);
    if (!pose) return;

    const glLayer = session.renderState.baseLayer;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, glLayer.framebuffer);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    for (const view of pose.views) {
      const viewport = glLayer.getViewport(view);
      this.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
      this.renderScene(view, pose);
    }

    this.handleInput(frame);
  }

  renderScene(view, pose) {
    const gl = this.gl;
    const color = 0.5 + Math.sin(Date.now() * 0.001) * 0.5;
    gl.clearColor(color * 0.2, color * 0.3, color * 0.5, 1.0);
  }

  handleInput(frame) {
    let inputMode = 'None';

    for (const inputSource of frame.session.inputSources) {
      if (inputSource.hand) {
        inputMode = 'Hands';
      } else if (inputSource.targetRayMode === 'tracked-pointer') {
        inputMode = 'Controllers';
      } else if (inputSource.targetRayMode === 'gaze') {
        inputMode = 'Gaze';
      }
    }

    document.getElementById('input-mode').textContent = inputMode;
  }

  updatePerformanceStats(time) {
    this.frameCount++;

    if (this.lastTime === 0) {
      this.lastTime = time;
      return;
    }

    const deltaTime = time - this.lastTime;

    if (this.frameCount % 30 === 0) {
      this.fps = 1000 / deltaTime;
      document.getElementById('fps').textContent = this.fps.toFixed(1);
      document.getElementById('frame-time').textContent = deltaTime.toFixed(2);
    }

    this.lastTime = time;
  }

  exitVR() {
    console.debug('[Qui VR] Exiting VR mode');

    if (this.xrSession) {
      this.xrSession.removeEventListener('end', this._onXREnd);
      this.xrSession.end().catch(() => {});
      this.xrSession = null;
    }

    this.isVRActive = false;

    this.uiOverlay.classList.remove('hidden');
    this.performanceStats.style.display = 'none';
    this.canvas.style.display = 'none';

    this.updateStatus('VR Ready — Click to enter VR');
  }

  updateStatus(message) {
    this.statusText.textContent = message;
  }
}

// Initialize when DOM is ready
const vrBrowser = new QuiVRBrowserClient();
window.vrBrowser = vrBrowser;
