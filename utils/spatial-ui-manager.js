/**
 * Spatial UI Manager for VR
 *
 * 3D user interface management based on 2025 spatial design best practices.
 *
 * Key Principles (2025 Research):
 * - Ergonomic zones: 0.5-3 meters from user
 * - 60° field of view (reduce neck strain)
 * - Layered spatial UI (3D panels, curved canvases)
 * - Anchored vs Floating UI
 * - Affordances for intuitive interaction
 * - Large sans-serif fonts, high contrast
 * - Accessibility modes (seated/standing/dynamic)
 *
 * @see https://www.interaction-design.org/literature/article/spatial-ui-design-tips-and-best-practices
 * @see https://viartisan.com/2025/05/28/3d-ui-ux-design/
 */

const EventEmitter = require('events');

class SpatialUIManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      // Ergonomic zones
      minDistance: options.minDistance || 0.5, // meters
      maxDistance: options.maxDistance || 3.0,
      optimalDistance: options.optimalDistance || 1.5,

      // Field of view
      maxHorizontalAngle: options.maxHorizontalAngle || 30, // degrees
      maxVerticalAngle: options.maxVerticalAngle || 20,

      // UI types
      defaultUIType: options.defaultUIType || 'floating', // floating, anchored
      enableCurvedPanels: options.enableCurvedPanels !== false,
      panelCurvature: options.panelCurvature || 0.1,

      // Typography
      baseFontSize: options.baseFontSize || 0.05, // meters
      fontFamily: options.fontFamily || 'sans-serif',
      textContrast: options.textContrast || 0.9,

      // Comfort
      userMode: options.userMode || 'seated', // seated, standing, dynamic

      ...options
    };

    // UI elements
    this.uiElements = new Map();
    this.floatingPanels = new Map();
    this.anchoredPanels = new Map();

    // User tracking
    this.userPosition = { x: 0, y: 1.6, z: 0 }; // Default standing height
    this.userOrientation = { x: 0, y: 0, z: 0, w: 1 };

    // Statistics
    this.stats = {
      uiElementCount: 0,
      floatingPanelCount: 0,
      anchoredPanelCount: 0,
      interactionsPerMinute: 0
    };
  }

  /**
   * Create UI panel
   */
  createPanel(id, config) {
    const panel = {
      id,
      type: config.type || this.options.defaultUIType,
      position: config.position || this.calculateOptimalPosition(),
      width: config.width || 1.0,
      height: config.height || 0.6,
      curved: config.curved !== false && this.options.enableCurvedPanels,
      content: config.content || '',
      visible: config.visible !== false,
      followUser: config.followUser || false,
      ...config
    };

    this.uiElements.set(id, panel);

    if (panel.type === 'floating') {
      this.floatingPanels.set(id, panel);
    } else {
      this.anchoredPanels.set(id, panel);
    }

    this.stats.uiElementCount++;
    this.emit('panelCreated', { id, panel });

    return panel;
  }

  /**
   * Calculate optimal position for UI
   */
  calculateOptimalPosition() {
    // Position UI in front of user at optimal distance
    return {
      x: this.userPosition.x,
      y: this.userPosition.y,
      z: this.userPosition.z - this.options.optimalDistance
    };
  }

  /**
   * Update user position
   */
  updateUserPosition(position, orientation) {
    this.userPosition = position;
    this.userOrientation = orientation;

    // Update floating panels to follow user
    for (const [id, panel] of this.floatingPanels) {
      if (panel.followUser) {
        panel.position = this.calculateOptimalPosition();
      }
    }

    this.emit('userPositionUpdated', { position, orientation });
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      uiElementCount: this.uiElements.size,
      floatingPanelCount: this.floatingPanels.size,
      anchoredPanelCount: this.anchoredPanels.size
    };
  }
}

module.exports = SpatialUIManager;
