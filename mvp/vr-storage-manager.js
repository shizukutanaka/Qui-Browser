/**
 * VR Storage Manager Module
 *
 * Manage browser data
 * - Bookmarks (save/load)
 * - History (track visits)
 * - Cache (store content)
 * - Settings (preferences)
 *
 * ~200 lines
 */

class VRStorageManager {
  constructor() {
    this.storageKey = 'quirbrowser_';

    // Initialize storage
    this.initializeStorage();
  }

  /**
   * Initialize storage with defaults
   */
  initializeStorage() {
    if (!this.getBookmarks()) {
      this.setBookmarks([
        {
          url: 'https://www.google.com',
          title: 'Google',
          timestamp: Date.now()
        },
        {
          url: 'https://www.wikipedia.org',
          title: 'Wikipedia',
          timestamp: Date.now()
        }
      ]);
    }

    if (!this.getHomePage()) {
      this.setHomePage('https://www.google.com');
    }

    console.log('[StorageManager] Storage initialized');
  }

  /**
   * Save bookmark
   */
  addBookmark(url, title = null) {
    const bookmarks = this.getBookmarks() || [];

    // Check if already bookmarked
    if (bookmarks.some(b => b.url === url)) {
      console.warn('[StorageManager] Already bookmarked:', url);
      return false;
    }

    bookmarks.push({
      url: url,
      title: title || this.getTitleFromURL(url),
      timestamp: Date.now()
    });

    this.setBookmarks(bookmarks);
    console.log('[StorageManager] Bookmark added:', url);

    return true;
  }

  /**
   * Remove bookmark
   */
  removeBookmark(url) {
    let bookmarks = this.getBookmarks() || [];
    bookmarks = bookmarks.filter(b => b.url !== url);

    this.setBookmarks(bookmarks);
    console.log('[StorageManager] Bookmark removed:', url);
  }

  /**
   * Get all bookmarks
   */
  getBookmarks() {
    const data = localStorage.getItem(this.storageKey + 'bookmarks');
    return data ? JSON.parse(data) : [];
  }

  /**
   * Set bookmarks
   */
  setBookmarks(bookmarks) {
    localStorage.setItem(
      this.storageKey + 'bookmarks',
      JSON.stringify(bookmarks)
    );
  }

  /**
   * Add to history
   */
  addToHistory(url, title = null) {
    let history = this.getHistory() || [];

    // Check if URL is already in recent history
    const lastEntry = history[history.length - 1];
    if (lastEntry && lastEntry.url === url) {
      // Update timestamp instead of adding duplicate
      lastEntry.timestamp = Date.now();
      this.setHistory(history);
      return;
    }

    history.push({
      url: url,
      title: title || this.getTitleFromURL(url),
      timestamp: Date.now()
    });

    // Keep only last 100 entries
    if (history.length > 100) {
      history = history.slice(-100);
    }

    this.setHistory(history);
    console.log('[StorageManager] Added to history:', url);
  }

  /**
   * Get history
   */
  getHistory() {
    const data = localStorage.getItem(this.storageKey + 'history');
    return data ? JSON.parse(data) : [];
  }

  /**
   * Set history
   */
  setHistory(history) {
    localStorage.setItem(
      this.storageKey + 'history',
      JSON.stringify(history)
    );
  }

  /**
   * Clear history
   */
  clearHistory() {
    localStorage.removeItem(this.storageKey + 'history');
    console.log('[StorageManager] History cleared');
  }

  /**
   * Get home page
   */
  getHomePage() {
    return localStorage.getItem(this.storageKey + 'home_page') || 'https://www.google.com';
  }

  /**
   * Set home page
   */
  setHomePage(url) {
    localStorage.setItem(this.storageKey + 'home_page', url);
  }

  /**
   * Save setting
   */
  setSetting(key, value) {
    localStorage.setItem(this.storageKey + 'setting_' + key, JSON.stringify(value));
  }

  /**
   * Get setting
   */
  getSetting(key, defaultValue = null) {
    const data = localStorage.getItem(this.storageKey + 'setting_' + key);
    return data ? JSON.parse(data) : defaultValue;
  }

  /**
   * Cache content
   */
  cacheContent(url, content, expirySeconds = 3600) {
    const data = {
      content: content,
      timestamp: Date.now(),
      expiry: expirySeconds * 1000
    };

    try {
      localStorage.setItem(
        this.storageKey + 'cache_' + this.hashURL(url),
        JSON.stringify(data)
      );
    } catch (e) {
      console.warn('[StorageManager] Cache failed:', e);
    }
  }

  /**
   * Get cached content
   */
  getCachedContent(url) {
    const key = this.storageKey + 'cache_' + this.hashURL(url);
    const data = localStorage.getItem(key);

    if (!data) return null;

    try {
      const cached = JSON.parse(data);
      const age = Date.now() - cached.timestamp;

      if (age > cached.expiry) {
        localStorage.removeItem(key);
        return null;
      }

      return cached.content;
    } catch (e) {
      console.warn('[StorageManager] Cache read failed:', e);
      return null;
    }
  }

  /**
   * Clear expired cache
   */
  clearExpiredCache() {
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith(this.storageKey + 'cache_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          const age = Date.now() - data.timestamp;

          if (age > data.expiry) {
            localStorage.removeItem(key);
          }
        } catch (e) {
          // Ignore invalid entries
        }
      }
    }
  }

  /**
   * Get storage size (approximate)
   */
  getStorageSize() {
    let size = 0;
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith(this.storageKey)) {
        size += localStorage.getItem(key).length;
      }
    }

    return size; // bytes
  }

  /**
   * Clear all storage
   */
  clearAllStorage() {
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith(this.storageKey)) {
        localStorage.removeItem(key);
      }
    }

    // Re-initialize with defaults
    this.initializeStorage();

    console.log('[StorageManager] All storage cleared');
  }

  /**
   * Export bookmarks as JSON
   */
  exportBookmarks() {
    const bookmarks = this.getBookmarks();
    const json = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookmarks.json';
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Import bookmarks from JSON
   */
  async importBookmarks(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const bookmarks = JSON.parse(event.target.result);
          this.setBookmarks(bookmarks);
          resolve(bookmarks.length);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('File read failed'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Get title from URL
   */
  getTitleFromURL(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Hash URL for cache key
   */
  hashURL(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRStorageManager;
}
