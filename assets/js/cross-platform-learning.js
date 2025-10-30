/**
 * Cross-Platform Language Learning System
 * Enables seamless learning experience across multiple devices and platforms
 */

class CrossPlatformLearningSystem {
  constructor() {
    this.syncStatus = 'disconnected';
    this.lastSync = null;
    this.pendingChanges = [];
    this.deviceId = this.generateDeviceId();
    this.platformInfo = this.getPlatformInfo();
    this.syncInterval = null;
  }

  /**
   * Initialize cross-platform learning system
   */
  async initialize() {
    console.info('🔄 Cross-Platform Learning System initialized');
    await this.setupSyncService();
    this.startAutoSync();
    this.setupOfflineSupport();
    return true;
  }

  /**
   * Setup synchronization service
   */
  async setupSyncService() {
    // Try to connect to sync service
    try {
      // In real implementation, this would connect to a backend service
      // For now, we'll use localStorage with timestamp-based conflict resolution
      this.syncStatus = 'connected';
      console.info('✅ Sync service connected');
    } catch (error) {
      this.syncStatus = 'offline';
      console.warn('⚠️ Sync service unavailable, using local storage');
    }
  }

  /**
   * Generate unique device ID
   */
  generateDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  /**
   * Get platform information
   */
  getPlatformInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync() {
    // Sync every 5 minutes when online
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && this.syncStatus === 'connected') {
        this.syncData();
      }
    }, 5 * 60 * 1000);

    // Sync when coming back online
    window.addEventListener('online', () => {
      this.syncStatus = 'connected';
      this.syncData();
    });

    // Handle going offline
    window.addEventListener('offline', () => {
      this.syncStatus = 'offline';
    });
  }

  /**
   * Sync data across devices
   */
  async syncData() {
    if (this.syncStatus !== 'connected') return;

    try {
      console.info('🔄 Syncing learning data...');

      // Prepare sync data
      const syncData = {
        deviceId: this.deviceId,
        timestamp: new Date().toISOString(),
        platform: this.platformInfo,
        learningData: {
          progress: this.getLearningProgress(),
          vocabulary: this.getVocabularyData(),
          achievements: this.getAchievementData(),
          settings: this.getSettingsData()
        },
        pendingChanges: this.pendingChanges
      };

      // Send to sync service
      const response = await this.sendToSyncService(syncData);

      if (response.success) {
        // Update local data with server response
        this.updateLocalData(response.data);

        // Clear pending changes
        this.pendingChanges = [];

        // Update last sync time
        this.lastSync = new Date().toISOString();

        console.info('✅ Data synced successfully');
      }

    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.syncStatus = 'error';
    }
  }

  /**
   * Send data to sync service
   */
  async sendToSyncService(data) {
    // In real implementation, this would send to a backend API
    // For demonstration, we'll simulate the response
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: data, // Echo back for demo
          conflicts: []
        });
      }, 1000);
    });
  }

  /**
   * Update local data with server response
   */
  updateLocalData(serverData) {
    // Merge server data with local data
    // Handle conflicts using timestamp-based resolution
    const serverTimestamp = new Date(serverData.timestamp);
    const localTimestamp = this.lastSync ? new Date(this.lastSync) : new Date(0);

    if (serverTimestamp > localTimestamp) {
      // Server data is newer, merge it
      this.mergeServerData(serverData.learningData);
    }
  }

  /**
   * Merge server data with local data
   */
  mergeServerData(serverData) {
    // Merge learning progress
    if (serverData.progress) {
      Object.keys(serverData.progress).forEach(lang => {
        if (!window.languageLearning.userProgress[lang] ||
            new Date(serverData.progress[lang].lastUpdated) >
            new Date(window.languageLearning.userProgress[lang].lastUpdated || 0)) {
          window.languageLearning.userProgress[lang] = serverData.progress[lang];
        }
      });
    }

    // Merge vocabulary
    if (serverData.vocabulary) {
      Object.keys(serverData.vocabulary).forEach(key => {
        if (!window.languageLearning.vocabulary.has(key) ||
            new Date(serverData.vocabulary[key].lastUpdated) >
            new Date(window.languageLearning.vocabulary.get(key).lastUpdated || 0)) {
          window.languageLearning.vocabulary.set(key, serverData.vocabulary[key]);
        }
      });
    }
  }

  /**
   * Get learning progress data
   */
  getLearningProgress() {
    return window.languageLearning.userProgress;
  }

  /**
   * Get vocabulary data
   */
  getVocabularyData() {
    const vocabData = {};
    window.languageLearning.vocabulary.forEach((value, key) => {
      vocabData[key] = value;
    });
    return vocabData;
  }

  /**
   * Get achievement data
   */
  getAchievementData() {
    return window.languageLearning.achievements;
  }

  /**
   * Get settings data
   */
  getSettingsData() {
    return {
      dailyGoals: window.languageLearning.dailyGoals,
      preferences: window.languageLearning.preferences,
      gamification: window.languageLearning.gamification
    };
  }

  /**
   * Setup offline support
   */
  setupOfflineSupport() {
    // Store changes locally when offline
    document.addEventListener('languageChanged', () => {
      this.queueChange('language_change', { language: i18next.language });
    });

    // Monitor learning activities
    document.addEventListener('learningActivity', (event) => {
      this.queueChange('learning_activity', event.detail);
    });

    // Sync when coming back online
    window.addEventListener('online', () => {
      if (this.pendingChanges.length > 0) {
        this.syncData();
      }
    });
  }

  /**
   * Queue change for synchronization
   */
  queueChange(type, data) {
    const change = {
      type,
      data,
      timestamp: new Date().toISOString(),
      deviceId: this.deviceId
    };

    this.pendingChanges.push(change);

    // Limit pending changes
    if (this.pendingChanges.length > 100) {
      this.pendingChanges.shift();
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      status: this.syncStatus,
      lastSync: this.lastSync,
      pendingChanges: this.pendingChanges.length,
      deviceId: this.deviceId,
      platform: this.platformInfo
    };
  }

  /**
   * Force manual sync
   */
  async forceSync() {
    this.syncStatus = 'syncing';
    await this.syncData();
    return this.getSyncStatus();
  }

  /**
   * Resolve sync conflicts
   */
  resolveConflicts(conflicts) {
    const resolutions = {};

    conflicts.forEach(conflict => {
      // Use timestamp-based resolution
      const localTime = new Date(conflict.localData.timestamp);
      const remoteTime = new Date(conflict.remoteData.timestamp);

      if (localTime > remoteTime) {
        resolutions[conflict.key] = 'local';
      } else {
        resolutions[conflict.key] = 'remote';
      }
    });

    return resolutions;
  }

  /**
   * Export data for backup or migration
   */
  exportCrossPlatformData() {
    const exportData = {
      deviceId: this.deviceId,
      platformInfo: this.platformInfo,
      learningData: {
        progress: this.getLearningProgress(),
        vocabulary: this.getVocabularyData(),
        achievements: this.getAchievementData(),
        settings: this.getSettingsData()
      },
      syncInfo: {
        lastSync: this.lastSync,
        pendingChanges: this.pendingChanges
      },
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qui-browser-cross-platform-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import data from backup
   */
  async importCrossPlatformData(file) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // Validate import data
      if (!importData.learningData) {
        throw new Error('Invalid backup file format');
      }

      // Import learning data
      if (importData.learningData.progress) {
        Object.assign(window.languageLearning.userProgress, importData.learningData.progress);
      }

      if (importData.learningData.vocabulary) {
        Object.entries(importData.learningData.vocabulary).forEach(([key, value]) => {
          window.languageLearning.vocabulary.set(key, value);
        });
      }

      if (importData.learningData.achievements) {
        window.languageLearning.achievements = importData.learningData.achievements;
      }

      // Save imported data
      window.languageLearning.saveUserProgress();
      window.languageLearning.saveVocabulary();

      console.info('✅ Cross-platform data imported successfully');
      return true;

    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    }
  }

  /**
   * Check for data conflicts
   */
  checkConflicts(localData, remoteData) {
    const conflicts = [];

    // Check progress conflicts
    Object.keys(localData.progress).forEach(lang => {
      if (remoteData.progress[lang]) {
        const localTime = new Date(localData.progress[lang].lastUpdated);
        const remoteTime = new Date(remoteData.progress[lang].lastUpdated);

        if (Math.abs(localTime - remoteTime) < 60000) { // Within 1 minute
          conflicts.push({
            type: 'progress_conflict',
            language: lang,
            localData: localData.progress[lang],
            remoteData: remoteData.progress[lang]
          });
        }
      }
    });

    return conflicts;
  }

  /**
   * Get cross-platform statistics
   */
  getCrossPlatformStats() {
    return {
      syncStatus: this.syncStatus,
      lastSync: this.lastSync,
      pendingChanges: this.pendingChanges.length,
      deviceId: this.deviceId,
      platform: this.platformInfo,
      dataSize: this.calculateDataSize()
    };
  }

  /**
   * Calculate approximate data size
   */
  calculateDataSize() {
    const progressSize = JSON.stringify(this.getLearningProgress()).length;
    const vocabularySize = JSON.stringify(this.getVocabularyData()).length;
    const achievementSize = JSON.stringify(this.getAchievementData()).length;

    return {
      progress: progressSize,
      vocabulary: vocabularySize,
      achievements: achievementSize,
      total: progressSize + vocabularySize + achievementSize
    };
  }
}

// Initialize cross-platform learning system
window.crossPlatformLearning = new CrossPlatformLearningSystem();

// Export for use in other modules
export { CrossPlatformLearningSystem };
