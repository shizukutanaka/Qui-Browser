/**
 * VR Browser Utilities
 * Common utilities and error handling for VR browser
 */

class VRUtils {
  /**
   * Check if WebXR is supported
   */
  static async checkWebXRSupport() {
    if (!('xr' in navigator)) {
      return {
        supported: false,
        reason: 'WebXR not available in this browser'
      };
    }

    try {
      const vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
      const arSupported = await navigator.xr.isSessionSupported('immersive-ar');

      return {
        supported: vrSupported || arSupported,
        vr: vrSupported,
        ar: arSupported,
        reason: vrSupported || arSupported ? 'WebXR supported' : 'No XR modes available'
      };
    } catch (error) {
      return {
        supported: false,
        reason: `WebXR check failed: ${error.message}`
      };
    }
  }

  /**
   * Get device information
   */
  static getDeviceInfo() {
    const ua = navigator.userAgent;
    let device = 'Unknown';
    let browser = 'Unknown';

    // Detect VR headset
    if (ua.includes('Quest')) {
      device = ua.includes('Quest 3') ? 'Meta Quest 3' :
               ua.includes('Quest 2') ? 'Meta Quest 2' :
               ua.includes('Quest Pro') ? 'Meta Quest Pro' : 'Meta Quest';
    } else if (ua.includes('Pico')) {
      device = 'Pico VR';
    } else if (ua.includes('OculusBrowser')) {
      device = 'Meta Quest';
    }

    // Detect browser
    if (ua.includes('OculusBrowser')) {
      browser = 'Oculus Browser';
    } else if (ua.includes('Chrome')) {
      browser = 'Chrome';
    } else if (ua.includes('Firefox')) {
      browser = 'Firefox';
    } else if (ua.includes('Safari')) {
      browser = 'Safari';
    }

    return {
      device,
      browser,
      userAgent: ua,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints
    };
  }

  /**
   * Show notification to user
   */
  static showNotification(message, type = 'info', duration = 3000) {
    const colors = {
      info: '#0052cc',
      success: '#36b37e',
      warning: '#ff9800',
      error: '#ff4444'
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${colors[type]};
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      max-width: 80%;
      text-align: center;
      animation: slideDown 0.3s ease;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => notification.remove(), 300);
    }, duration);

    return notification;
  }

  /**
   * Log error with context
   */
  static logError(error, context = '') {
    const timestamp = new Date().toISOString();
    const errorData = {
      timestamp,
      context,
      message: error.message,
      stack: error.stack,
      device: this.getDeviceInfo()
    };

    console.error(`[VR Error ${timestamp}]`, errorData);

    // Store in localStorage for debugging
    try {
      const errors = JSON.parse(localStorage.getItem('vr-errors') || '[]');
      errors.push(errorData);
      // Keep last 50 errors
      if (errors.length > 50) errors.shift();
      localStorage.setItem('vr-errors', JSON.stringify(errors));
    } catch (e) {
      console.warn('Failed to store error log:', e);
    }

    return errorData;
  }

  /**
   * Get stored errors
   */
  static getErrorLog() {
    try {
      return JSON.parse(localStorage.getItem('vr-errors') || '[]');
    } catch (e) {
      return [];
    }
  }

  /**
   * Clear error log
   */
  static clearErrorLog() {
    localStorage.removeItem('vr-errors');
  }

  /**
   * Measure performance
   */
  static measurePerformance(name, fn) {
    const start = performance.now();
    const result = fn();

    if (result instanceof Promise) {
      return result.then(value => {
        const duration = performance.now() - start;
        console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
        return value;
      });
    } else {
      const duration = performance.now() - start;
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
      return result;
    }
  }

  /**
   * Debounce function
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle function
   */
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Format file size
   */
  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Get storage info
   */
  static async getStorageInfo() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        usagePercent: ((estimate.usage / estimate.quota) * 100).toFixed(2),
        available: estimate.quota - estimate.usage,
        usageFormatted: this.formatBytes(estimate.usage),
        quotaFormatted: this.formatBytes(estimate.quota),
        availableFormatted: this.formatBytes(estimate.quota - estimate.usage)
      };
    }
    return null;
  }

  /**
   * Request persistent storage
   */
  static async requestPersistentStorage() {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      const isPersisted = await navigator.storage.persist();
      return {
        granted: isPersisted,
        message: isPersisted ?
          'Persistent storage granted' :
          'Persistent storage denied'
      };
    }
    return {
      granted: false,
      message: 'Persistent storage not supported'
    };
  }

  /**
   * Check online status
   */
  static isOnline() {
    return navigator.onLine;
  }

  /**
   * Monitor online status
   */
  static monitorOnlineStatus(onOnline, onOffline) {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }

  /**
   * Get battery status (if available)
   */
  static async getBatteryStatus() {
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        return {
          level: (battery.level * 100).toFixed(0),
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime
        };
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  /**
   * Vibrate device (for VR controllers)
   */
  static vibrate(pattern) {
    if ('vibrate' in navigator) {
      return navigator.vibrate(pattern);
    }
    return false;
  }

  /**
   * Copy to clipboard
   */
  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showNotification('Copied to clipboard', 'success', 2000);
      return true;
    } catch (error) {
      this.showNotification('Failed to copy', 'error', 2000);
      return false;
    }
  }

  /**
   * Share content (if Web Share API available)
   */
  static async share(data) {
    if ('share' in navigator) {
      try {
        await navigator.share(data);
        return { success: true };
      } catch (error) {
        if (error.name !== 'AbortError') {
          return { success: false, error: error.message };
        }
        return { success: false, error: 'Share cancelled' };
      }
    }
    return { success: false, error: 'Web Share API not supported' };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRUtils;
}

// Make available globally
window.VRUtils = VRUtils;
