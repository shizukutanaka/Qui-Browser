/**
 * Immersive (360°/180°) video player.
 *
 * Renders an equirectangular video onto the inside of a large sphere centred on
 * the viewer, so a general VR user can watch 360° content from within the
 * scene. Unlike the dom-overlay browsing panel, a `THREE.VideoTexture` draws to
 * the WebGL surface and therefore works *inside* the immersive session across
 * headsets (Quest/Pico/…), which is what makes the feature usable in a build
 * meant for distribution.
 *
 * The projection maths (sphere extents, stereo UV crops, format detection)
 * lives in the THREE-free `videoProjection.js` so it can be unit-tested; this
 * class is the THREE/DOM runtime that wires it into the scene.
 *
 * Lifecycle: `play(url)` builds the sphere(s) + a HUD (Pause/Exit) and starts
 * playback; `update()` keeps the sphere centred on the head each frame so the
 * viewer is always at its centre; `stop()`/`dispose()` tear everything down.
 */

import * as THREE from 'three';
import { configureUITexture } from '../ui/canvasTexture.js';
import { buildVideoSphereGeometry, eyeUVTransform, detectVideoFormat } from './videoProjection.js';

export class ImmersiveVideo {
  /**
   * @param {THREE.Scene}    scene
   * @param {THREE.Camera}   camera   — the (head) camera; the sphere follows it
   * @param {THREE.WebGLRenderer} renderer
   * @param {object} deps
   * @param {(mesh, handlers) => void} deps.registerInteractable
   * @param {(mesh) => void}           deps.unregisterInteractable
   * @param {(message:string) => void} [deps.onError] — called on load/playback failure
   * @param {(label:string) => void} [deps.onHoverCaption] — called when a HUD button is
   *   hovered so the host can show a gaze-dwell preview caption (WCAG 1.3.3).
   */
  constructor(scene, camera, renderer, { registerInteractable, unregisterInteractable, onError, onPlaybackChange, onHoverCaption } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.registerInteractable = registerInteractable || (() => {});
    this.unregisterInteractable = unregisterInteractable || (() => {});
    this.onError = onError || (() => {});
    this.onHoverCaption = typeof onHoverCaption === 'function' ? onHoverCaption : null;
    // Optional callback fired when playback state changes so the host can
    // mirror the state to captions / haptics without ImmersiveVideo knowing
    // about those systems directly.
    this.onPlaybackChange = onPlaybackChange || (() => {});

    this.video = null;
    this._onVideoError = null; // bound 'error' listener (removed on stop)
    this._onVideoPlaying = null; // bound 'playing' listener (removed on stop)
    this.meshes = []; // sphere mesh(es): 1 (mono) or 2 (stereo eyes)
    this.controlPanel = null; // HUD group parented to the camera
    this.playing = false;

    this._radius = 200;
    this._projection = '360';
    this._layout = 'mono';
    this._eyeTextures = []; // VideoTextures (disposed on stop)
    this._panelTextures = []; // CanvasTextures for the HUD buttons
    this._playPauseBtn = null;
    this._tmpVec = new THREE.Vector3();
  }

  /** True while a video is loaded and its sphere(s) are in the scene. */
  get active() {
    return this.meshes.length > 0;
  }

  /**
   * Load and play a 360°/180° video. Projection/layout are auto-detected from
   * the URL but can be overridden via opts.
   *
   * @param {string} url
   * @param {{projection?:string, layout?:string}} [opts]
   */
  play(url, opts = {}) {
    if (!url) {
      return;
    }
    this.stop(); // replace any currently-playing video

    const fmt = { ...detectVideoFormat(url), ...opts };
    this._projection = fmt.projection;
    this._layout = fmt.layout;

    // Video element. crossOrigin is required for the texture to be readable
    // when the host serves permissive CORS headers.
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    video.src = url;
    this.video = video;

    // Surface load/decode failures (bad URL, CORS block, unsupported codec)
    // instead of leaving the viewer staring at a black sphere. The 'error'
    // event fires once for these; gesture-gated autoplay rejection (handled by
    // the play() promise catch below) is normal and deliberately not reported.
    this._onVideoError = () => this._reportError('Could not load video (check URL / CORS)');
    video.addEventListener('error', this._onVideoError);

    // Only mark as playing once the browser actually starts playback. If the
    // Autoplay Policy rejects video.play() (common on mobile/headset without a
    // prior gesture), this never fires, so the HUD stays on "Play" and
    // this.playing stays false instead of lying that something is playing.
    this._onVideoPlaying = () => {
      this.playing = true;
      if (this._playPauseBtn) {
        this._playPauseBtn.userData.setLabel('Pause');
      }
      this.onPlaybackChange('playing');
    };
    video.addEventListener('playing', this._onVideoPlaying);

    if (this._layout === 'mono') {
      this.meshes.push(this._makeSphere(this._makeTexture()));
    } else {
      // Stereo: a sphere per eye, each cropped to its half and shown only to
      // that eye's WebXR layer (left=1, right=2).
      const left = this._makeSphere(this._makeTexture('left'));
      left.layers.set(1);
      const right = this._makeSphere(this._makeTexture('right'));
      right.layers.set(2);
      this._enableStereoLayers();
      this.meshes.push(left, right);
    }
    for (const m of this.meshes) {
      this.scene.add(m);
    }

    this._buildControlPanel();

    const p = video.play();
    if (p && p.catch) {
      p.catch(() => {
      /* gesture-gated autoplay; HUD Play can retry. this.playing stays false
         and the 'playing' listener flips state once playback truly starts. */
      });
    }
  }

  /**
   * Report a load/playback failure to the host app. The HUD (and its Exit
   * button) is left in place so the viewer can dismiss the failed video.
   *
   * A mid-stream error (network drop, decode failure) that fires *after*
   * 'playing' already set this.playing=true previously left the HUD Pause/Play
   * label and this.playing permanently out of sync with reality — only
   * stop()/togglePause() kept them in sync. Correct that here too, guarded so
   * a load error that fires before playback ever starts (this.playing already
   * false) stays a no-op, unchanged from before.
   * @param {string} message
   */
  _reportError(message) {
    if (this.playing) {
      this.playing = false;
      if (this._playPauseBtn) {
        this._playPauseBtn.userData.setLabel('Play');
      }
      this.onPlaybackChange('stopped');
    }
    this.onError(message);
  }

  /** Build a VideoTexture, applying the per-eye crop for stereo layouts. */
  _makeTexture(eye) {
    const tex = new THREE.VideoTexture(this.video);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (eye && this._layout !== 'mono') {
      const { offset, repeat } = eyeUVTransform(this._layout, eye);
      tex.offset.set(offset[0], offset[1]);
      tex.repeat.set(repeat[0], repeat[1]);
    }
    this._eyeTextures.push(tex);
    return tex;
  }

  /** A view-from-inside sphere (geometry flipped on x so text isn't mirrored). */
  _makeSphere(texture) {
    const geo = buildVideoSphereGeometry(THREE, { radius: this._radius, projection: this._projection });
    geo.scale(-1, 1, 1); // invert so we see the inner surface, non-mirrored
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture }));
    mesh.frustumCulled = false; // always centred on the viewer
    return mesh;
  }

  /** Enable the per-eye layers on the active WebXR cameras (best effort). */
  _enableStereoLayers() {
    this.camera.layers.enable(1);
    this.camera.layers.enable(2);
    const xrCam = this.renderer?.xr?.getCamera ? this.renderer.xr.getCamera() : null;
    if (xrCam && Array.isArray(xrCam.cameras) && xrCam.cameras.length >= 2) {
      xrCam.cameras[0].layers.enable(1);
      xrCam.cameras[1].layers.enable(2);
    }
  }

  /** Small HUD (Pause/Exit) parented to the camera so it stays in view. */
  _buildControlPanel() {
    const group = new THREE.Group();
    group.name = 'immersiveVideoControls';

    this._playPauseBtn = this._makeButton('Play', () => this.togglePause());
    this._playPauseBtn.position.set(-0.3, 0, 0);
    const exitBtn = this._makeButton('Exit', () => this.stop());
    exitBtn.position.set(0.3, 0, 0);
    group.add(this._playPauseBtn, exitBtn);

    // HUD: slightly below the line of sight, ~1.6 m ahead, follows the head.
    group.position.set(0, -0.6, -1.6);
    this.camera.add(group);
    this.controlPanel = group;
  }

  /** Canvas-textured interactable button (mirrors VRApp.makeActionButton). */
  _makeButton(initialLabel, onSelect) {
    let label = initialLabel;
    const w = 256;
    const h = 96;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const tex = configureUITexture(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    this._panelTextures.push(tex);

    const draw = (hover) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = hover ? 'rgba(40,60,90,0.95)' : 'rgba(16,20,30,0.92)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#5e72e4';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(label, w / 2, h / 2 + 12);
      tex.needsUpdate = true;
    };
    draw(false);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.18),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    mesh.userData.setLabel = (l) => {
      label = l;
      draw(false);
    };
    this.registerInteractable(mesh, {
      onSelect: () => {
        if (onSelect) {
          onSelect();
        }
      },
      onHover: () => {
        draw(true);
        if (this.onHoverCaption) this.onHoverCaption(label);
      },
      onHoverEnd: () => draw(false)
    });
    return mesh;
  }

  /** Toggle play/pause, updating the HUD button label. */
  togglePause() {
    if (!this.video) {
      return;
    }
    if (this.video.paused) {
      const p = this.video.play();
      if (p && p.catch) {
        p.catch(() => {});
      }
      this.playing = true;
      if (this._playPauseBtn) {
        this._playPauseBtn.userData.setLabel('Pause');
      }
      this.onPlaybackChange('playing');
    } else {
      this.video.pause();
      this.playing = false;
      if (this._playPauseBtn) {
        this._playPauseBtn.userData.setLabel('Play');
      }
      this.onPlaybackChange('paused');
    }
  }

  /** Per-frame: keep the sphere(s) centred on the head (translation only, so
   *  the viewer can look around the stationary video). */
  update() {
    if (!this.active) {
      return;
    }
    this.camera.getWorldPosition(this._tmpVec);
    for (const m of this.meshes) {
      m.position.copy(this._tmpVec);
    }
  }

  /** Stop playback and remove everything from the scene. */
  stop() {
    // Notify before clearing meshes (active getter depends on meshes.length).
    if (this.active) {
      this.onPlaybackChange('stopped');
    }
    for (const m of this.meshes) {
      this.scene.remove(m);
      if (m.geometry) {
        m.geometry.dispose();
      }
      if (m.material) {
        m.material.dispose();
      }
    }
    this.meshes = [];

    for (const t of this._eyeTextures) {
      t.dispose();
    }
    this._eyeTextures = [];

    if (this.controlPanel) {
      for (const btn of this.controlPanel.children) {
        this.unregisterInteractable(btn);
        // HUD buttons own a PlaneGeometry + MeshBasicMaterial each; without this
        // every play()/stop() cycle would leak them on the GPU.
        if (btn.geometry) {
          btn.geometry.dispose();
        }
        if (btn.material) {
          btn.material.dispose();
        }
      }
      if (this.controlPanel.parent) {
        this.controlPanel.parent.remove(this.controlPanel);
      }
      this.controlPanel = null;
      this._playPauseBtn = null;
    }
    for (const t of this._panelTextures) {
      t.dispose();
    }
    this._panelTextures = [];

    if (this.video) {
      this.video.pause();
      if (this._onVideoError) {
        this.video.removeEventListener('error', this._onVideoError);
        this._onVideoError = null;
      }
      if (this._onVideoPlaying) {
        this.video.removeEventListener('playing', this._onVideoPlaying);
        this._onVideoPlaying = null;
      }
      this.video.removeAttribute('src');
      if (this.video.load) {
        this.video.load();
      }
      this.video = null;
    }
    this.playing = false;
  }

  dispose() {
    this.stop();
  }
}
