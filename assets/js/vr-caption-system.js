/**
 * VR Caption System
 * WCAG AAA準拠のキャプションシステム
 *
 * 2025年のMetaアクセシビリティガイドラインに基づく
 * - Head-locked captions (時間制約のある情報に最適)
 * - Fixed captions (ユーザーの注意を特定の場所に向けるのに最適)
 * - 視野角40度内の配置
 * - ユーザーがカスタマイズ可能
 *
 * Based on Meta Accessibility Guidelines (2025)
 * @see https://developers.meta.com/horizon/design/accessibility/
 * @version 1.0.0
 */

class VRCaptionSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.enabled = false;

    // Caption instances
    this.captions = new Map();
    this.activeCaptions = new Set();

    // Configuration
    this.config = {
      // Caption positioning
      defaultDistance: 1.0, // meters from camera (starting point)
      minDistance: 0.5,
      maxDistance: 5.0,
      verticalOffset: -0.3, // meters (negative = below center)
      fovAngle: 40, // degrees (WCAG recommendation)

      // Caption types
      defaultType: 'head-locked', // 'head-locked' or 'fixed'

      // Visual styling
      fontSize: 0.05, // meters (approximately 48px at 1m)
      fontFamily: 'Arial, sans-serif',
      textColor: '#FFFFFF',
      backgroundColor: '#000000',
      backgroundOpacity: 0.8,
      padding: 0.02, // meters
      borderRadius: 0.01,

      // Size options
      sizes: {
        small: 0.04,
        medium: 0.05,
        large: 0.06
      },

      // Position options
      positions: {
        top: { vertical: 0.3, angle: 20 }, // degrees from center
        bottom: { vertical: -0.3, angle: -20 }
      },

      // Contrast ratios (WCAG AAA)
      contrastRatio: 7.0,

      // Animation
      fadeInDuration: 0.3, // seconds
      fadeOutDuration: 0.2,

      // Multi-line support
      maxLineWidth: 40, // characters
      lineHeight: 1.2,

      // Update frequency
      updateFrequency: 30 // Hz (for head-locked captions)
    };

    // Caption styles/themes
    this.themes = {
      default: {
        textColor: '#FFFFFF',
        backgroundColor: '#000000',
        backgroundOpacity: 0.8
      },
      'high-contrast-dark': {
        textColor: '#FFFFFF',
        backgroundColor: '#000000',
        backgroundOpacity: 1.0
      },
      'high-contrast-light': {
        textColor: '#000000',
        backgroundColor: '#FFFFFF',
        backgroundOpacity: 1.0
      },
      'yellow-black': {
        textColor: '#000000',
        backgroundColor: '#FFFF00',
        backgroundOpacity: 0.9
      }
    };

    this.currentTheme = 'default';

    // Performance metrics
    this.metrics = {
      activeCaptionsCount: 0,
      updateCount: 0,
      lastUpdateTime: 0
    };

    // Update interval for head-locked captions
    this.updateInterval = null;

    console.info('[CaptionSystem] VR Caption System initialized');
  }

  /**
   * Initialize caption system
   * @returns {boolean} Success status
   */
  initialize() {
    try {
      // Setup update loop for head-locked captions
      const updateInterval = 1000 / this.config.updateFrequency;
      this.updateInterval = setInterval(() => {
        this.updateHeadLockedCaptions();
      }, updateInterval);

      this.enabled = true;
      console.info('[CaptionSystem] Caption system initialized');
      return true;

    } catch (error) {
      console.error('[CaptionSystem] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Create a new caption
   * @param {string} id - Unique caption ID
   * @param {string} text - Caption text
   * @param {Object} options - Caption options
   * @returns {Object} Caption object
   */
  createCaption(id, text, options = {}) {
    if (this.captions.has(id)) {
      console.warn(`[CaptionSystem] Caption already exists: ${id}`);
      return this.captions.get(id);
    }

    const type = options.type || this.config.defaultType;
    const size = options.size || 'medium';
    const position = options.position || 'bottom';

    // Create caption object
    const caption = {
      id,
      text,
      type, // 'head-locked' or 'fixed'
      size,
      position,
      visible: false,
      opacity: 0,
      distance: options.distance || this.config.defaultDistance,

      // For fixed captions
      worldPosition: options.worldPosition || null,

      // For head-locked captions
      localPosition: this.calculateLocalPosition(position, this.config.defaultDistance),

      // Three.js objects
      mesh: null,
      canvas: null,
      texture: null,
      material: null,

      // Animation
      fadeAnimation: null,
      targetOpacity: 0,

      // Metadata
      createdAt: Date.now(),
      displayedAt: null
    };

    // Create Three.js mesh for caption
    this.createCaptionMesh(caption);

    this.captions.set(id, caption);

    console.info(`[CaptionSystem] Caption created: ${id} (${type})`);
    return caption;
  }

  /**
   * Create Three.js mesh for caption
   * @param {Object} caption - Caption object
   */
  createCaptionMesh(caption) {
    // Create canvas for text rendering
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // Calculate canvas size
    const fontSize = this.config.sizes[caption.size];
    const maxWidth = this.config.maxLineWidth;
    const lines = this.wrapText(caption.text, maxWidth);

    // Set canvas dimensions (high resolution for clarity)
    const scale = 4; // Higher resolution
    canvas.width = 1024 * scale;
    canvas.height = (128 * lines.length) * scale;

    // Get theme
    const theme = this.themes[this.currentTheme];

    // Draw background
    context.fillStyle = theme.backgroundColor;
    context.globalAlpha = theme.backgroundOpacity;
    const borderRadius = this.config.borderRadius * 1000 * scale;
    this.roundRect(
      context,
      0, 0,
      canvas.width, canvas.height,
      borderRadius
    );
    context.fill();
    context.globalAlpha = 1.0;

    // Draw text
    context.fillStyle = theme.textColor;
    context.font = `${60 * scale}px ${this.config.fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    const lineHeightPx = 80 * scale * this.config.lineHeight;
    const startY = canvas.height / 2 - (lines.length - 1) * lineHeightPx / 2;

    for (let i = 0; i < lines.length; i++) {
      context.fillText(
        lines[i],
        canvas.width / 2,
        startY + i * lineHeightPx
      );
    }

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Create material
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false
    });

    // Create geometry
    const aspect = canvas.width / canvas.height;
    const height = fontSize * lines.length * this.config.lineHeight;
    const width = height * aspect;

    const geometry = new THREE.PlaneGeometry(width, height);

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 999; // Render on top

    // Store references
    caption.canvas = canvas;
    caption.texture = texture;
    caption.material = material;
    caption.mesh = mesh;

    // Position based on type
    if (caption.type === 'head-locked') {
      // Head-locked: add to camera
      this.camera.add(mesh);
      mesh.position.copy(caption.localPosition);
      mesh.rotation.set(0, 0, 0);
    } else {
      // Fixed: add to scene
      this.scene.add(mesh);
      if (caption.worldPosition) {
        mesh.position.copy(caption.worldPosition);
        mesh.lookAt(this.camera.position);
      }
    }
  }

  /**
   * Calculate local position for head-locked caption
   * @param {string} position - Position ('top' or 'bottom')
   * @param {number} distance - Distance from camera
   * @returns {THREE.Vector3} Local position
   */
  calculateLocalPosition(position, distance) {
    const posConfig = this.config.positions[position];
    const verticalOffset = posConfig.vertical;

    // Position in front of camera, slightly below/above center
    return new THREE.Vector3(0, verticalOffset, -distance);
  }

  /**
   * Wrap text into multiple lines
   * @param {string} text - Text to wrap
   * @param {number} maxWidth - Max characters per line
   * @returns {Array<string>} Lines
   */
  wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;

      if (testLine.length > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [text];
  }

  /**
   * Draw rounded rectangle
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Width
   * @param {number} height - Height
   * @param {number} radius - Border radius
   */
  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Show caption
   * @param {string} id - Caption ID
   * @param {number} duration - Display duration (seconds, 0 = infinite)
   */
  show(id, duration = 0) {
    const caption = this.captions.get(id);
    if (!caption) {
      console.warn(`[CaptionSystem] Caption not found: ${id}`);
      return;
    }

    // Fade in
    this.fadeCaption(caption, 1.0, this.config.fadeInDuration);

    caption.visible = true;
    caption.displayedAt = Date.now();
    this.activeCaptions.add(id);

    this.metrics.activeCaptionsCount++;

    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        this.hide(id);
      }, duration * 1000);
    }

    console.info(`[CaptionSystem] Caption shown: ${id}`);
  }

  /**
   * Hide caption
   * @param {string} id - Caption ID
   */
  hide(id) {
    const caption = this.captions.get(id);
    if (!caption || !caption.visible) {
      return;
    }

    // Fade out
    this.fadeCaption(caption, 0, this.config.fadeOutDuration, () => {
      caption.visible = false;
      this.activeCaptions.delete(id);
      this.metrics.activeCaptionsCount--;
    });

    console.info(`[CaptionSystem] Caption hidden: ${id}`);
  }

  /**
   * Fade caption
   * @param {Object} caption - Caption object
   * @param {number} targetOpacity - Target opacity (0-1)
   * @param {number} duration - Duration (seconds)
   * @param {Function} onComplete - Completion callback
   */
  fadeCaption(caption, targetOpacity, duration, onComplete = null) {
    if (caption.fadeAnimation) {
      cancelAnimationFrame(caption.fadeAnimation);
    }

    const startOpacity = caption.opacity;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = (currentTime - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1.0);

      // Ease in-out
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      caption.opacity = startOpacity + (targetOpacity - startOpacity) * eased;
      caption.material.opacity = caption.opacity;

      if (progress < 1.0) {
        caption.fadeAnimation = requestAnimationFrame(animate);
      } else {
        caption.fadeAnimation = null;
        if (onComplete) {
          onComplete();
        }
      }
    };

    caption.fadeAnimation = requestAnimationFrame(animate);
  }

  /**
   * Update head-locked captions position
   * Called automatically at configured frequency
   */
  updateHeadLockedCaptions() {
    if (!this.enabled) {
      return;
    }

    const now = performance.now();

    for (const [id, caption] of this.captions) {
      if (caption.type === 'head-locked' && caption.visible) {
        // Head-locked captions are attached to camera,
        // so they automatically follow. Just ensure proper rotation.
        if (caption.mesh) {
          caption.mesh.rotation.set(0, 0, 0);
        }

        this.metrics.updateCount++;
      }
    }

    this.metrics.lastUpdateTime = now;
  }

  /**
   * Update caption text
   * @param {string} id - Caption ID
   * @param {string} newText - New text
   */
  updateText(id, newText) {
    const caption = this.captions.get(id);
    if (!caption) {
      return;
    }

    caption.text = newText;

    // Recreate mesh with new text
    const wasVisible = caption.visible;
    this.removeCaption(id);

    const newCaption = this.createCaption(id, newText, {
      type: caption.type,
      size: caption.size,
      position: caption.position,
      distance: caption.distance,
      worldPosition: caption.worldPosition
    });

    if (wasVisible) {
      this.show(id);
    }
  }

  /**
   * Set caption distance
   * @param {string} id - Caption ID
   * @param {number} distance - Distance in meters
   */
  setDistance(id, distance) {
    const caption = this.captions.get(id);
    if (!caption || caption.type !== 'head-locked') {
      return;
    }

    distance = Math.max(this.config.minDistance, Math.min(this.config.maxDistance, distance));
    caption.distance = distance;

    // Update position
    caption.localPosition = this.calculateLocalPosition(caption.position, distance);
    if (caption.mesh) {
      caption.mesh.position.copy(caption.localPosition);
    }

    console.info(`[CaptionSystem] Caption ${id} distance set to ${distance}m`);
  }

  /**
   * Set caption theme
   * @param {string} themeName - Theme name
   */
  setTheme(themeName) {
    if (!this.themes[themeName]) {
      console.warn(`[CaptionSystem] Unknown theme: ${themeName}`);
      return;
    }

    this.currentTheme = themeName;

    // Recreate all captions with new theme
    const captionsToUpdate = Array.from(this.captions.keys());
    for (const id of captionsToUpdate) {
      const caption = this.captions.get(id);
      const wasVisible = caption.visible;

      this.removeCaption(id);
      this.createCaption(id, caption.text, {
        type: caption.type,
        size: caption.size,
        position: caption.position,
        distance: caption.distance,
        worldPosition: caption.worldPosition
      });

      if (wasVisible) {
        this.show(id);
      }
    }

    console.info(`[CaptionSystem] Theme changed to: ${themeName}`);
  }

  /**
   * Remove caption
   * @param {string} id - Caption ID
   */
  removeCaption(id) {
    const caption = this.captions.get(id);
    if (!caption) {
      return;
    }

    // Remove from scene/camera
    if (caption.mesh) {
      if (caption.type === 'head-locked') {
        this.camera.remove(caption.mesh);
      } else {
        this.scene.remove(caption.mesh);
      }

      // Dispose resources
      if (caption.texture) {
        caption.texture.dispose();
      }
      if (caption.material) {
        caption.material.dispose();
      }
      if (caption.mesh.geometry) {
        caption.mesh.geometry.dispose();
      }
    }

    this.captions.delete(id);
    this.activeCaptions.delete(id);

    console.info(`[CaptionSystem] Caption removed: ${id}`);
  }

  /**
   * Get caption info
   * @param {string} id - Caption ID
   * @returns {Object} Caption information
   */
  getCaptionInfo(id) {
    const caption = this.captions.get(id);
    if (!caption) {
      return null;
    }

    return {
      id: caption.id,
      text: caption.text,
      type: caption.type,
      size: caption.size,
      position: caption.position,
      visible: caption.visible,
      opacity: caption.opacity,
      distance: caption.distance,
      displayedAt: caption.displayedAt
    };
  }

  /**
   * Get metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      totalCaptions: this.captions.size
    };
  }

  /**
   * Enable caption system
   */
  enable() {
    this.enabled = true;
    console.info('[CaptionSystem] Enabled');
  }

  /**
   * Disable caption system
   */
  disable() {
    this.enabled = false;
    console.info('[CaptionSystem] Disabled');
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    // Stop update interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Remove all captions
    const captionIds = Array.from(this.captions.keys());
    for (const id of captionIds) {
      this.removeCaption(id);
    }

    this.enabled = false;
    console.info('[CaptionSystem] Disposed');
  }

  /**
   * Get usage example
   * @returns {string} Code example
   */
  static getUsageExample() {
    return `
// Initialize caption system (requires Three.js scene and camera)
const captionSystem = new VRCaptionSystem(scene, camera);
captionSystem.initialize();

// Create head-locked caption (follows user's head)
captionSystem.createCaption('subtitle-1', 'This is a head-locked caption', {
  type: 'head-locked',
  size: 'medium',
  position: 'bottom',
  distance: 1.0
});

// Show caption for 5 seconds
captionSystem.show('subtitle-1', 5);

// Create fixed caption (stays in world space)
captionSystem.createCaption('info-1', 'Click here to continue', {
  type: 'fixed',
  size: 'large',
  position: 'bottom',
  worldPosition: new THREE.Vector3(2, 1.5, -3)
});

captionSystem.show('info-1');

// Change theme for high contrast
captionSystem.setTheme('high-contrast-dark');

// Adjust distance (user preference)
captionSystem.setDistance('subtitle-1', 1.5);

// Update text dynamically
captionSystem.updateText('subtitle-1', 'New caption text');

// Hide caption
captionSystem.hide('info-1');
`;
  }

  /**
   * Get best practices
   * @returns {Array} List of recommendations
   */
  static getBestPractices() {
    return [
      {
        title: 'Use Head-Locked for Time-Sensitive Info',
        description: 'Head-locked captions are best for critical, time-sensitive information.',
        priority: 'high'
      },
      {
        title: 'Use Fixed for Directional Guidance',
        description: 'Fixed captions work well to guide user attention to specific locations.',
        priority: 'high'
      },
      {
        title: 'Start at Recommended Distance',
        description: 'Start captions at ~1 meter, but allow users to adjust (0.5-5m range).',
        priority: 'high'
      },
      {
        title: 'Place Within 40° FOV',
        description: 'Keep captions within 40 degrees of center for comfortable viewing.',
        priority: 'high'
      },
      {
        title: 'Provide Theme Options',
        description: 'Offer high-contrast themes for users with visual impairments.',
        priority: 'medium'
      },
      {
        title: 'Never Obstruct Important Content',
        description: 'Captions should overlay, not block, critical visual elements.',
        priority: 'medium'
      },
      {
        title: 'Support Multi-Line Text',
        description: 'Wrap long text automatically for readability.',
        priority: 'medium'
      }
    ];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRCaptionSystem;
}

// Global instance
window.VRCaptionSystem = VRCaptionSystem;

console.info('[CaptionSystem] VR Caption System loaded');
