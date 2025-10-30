class VRConfigManager {
  constructor(options = {}) {
    this.options = {
      sourceOrder: options.sourceOrder || ['env', 'localStorage', 'defaults'],
      enableValidation: options.enableValidation !== false,
      namespace: options.namespace || 'vr',
      logger: options.logger || null,
      ...options
    };
    this.config = {};
    this.schema = {};
    this.features = {};
    this.environment = 'production';
    this.initialized = false;
  }

  async initialize() {
    this.environment = this.getEnvironment();
    this.loadDefaults();
    this.loadFromEnvironment();
    this.loadFromLocalStorage();
    this.validateConfig();
    this.initialized = true;
  }

  loadDefaults() {
    this.config = {
      performanceFps: 90,
      performanceMinFps: 72,
      memoryLimitMb: 2048,
      enableSimd: true,
      enableDashboard: true,
      enableLogging: true,
      enableRemoteLogging: false,
      gestureConfidenceThreshold: 0.8,
      macroMaxLength: 20,
      storageType: 'localStorage',
      cacheSize: 512,
      enableOffline: true,
      enableAnalytics: false,
      analyticsEndpoint: '',
      supportedDevices: ['quest2', 'quest3', 'pico4'],
      theme: 'dark',
      language: 'en'
    };
  }

  loadFromEnvironment() {
    for (let key of Object.keys(this.config)) {
      const envKey = 'VR_' + key.toUpperCase().replace(/([A-Z])/g, '_$1');
      const val = window[envKey];
      if (val !== undefined) {
        if (val === 'true' || val === 'false') {
          this.config[key] = val === 'true';
        } else {
          this.config[key] = isNaN(val) ? val : Number(val);
        }
      }
    }
  }

  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(this.options.namespace + '_config');
      if (stored) {
        const data = JSON.parse(stored);
        Object.assign(this.config, data);
      }
    } catch (error) {
      this.log('warn', 'Failed to load localStorage config', { error: error.message });
    }
  }

  registerSchema(key, schema) {
    this.schema[key] = schema;
  }

  validateConfig() {
    for (let key of Object.keys(this.schema)) {
      const value = this.config[key];
      const schemaObj = this.schema[key];
      if (value === undefined && !schemaObj.required) continue;
      if (typeof value !== schemaObj.type) {
        this.log('error', 'Config validation failed', { key, expected: schemaObj.type, got: typeof value });
      }
    }
  }

  getConfig(key, defaultValue = null) {
    return this.config[key] === undefined ? defaultValue : this.config[key];
  }

  setConfig(key, value) {
    this.config[key] = value;
    this.saveToLocalStorage();
  }

  getAllConfig() {
    return { ...this.config };
  }

  registerFeature(name, enabled = false) {
    this.features[name] = { enabled, createdAt: Date.now() };
  }

  enableFeature(name) {
    if (this.features[name]) {
      this.features[name].enabled = true;
      this.log('info', 'Feature enabled', { feature: name });
    }
  }

  disableFeature(name) {
    if (this.features[name]) {
      this.features[name].enabled = false;
      this.log('info', 'Feature disabled', { feature: name });
    }
  }

  isFeatureEnabled(name) {
    return this.features[name] && this.features[name].enabled;
  }

  toggleFeature(name) {
    if (this.isFeatureEnabled(name)) {
      this.disableFeature(name);
    } else {
      this.enableFeature(name);
    }
  }

  getFeatureStatus() {
    return { ...this.features };
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem(
        this.options.namespace + '_config',
        JSON.stringify(this.config)
      );
    } catch (error) {
      this.log('warn', 'Failed to save config', { error: error.message });
    }
  }

  exportConfig() {
    return JSON.stringify({
      config: this.config,
      features: this.features,
      timestamp: Date.now()
    }, null, 2);
  }

  importConfig(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      Object.assign(this.config, data.config);
      Object.assign(this.features, data.features);
      this.saveToLocalStorage();
    } catch (error) {
      this.log('error', 'Import failed', { error: error.message });
    }
  }

  getEnvironment() {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'development';
    if (window.VR_ENV === 'staging') return 'staging';
    return 'production';
  }

  isProd() { return this.environment === 'production'; }
  isDev() { return this.environment === 'development'; }
  isStaging() { return this.environment === 'staging'; }

  log(level, message, context = {}) {
    if (this.options.logger) {
      this.options.logger[level](message, context);
    }
  }
}

if (typeof window !== 'undefined') {
  window.VRConfigManager = VRConfigManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRConfigManager;
}
