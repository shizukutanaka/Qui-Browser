/**
 * VR UI Manager Module
 *
 * Manage browser UI in VR
 * - URL bar
 * - Tab management
 * - Bookmarks
 * - History
 * - Menu interaction
 *
 * ~250 lines
 */

class VRUIManager {
  constructor(vrBrowser) {
    this.vrBrowser = vrBrowser;

    // UI State
    this.tabs = [];
    this.currentTabIndex = 0;
    this.showMenu = false;
    this.selectedMenuItem = 0;

    // Initialize default tab
    this.addTab('about:blank');

    // Menu options
    this.menuItems = [
      { label: 'ホーム', action: 'home' },
      { label: 'ブックマーク', action: 'bookmarks' },
      { label: '履歴', action: 'history' },
      { label: '設定', action: 'settings' },
      { label: '終了', action: 'exit' }
    ];

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Menu button toggles menu
    this.vrBrowser.on('menu', () => {
      this.toggleMenu();
    });

    // Click opens menu item or clicks on content
    this.vrBrowser.on('click', () => {
      if (this.showMenu) {
        this.selectMenuItem(this.selectedMenuItem);
      } else {
        this.handleContentClick();
      }
    });

    // Gesture navigation
    this.vrBrowser.on('gesture:swipeLeft', () => {
      this.previousTab();
    });

    this.vrBrowser.on('gesture:swipeRight', () => {
      this.nextTab();
    });
  }

  /**
   * Add new tab
   */
  addTab(url = 'about:blank') {
    this.tabs.push({
      url: url,
      title: this.getTitleFromURL(url),
      favicon: '📄'
    });

    this.currentTabIndex = this.tabs.length - 1;
    console.log('[UIManager] Tab added:', url);

    return this.currentTabIndex;
  }

  /**
   * Close tab
   */
  closeTab(index) {
    if (this.tabs.length <= 1) {
      console.warn('[UIManager] Cannot close last tab');
      return;
    }

    this.tabs.splice(index, 1);

    // Adjust current tab
    if (this.currentTabIndex >= this.tabs.length) {
      this.currentTabIndex = this.tabs.length - 1;
    }

    console.log('[UIManager] Tab closed:', index);
  }

  /**
   * Switch to tab
   */
  switchToTab(index) {
    if (index < 0 || index >= this.tabs.length) {
      console.warn('[UIManager] Invalid tab index:', index);
      return;
    }

    this.currentTabIndex = index;
    const tab = this.tabs[index];

    if (this.vrBrowser.contentLoader) {
      this.vrBrowser.contentLoader.loadURL(tab.url);
    }

    console.log('[UIManager] Switched to tab:', index);
  }

  /**
   * Next tab
   */
  nextTab() {
    const next = (this.currentTabIndex + 1) % this.tabs.length;
    this.switchToTab(next);
  }

  /**
   * Previous tab
   */
  previousTab() {
    const prev = (this.currentTabIndex - 1 + this.tabs.length) % this.tabs.length;
    this.switchToTab(prev);
  }

  /**
   * Get current tab
   */
  getCurrentTab() {
    return this.tabs[this.currentTabIndex];
  }

  /**
   * Get title from URL
   */
  getTitleFromURL(url) {
    if (url === 'about:blank') return 'New Tab';
    if (url === 'about:home') return 'ホーム';

    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url.substring(0, 20);
    }
  }

  /**
   * Toggle menu
   */
  toggleMenu() {
    this.showMenu = !this.showMenu;
    this.selectedMenuItem = 0;

    console.log('[UIManager] Menu toggled:', this.showMenu);
  }

  /**
   * Navigate menu up/down
   */
  navigateMenu(direction) {
    if (direction === 'up') {
      this.selectedMenuItem = (this.selectedMenuItem - 1 + this.menuItems.length) % this.menuItems.length;
    } else if (direction === 'down') {
      this.selectedMenuItem = (this.selectedMenuItem + 1) % this.menuItems.length;
    }
  }

  /**
   * Select menu item
   */
  selectMenuItem(index) {
    const item = this.menuItems[index];

    console.log('[UIManager] Menu item selected:', item.label);

    switch (item.action) {
      case 'home':
        this.navigateToHome();
        break;

      case 'bookmarks':
        this.showBookmarks();
        break;

      case 'history':
        this.showHistory();
        break;

      case 'settings':
        this.showSettings();
        break;

      case 'exit':
        this.vrBrowser.exitVRMode();
        break;
    }

    this.showMenu = false;
  }

  /**
   * Navigate to home
   */
  navigateToHome() {
    if (this.vrBrowser.storageManager) {
      const home = this.vrBrowser.storageManager.getHomePage();
      this.navigateToURL(home);
    }
  }

  /**
   * Navigate to URL
   */
  navigateToURL(url) {
    const tab = this.getCurrentTab();
    tab.url = url;

    if (this.vrBrowser.contentLoader) {
      this.vrBrowser.contentLoader.loadURL(url);
    }
  }

  /**
   * Show bookmarks
   */
  showBookmarks() {
    const bookmarks = this.vrBrowser.storageManager.getBookmarks();

    let html = '<h1>ブックマーク</h1>';
    for (const bookmark of bookmarks) {
      html += `<p><a href="${bookmark.url}">${bookmark.title}</a></p>`;
    }

    if (this.vrBrowser.contentLoader) {
      this.vrBrowser.contentLoader.loadHTML(html);
    }
  }

  /**
   * Show history
   */
  showHistory() {
    const history = this.vrBrowser.storageManager.getHistory();

    let html = '<h1>履歴</h1>';
    for (const entry of history) {
      html += `<p><a href="${entry.url}">${entry.title}</a> - ${new Date(entry.timestamp).toLocaleString()}</p>`;
    }

    if (this.vrBrowser.contentLoader) {
      this.vrBrowser.contentLoader.loadHTML(html);
    }
  }

  /**
   * Show settings
   */
  showSettings() {
    const html = `
      <h1>設定</h1>
      <p>
        <label>
          <input type="checkbox" id="enableVoice" />
          音声入力を有効にする
        </label>
      </p>
      <p>
        <label>
          テキストサイズ:
          <input type="range" min="0.5" max="2" step="0.1" value="1" />
        </label>
      </p>
    `;

    if (this.vrBrowser.contentLoader) {
      this.vrBrowser.contentLoader.loadHTML(html);
    }
  }

  /**
   * Handle content click
   */
  handleContentClick() {
    // In a real implementation, would need to track
    // which element was clicked and handle accordingly
    console.log('[UIManager] Content clicked');
  }

  /**
   * Get tabs for display
   */
  getTabs() {
    return this.tabs.map((tab, index) => ({
      ...tab,
      isActive: index === this.currentTabIndex
    }));
  }

  /**
   * Get menu for display
   */
  getMenu() {
    if (!this.showMenu) return null;

    return this.menuItems.map((item, index) => ({
      ...item,
      isSelected: index === this.selectedMenuItem
    }));
  }

  /**
   * Update (called every frame)
   */
  update() {
    // Could add UI animations or updates here
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRUIManager;
}
