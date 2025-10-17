const EventEmitter = require('events');

/**
 * Manifest Generator
 */
class ManifestGenerator {
  constructor(config = {}) {
    this.config = {
      name: 'Application',
      short_name: 'App',
      description: '',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#000000',
      orientation: 'any',
      ...config
    };
  }

  /**
   * Generate manifest
   */
  generate() {
    const manifest = {
      name: this.config.name,
      short_name: this.config.short_name,
      description: this.config.description,
      start_url: this.config.start_url,
      display: this.config.display,
      background_color: this.config.background_color,
      theme_color: this.config.theme_color,
      orientation: this.config.orientation,
      icons: this.generateIcons(),
      categories: this.config.categories || [],
      screenshots: this.config.screenshots || []
    };

    // Optional fields
    if (this.config.scope) manifest.scope = this.config.scope;
    if (this.config.lang) manifest.lang = this.config.lang;
    if (this.config.dir) manifest.dir = this.config.dir;

    return manifest;
  }

  /**
   * Generate icons array
   */
  generateIcons() {
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
    const icons = [];

    sizes.forEach((size) => {
      icons.push({
        src: `/icons/icon-${size}x${size}.png`,
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose: 'any maskable'
      });
    });

    return icons;
  }

  /**
   * Update config
   */
  updateConfig(updates) {
    Object.assign(this.config, updates);
  }

  /**
   * Get JSON string
   */
  toJSON() {
    return JSON.stringify(this.generate(), null, 2);
  }
}

/**
 * Install Prompt Manager
 */
class InstallPromptManager extends EventEmitter {
  constructor() {
    super();

    this.deferredPrompt = null;
    this.installed = false;
    this.dismissed = false;
  }

  /**
   * Capture install prompt event
   */
  capturePrompt(event) {
    // Prevent automatic prompt
    event.preventDefault();

    this.deferredPrompt = event;
    this.emit('prompt-available');
  }

  /**
   * Show install prompt
   */
  async showPrompt() {
    if (!this.deferredPrompt) {
      this.emit('error', new Error('No install prompt available'));
      return null;
    }

    // Show prompt
    this.deferredPrompt.prompt();

    // Wait for user choice
    const { outcome } = await this.deferredPrompt.userChoice;

    this.emit('prompt-result', outcome);

    if (outcome === 'accepted') {
      this.installed = true;
      this.emit('installed');
    } else {
      this.dismissed = true;
      this.emit('dismissed');
    }

    // Clear prompt
    this.deferredPrompt = null;

    return outcome;
  }

  /**
   * Check if prompt is available
   */
  isPromptAvailable() {
    return this.deferredPrompt !== null;
  }

  /**
   * Check if installed
   */
  isInstalled() {
    return this.installed;
  }
}

/**
 * Update Manager
 */
class UpdateManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      checkInterval: 3600000, // 1 hour
      autoUpdate: false,
      ...options
    };

    this.updateAvailable = false;
    this.registration = null;
    this.checkTimer = null;
  }

  /**
   * Set service worker registration
   */
  setRegistration(registration) {
    this.registration = registration;

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          this.updateAvailable = true;
          this.emit('update-available');

          if (this.config.autoUpdate) {
            this.applyUpdate();
          }
        }
      });
    });
  }

  /**
   * Check for updates
   */
  async checkForUpdates() {
    if (!this.registration) {
      throw new Error('No service worker registration');
    }

    try {
      await this.registration.update();
      this.emit('update-checked');
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Apply update
   */
  applyUpdate() {
    if (!this.registration || !this.registration.waiting) {
      return;
    }

    // Tell service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    this.emit('update-applied');

    // Reload page
    if (this.config.autoReload !== false) {
      window.location.reload();
    }
  }

  /**
   * Start automatic update checking
   */
  startAutoCheck() {
    if (this.checkTimer) return;

    this.checkTimer = setInterval(() => {
      this.checkForUpdates();
    }, this.config.checkInterval);
  }

  /**
   * Stop automatic update checking
   */
  stopAutoCheck() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Is update available
   */
  isUpdateAvailable() {
    return this.updateAvailable;
  }

  /**
   * Destroy manager
   */
  destroy() {
    this.stopAutoCheck();
    this.removeAllListeners();
  }
}

/**
 * Offline Manager
 */
class OfflineManager extends EventEmitter {
  constructor() {
    super();

    this.online = (typeof navigator !== 'undefined' && navigator.onLine !== undefined)
      ? navigator.onLine
      : true;
    this.setupListeners();
  }

  /**
   * Setup event listeners
   */
  setupListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.online = true;
      this.emit('online');
      this.emit('status-change', { online: true });
    });

    window.addEventListener('offline', () => {
      this.online = false;
      this.emit('offline');
      this.emit('status-change', { online: false });
    });
  }

  /**
   * Check if online
   */
  isOnline() {
    return this.online;
  }

  /**
   * Check if offline
   */
  isOffline() {
    return !this.online;
  }

  /**
   * Get network information
   */
  getNetworkInfo() {
    if (typeof navigator === 'undefined' || !navigator.connection) {
      return null;
    }

    const connection = navigator.connection;

    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }
}

/**
 * Background Sync Manager
 */
class BackgroundSyncManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      tagPrefix: 'sync-',
      ...options
    };

    this.pendingSyncs = new Map();
    this.registration = null;
  }

  /**
   * Set service worker registration
   */
  setRegistration(registration) {
    this.registration = registration;
  }

  /**
   * Register sync
   */
  async registerSync(name, data = {}) {
    if (!this.registration || !this.registration.sync) {
      throw new Error('Background Sync not supported');
    }

    const tag = `${this.config.tagPrefix}${name}`;

    try {
      await this.registration.sync.register(tag);

      this.pendingSyncs.set(tag, {
        name,
        data,
        timestamp: Date.now()
      });

      this.emit('sync-registered', { name, tag });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get pending syncs
   */
  async getPendingSyncs() {
    if (!this.registration || !this.registration.sync) {
      return [];
    }

    try {
      const tags = await this.registration.sync.getTags();
      return tags.filter((tag) => tag.startsWith(this.config.tagPrefix));
    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }

  /**
   * Clear sync
   */
  clearSync(name) {
    const tag = `${this.config.tagPrefix}${name}`;
    this.pendingSyncs.delete(tag);
    this.emit('sync-cleared', { name, tag });
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      pendingSyncs: this.pendingSyncs.size
    };
  }
}

/**
 * Push Notification Manager
 */
class PushNotificationManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      vapidPublicKey: options.vapidPublicKey,
      ...options
    };

    this.subscription = null;
    this.registration = null;
    this.permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
  }

  /**
   * Set service worker registration
   */
  setRegistration(registration) {
    this.registration = registration;
  }

  /**
   * Request permission
   */
  async requestPermission() {
    if (typeof Notification === 'undefined') {
      throw new Error('Notifications not supported');
    }

    try {
      this.permission = await Notification.requestPermission();
      this.emit('permission-changed', this.permission);
      return this.permission;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Subscribe to push
   */
  async subscribe() {
    if (!this.registration) {
      throw new Error('No service worker registration');
    }

    if (this.permission !== 'granted') {
      await this.requestPermission();
    }

    if (this.permission !== 'granted') {
      throw new Error('Permission denied');
    }

    try {
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.config.vapidPublicKey)
      });

      this.emit('subscribed', this.subscription);
      return this.subscription;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push
   */
  async unsubscribe() {
    if (!this.subscription) {
      return false;
    }

    try {
      await this.subscription.unsubscribe();
      this.subscription = null;
      this.emit('unsubscribed');
      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Get subscription
   */
  getSubscription() {
    return this.subscription;
  }

  /**
   * Convert VAPID key
   */
  urlBase64ToUint8Array(base64String) {
    if (!base64String) return null;

    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  /**
   * Destroy manager
   */
  destroy() {
    this.removeAllListeners();
  }
}

/**
 * PWA Manager
 */
class PWAManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      enableManifest: true,
      enableOffline: true,
      enableUpdates: true,
      enableBackgroundSync: true,
      enablePushNotifications: false,
      ...options
    };

    // Initialize components
    this.manifestGenerator = this.config.enableManifest
      ? new ManifestGenerator(this.config.manifest)
      : null;

    this.installPrompt = new InstallPromptManager();

    this.updateManager = this.config.enableUpdates ? new UpdateManager(this.config.updates) : null;

    this.offlineManager = this.config.enableOffline ? new OfflineManager() : null;

    this.backgroundSync = this.config.enableBackgroundSync
      ? new BackgroundSyncManager(this.config.backgroundSync)
      : null;

    this.pushNotifications = this.config.enablePushNotifications
      ? new PushNotificationManager(this.config.pushNotifications)
      : null;

    this.setupEventForwarding();
  }

  /**
   * Setup event forwarding
   */
  setupEventForwarding() {
    // Install prompt events
    this.installPrompt.on('prompt-available', () => this.emit('install:prompt-available'));
    this.installPrompt.on('installed', () => this.emit('install:installed'));
    this.installPrompt.on('dismissed', () => this.emit('install:dismissed'));

    // Update events
    if (this.updateManager) {
      this.updateManager.on('update-available', () => this.emit('update:available'));
      this.updateManager.on('update-applied', () => this.emit('update:applied'));
    }

    // Offline events
    if (this.offlineManager) {
      this.offlineManager.on('online', () => this.emit('offline:online'));
      this.offlineManager.on('offline', () => this.emit('offline:offline'));
    }

    // Push notification events
    if (this.pushNotifications) {
      this.pushNotifications.on('subscribed', (sub) => this.emit('push:subscribed', sub));
      this.pushNotifications.on('unsubscribed', () => this.emit('push:unsubscribed'));
    }
  }

  /**
   * Initialize PWA
   */
  async initialize(registration) {
    if (this.updateManager) {
      this.updateManager.setRegistration(registration);
    }

    if (this.backgroundSync) {
      this.backgroundSync.setRegistration(registration);
    }

    if (this.pushNotifications) {
      this.pushNotifications.setRegistration(registration);
    }

    this.emit('initialized');
  }

  /**
   * Generate manifest
   */
  getManifest() {
    return this.manifestGenerator ? this.manifestGenerator.generate() : null;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      installed: this.installPrompt ? this.installPrompt.isInstalled() : false,
      online: this.offlineManager ? this.offlineManager.isOnline() : true,
      updateAvailable: this.updateManager ? this.updateManager.isUpdateAvailable() : false,
      pushSubscribed: this.pushNotifications ? this.pushNotifications.getSubscription() !== null : false
    };
  }

  /**
   * Destroy manager
   */
  destroy() {
    if (this.updateManager) this.updateManager.destroy();
    if (this.offlineManager) this.offlineManager.removeAllListeners();
    if (this.backgroundSync) this.backgroundSync.removeAllListeners();
    if (this.pushNotifications) this.pushNotifications.destroy();

    this.removeAllListeners();
  }
}

module.exports = {
  ManifestGenerator,
  InstallPromptManager,
  UpdateManager,
  OfflineManager,
  BackgroundSyncManager,
  PushNotificationManager,
  PWAManager
};
