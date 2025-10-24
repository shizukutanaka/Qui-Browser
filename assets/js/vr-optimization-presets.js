/**
 * VR Optimization Presets System
 * デバイスとシーンに応じた最適化プリセット
 *
 * Provides optimized configurations for:
 * - Different VR devices (Quest 2, Quest 3, Pico 4, etc.)
 * - Different scene types (browsing, gaming, video, etc.)
 * - Performance targets (quality, balanced, performance)
 *
 * @version 1.0.0
 */

class VROptimizationPresets {
  constructor() {
    // Device profiles
    this.deviceProfiles = {
      'meta-quest-2': {
        name: 'Meta Quest 2',
        gpu: 'Adreno 650',
        cpu: 'Snapdragon XR2',
        targetFPS: 90,
        minFPS: 72,
        maxMemory: 2048, // MB
        capabilities: {
          ffrSupported: true,
          multiviewSupported: true,
          msaaMax: 4,
          textureCompression: ['bc', 'astc'],
          maxTextureSize: 4096
        },
        recommendedSettings: {
          ffr: 0.5,
          multiview: true,
          msaa: 2,
          shadows: 'medium',
          postProcessing: 'minimal'
        }
      },
      'meta-quest-3': {
        name: 'Meta Quest 3',
        gpu: 'Adreno 740',
        cpu: 'Snapdragon XR2 Gen 2',
        targetFPS: 90,
        minFPS: 72,
        maxMemory: 3072, // MB
        capabilities: {
          ffrSupported: true,
          multiviewSupported: true,
          msaaMax: 8,
          textureCompression: ['bc', 'astc', 'etc2'],
          maxTextureSize: 8192
        },
        recommendedSettings: {
          ffr: 0.4,
          multiview: true,
          msaa: 4,
          shadows: 'high',
          postProcessing: 'medium'
        }
      },
      'meta-quest-pro': {
        name: 'Meta Quest Pro',
        gpu: 'Adreno 650',
        cpu: 'Snapdragon XR2+',
        targetFPS: 90,
        minFPS: 72,
        maxMemory: 2560, // MB
        capabilities: {
          ffrSupported: true,
          multiviewSupported: true,
          msaaMax: 4,
          textureCompression: ['bc', 'astc'],
          maxTextureSize: 4096,
          eyeTracking: true
        },
        recommendedSettings: {
          ffr: 0.3,
          multiview: true,
          msaa: 4,
          shadows: 'high',
          postProcessing: 'medium'
        }
      },
      'pico-4': {
        name: 'Pico 4',
        gpu: 'Adreno 650',
        cpu: 'Snapdragon XR2',
        targetFPS: 90,
        minFPS: 72,
        maxMemory: 2048, // MB
        capabilities: {
          ffrSupported: true,
          multiviewSupported: true,
          msaaMax: 4,
          textureCompression: ['bc', 'astc'],
          maxTextureSize: 4096
        },
        recommendedSettings: {
          ffr: 0.5,
          multiview: true,
          msaa: 2,
          shadows: 'medium',
          postProcessing: 'minimal'
        }
      },
      'generic': {
        name: 'Generic VR Device',
        gpu: 'Unknown',
        cpu: 'Unknown',
        targetFPS: 72,
        minFPS: 60,
        maxMemory: 1024, // MB
        capabilities: {
          ffrSupported: false,
          multiviewSupported: false,
          msaaMax: 2,
          textureCompression: ['bc'],
          maxTextureSize: 2048
        },
        recommendedSettings: {
          ffr: 0,
          multiview: false,
          msaa: 0,
          shadows: 'low',
          postProcessing: 'none'
        }
      }
    };

    // Scene type presets
    this.scenePresets = {
      'browsing': {
        name: 'Web Browsing',
        description: 'Optimized for general web browsing',
        settings: {
          ffr: 0.5,
          textQuality: 'high',
          imageQuality: 'medium',
          maxTabs: 10,
          prefetchEnabled: true,
          caching: 'aggressive'
        }
      },
      'video': {
        name: 'Video Watching',
        description: '360/180 video playback',
        settings: {
          ffr: 0.3,
          videoQuality: 'high',
          audioBitrate: 256,
          adaptiveBitrate: true,
          spatialAudio: true
        }
      },
      'gaming': {
        name: '3D Gaming',
        description: 'Interactive 3D content',
        settings: {
          ffr: 0.6,
          physicsQuality: 'high',
          particleLimit: 1000,
          lodEnabled: true,
          instanceLimit: 5000
        }
      },
      'reading': {
        name: 'Text Reading',
        description: 'Reading documents/articles',
        settings: {
          ffr: 0.2,
          textQuality: 'maximum',
          fontRendering: 'subpixel',
          lineSpacing: 1.5,
          captionsEnabled: true
        }
      },
      'social': {
        name: 'Social VR',
        description: 'Multi-user experiences',
        settings: {
          ffr: 0.5,
          avatarQuality: 'medium',
          voiceChat: true,
          spatialAudio: true,
          maxUsers: 16
        }
      }
    };

    // Performance mode presets
    this.performanceModes = {
      'maximum-quality': {
        name: 'Maximum Quality',
        description: 'Best visual quality, may reduce FPS',
        settings: {
          ffrLevel: 0.2,
          msaa: 8,
          shadows: 'ultra',
          postProcessing: 'full',
          textureQuality: 'max',
          lodBias: 2.0,
          drawDistance: 'far'
        },
        targetFPS: 72,
        minDeviceGrade: 'high'
      },
      'balanced': {
        name: 'Balanced',
        description: 'Balance between quality and performance',
        settings: {
          ffrLevel: 0.5,
          msaa: 4,
          shadows: 'high',
          postProcessing: 'medium',
          textureQuality: 'high',
          lodBias: 1.0,
          drawDistance: 'medium'
        },
        targetFPS: 90,
        minDeviceGrade: 'medium'
      },
      'maximum-performance': {
        name: 'Maximum Performance',
        description: 'Highest FPS, reduced visual quality',
        settings: {
          ffrLevel: 0.8,
          msaa: 2,
          shadows: 'low',
          postProcessing: 'minimal',
          textureQuality: 'medium',
          lodBias: 0.5,
          drawDistance: 'near'
        },
        targetFPS: 120,
        minDeviceGrade: 'low'
      },
      'battery-saver': {
        name: 'Battery Saver',
        description: 'Extend battery life',
        settings: {
          ffrLevel: 0.7,
          msaa: 0,
          shadows: 'off',
          postProcessing: 'none',
          textureQuality: 'low',
          lodBias: 0.3,
          drawDistance: 'near',
          targetFPS: 72
        },
        targetFPS: 72,
        minDeviceGrade: 'low'
      }
    };

    // Current configuration
    this.currentConfig = {
      device: null,
      sceneType: 'browsing',
      performanceMode: 'balanced',
      customSettings: {}
    };

    console.info('[OptimizationPresets] Optimization Presets System initialized');
  }

  /**
   * Auto-detect device
   * @returns {string} Device ID
   */
  autoDetectDevice() {
    // Try to detect from user agent or WebXR info
    const ua = navigator.userAgent.toLowerCase();

    if (ua.includes('quest 3')) {
      return 'meta-quest-3';
    } else if (ua.includes('quest pro')) {
      return 'meta-quest-pro';
    } else if (ua.includes('quest 2') || ua.includes('quest')) {
      return 'meta-quest-2';
    } else if (ua.includes('pico')) {
      return 'pico-4';
    }

    // Generic fallback
    return 'generic';
  }

  /**
   * Set device profile
   * @param {string} deviceId - Device ID or 'auto'
   */
  setDevice(deviceId) {
    if (deviceId === 'auto') {
      deviceId = this.autoDetectDevice();
      console.info(`[OptimizationPresets] Auto-detected device: ${deviceId}`);
    }

    if (!this.deviceProfiles[deviceId]) {
      console.warn(`[OptimizationPresets] Unknown device: ${deviceId}, using generic`);
      deviceId = 'generic';
    }

    this.currentConfig.device = deviceId;
    console.info(`[OptimizationPresets] Device set to: ${this.deviceProfiles[deviceId].name}`);
  }

  /**
   * Set scene type
   * @param {string} sceneType - Scene type
   */
  setSceneType(sceneType) {
    if (!this.scenePresets[sceneType]) {
      console.warn(`[OptimizationPresets] Unknown scene type: ${sceneType}`);
      return;
    }

    this.currentConfig.sceneType = sceneType;
    console.info(`[OptimizationPresets] Scene type set to: ${this.scenePresets[sceneType].name}`);
  }

  /**
   * Set performance mode
   * @param {string} mode - Performance mode
   */
  setPerformanceMode(mode) {
    if (!this.performanceModes[mode]) {
      console.warn(`[OptimizationPresets] Unknown performance mode: ${mode}`);
      return;
    }

    this.currentConfig.performanceMode = mode;
    console.info(`[OptimizationPresets] Performance mode set to: ${this.performanceModes[mode].name}`);
  }

  /**
   * Get optimized configuration
   * @returns {Object} Optimized settings
   */
  getOptimizedConfig() {
    const deviceId = this.currentConfig.device || this.autoDetectDevice();
    const device = this.deviceProfiles[deviceId];
    const scene = this.scenePresets[this.currentConfig.sceneType];
    const perfMode = this.performanceModes[this.currentConfig.performanceMode];

    // Merge settings with priority: custom > perfMode > scene > device
    const config = {
      device: {
        name: device.name,
        targetFPS: device.targetFPS,
        minFPS: device.minFPS,
        maxMemory: device.maxMemory
      },
      rendering: {
        ffr: this.selectBestValue([
          this.currentConfig.customSettings.ffr,
          perfMode.settings.ffrLevel,
          scene.settings.ffr,
          device.recommendedSettings.ffr
        ]),
        multiview: device.capabilities.multiviewSupported && device.recommendedSettings.multiview,
        msaa: Math.min(
          perfMode.settings.msaa || 2,
          device.capabilities.msaaMax
        ),
        shadows: perfMode.settings.shadows,
        postProcessing: perfMode.settings.postProcessing,
        textureQuality: perfMode.settings.textureQuality
      },
      scene: {
        type: this.currentConfig.sceneType,
        ...scene.settings
      },
      performance: {
        mode: this.currentConfig.performanceMode,
        targetFPS: perfMode.targetFPS,
        lodBias: perfMode.settings.lodBias,
        drawDistance: perfMode.settings.drawDistance
      },
      capabilities: device.capabilities
    };

    return config;
  }

  /**
   * Select best value from array (first non-null/undefined)
   * @param {Array} values - Values to choose from
   * @returns {any} First valid value
   */
  selectBestValue(values) {
    for (const value of values) {
      if (value !== null && value !== undefined) {
        return value;
      }
    }
    return values[values.length - 1];
  }

  /**
   * Apply configuration to VR systems
   * @param {VRSystemIntegrator} vrIntegrator - VR system integrator
   */
  applyConfiguration(vrIntegrator) {
    if (!vrIntegrator) {
      console.warn('[OptimizationPresets] No VR integrator provided');
      return;
    }

    const config = this.getOptimizedConfig();

    console.info('[OptimizationPresets] Applying optimized configuration...');

    // Apply FFR settings
    if (vrIntegrator.systems.ffr && config.rendering.ffr !== undefined) {
      vrIntegrator.systems.ffr.setFoveationLevel(config.rendering.ffr, 'preset');
      console.info(`  - FFR: ${config.rendering.ffr}`);
    }

    // Apply multiview (handled during initialization)
    console.info(`  - Multiview: ${config.rendering.multiview ? 'enabled' : 'disabled'}`);

    // Apply other settings...
    console.info('[OptimizationPresets] Configuration applied');

    return config;
  }

  /**
   * Get preset recommendations
   * @returns {Object} Recommendations
   */
  getRecommendations() {
    const deviceId = this.currentConfig.device || this.autoDetectDevice();
    const device = this.deviceProfiles[deviceId];

    const recommendations = [];

    // Device-specific recommendations
    if (deviceId === 'meta-quest-2') {
      recommendations.push({
        type: 'device',
        priority: 'high',
        message: 'Quest 2: Enable FFR 0.5+ for best performance'
      });
    } else if (deviceId === 'meta-quest-3') {
      recommendations.push({
        type: 'device',
        priority: 'info',
        message: 'Quest 3: Can handle higher quality settings'
      });
    }

    // Scene-specific recommendations
    if (this.currentConfig.sceneType === 'reading') {
      recommendations.push({
        type: 'scene',
        priority: 'high',
        message: 'Reading: Keep FFR low (<0.3) for text clarity'
      });
    } else if (this.currentConfig.sceneType === 'gaming') {
      recommendations.push({
        type: 'scene',
        priority: 'medium',
        message: 'Gaming: Enable instancing for repeated objects'
      });
    }

    // Performance mode recommendations
    if (this.currentConfig.performanceMode === 'maximum-quality') {
      recommendations.push({
        type: 'performance',
        priority: 'warning',
        message: 'Maximum Quality may not achieve 90 FPS target'
      });
    }

    return recommendations;
  }

  /**
   * Get all device profiles
   * @returns {Object} Device profiles
   */
  getDeviceProfiles() {
    return this.deviceProfiles;
  }

  /**
   * Get all scene presets
   * @returns {Object} Scene presets
   */
  getScenePresets() {
    return this.scenePresets;
  }

  /**
   * Get all performance modes
   * @returns {Object} Performance modes
   */
  getPerformanceModes() {
    return this.performanceModes;
  }

  /**
   * Export configuration
   * @returns {string} JSON configuration
   */
  exportConfig() {
    const config = this.getOptimizedConfig();
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration
   * @param {string} jsonConfig - JSON configuration
   */
  importConfig(jsonConfig) {
    try {
      const config = JSON.parse(jsonConfig);
      this.currentConfig.customSettings = config;
      console.info('[OptimizationPresets] Configuration imported');
    } catch (error) {
      console.error('[OptimizationPresets] Failed to import config:', error);
    }
  }

  /**
   * Get usage example
   * @returns {string} Code example
   */
  static getUsageExample() {
    return `
// Initialize presets system
const presets = new VROptimizationPresets();

// Auto-detect device
presets.setDevice('auto'); // Detects Quest 2, Quest 3, Pico 4, etc.

// Or manually set device
presets.setDevice('meta-quest-2');

// Set scene type
presets.setSceneType('browsing'); // 'browsing', 'video', 'gaming', 'reading', 'social'

// Set performance mode
presets.setPerformanceMode('balanced'); // 'maximum-quality', 'balanced', 'maximum-performance', 'battery-saver'

// Get optimized configuration
const config = presets.getOptimizedConfig();
console.log('Optimized config:', config);

// Apply to VR systems
presets.applyConfiguration(vrIntegrator);

// Get recommendations
const recommendations = presets.getRecommendations();
recommendations.forEach(rec => {
  console.log(\`[\${rec.priority}] \${rec.message}\`);
});

// Export configuration
const jsonConfig = presets.exportConfig();
localStorage.setItem('vr-config', jsonConfig);

// Import configuration
const savedConfig = localStorage.getItem('vr-config');
if (savedConfig) {
  presets.importConfig(savedConfig);
}
`;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VROptimizationPresets;
}

// Global instance
window.VROptimizationPresets = VROptimizationPresets;

console.info('[OptimizationPresets] VR Optimization Presets System loaded');
