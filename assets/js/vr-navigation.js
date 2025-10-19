/**
 * VR Navigation System
 * Handles URL navigation, history, and browser controls in VR mode
 * @version 2.0.0
 */

class VRNavigation {
    constructor() {
        this.currentUrl = window.location.href;
        this.history = [];
        this.historyIndex = -1;
        this.bookmarks = this.loadBookmarks();
        this.urlBar = null;
        this.navigationPanel = null;
        this.isVRMode = false;

        this.init();
    }

    init() {
        this.loadHistory();
        this.setupEventListeners();
    }

    /**
     * Initialize VR navigation panel
     */
    initVRPanel() {
        if (this.navigationPanel) return;

        this.navigationPanel = document.createElement('div');
        this.navigationPanel.id = 'vr-navigation-panel';
        this.navigationPanel.className = 'vr-navigation-panel';
        this.navigationPanel.innerHTML = `
            <div class="vr-nav-container">
                <div class="vr-nav-header">
                    <h3>VR Browser Navigation</h3>
                    <button class="vr-nav-close" aria-label="Close navigation">×</button>
                </div>

                <div class="vr-url-bar">
                    <button class="vr-nav-btn vr-back" title="Back" aria-label="Go back">◄</button>
                    <button class="vr-nav-btn vr-forward" title="Forward" aria-label="Go forward">►</button>
                    <button class="vr-nav-btn vr-refresh" title="Refresh" aria-label="Refresh page">⟳</button>
                    <input type="url" class="vr-url-input" placeholder="Enter URL or search..." />
                    <button class="vr-nav-btn vr-go" title="Go" aria-label="Navigate">→</button>
                    <button class="vr-nav-btn vr-bookmark" title="Bookmark" aria-label="Bookmark page">★</button>
                </div>

                <div class="vr-nav-tabs">
                    <button class="vr-tab-btn active" data-tab="history">History</button>
                    <button class="vr-tab-btn" data-tab="bookmarks">Bookmarks</button>
                    <button class="vr-tab-btn" data-tab="tools">Tools</button>
                </div>

                <div class="vr-nav-content">
                    <div class="vr-tab-panel active" data-panel="history">
                        <div class="vr-history-list"></div>
                    </div>
                    <div class="vr-tab-panel" data-panel="bookmarks">
                        <div class="vr-bookmarks-list"></div>
                    </div>
                    <div class="vr-tab-panel" data-panel="tools">
                        <div class="vr-tools-list">
                            <button class="vr-tool-btn" data-tool="screenshot">📷 Screenshot</button>
                            <button class="vr-tool-btn" data-tool="fullscreen">⛶ Fullscreen</button>
                            <button class="vr-tool-btn" data-tool="share">🔗 Share</button>
                            <button class="vr-tool-btn" data-tool="settings">⚙ Settings</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.navigationPanel);
        this.attachPanelEvents();
        this.updateHistoryList();
        this.updateBookmarksList();
    }

    /**
     * Show navigation panel
     */
    show() {
        if (!this.navigationPanel) {
            this.initVRPanel();
        }
        this.navigationPanel.classList.add('active');
        this.urlBar = this.navigationPanel.querySelector('.vr-url-input');
        this.urlBar.value = this.currentUrl;
    }

    /**
     * Hide navigation panel
     */
    hide() {
        if (this.navigationPanel) {
            this.navigationPanel.classList.remove('active');
        }
    }

    /**
     * Toggle navigation panel
     */
    toggle() {
        if (this.navigationPanel && this.navigationPanel.classList.contains('active')) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Attach event listeners to navigation panel
     */
    attachPanelEvents() {
        const panel = this.navigationPanel;

        // Close button
        panel.querySelector('.vr-nav-close').addEventListener('click', () => this.hide());

        // Navigation buttons
        panel.querySelector('.vr-back').addEventListener('click', () => this.goBack());
        panel.querySelector('.vr-forward').addEventListener('click', () => this.goForward());
        panel.querySelector('.vr-refresh').addEventListener('click', () => this.refresh());
        panel.querySelector('.vr-go').addEventListener('click', () => this.navigate());
        panel.querySelector('.vr-bookmark').addEventListener('click', () => this.addBookmark());

        // URL input
        const urlInput = panel.querySelector('.vr-url-input');
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.navigate();
            }
        });

        // Tab buttons
        panel.querySelectorAll('.vr-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Tool buttons
        panel.querySelectorAll('.vr-tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.target.dataset.tool;
                this.executeTool(tool);
            });
        });
    }

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        const panel = this.navigationPanel;

        // Update tab buttons
        panel.querySelectorAll('.vr-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab panels
        panel.querySelectorAll('.vr-tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === tabName);
        });
    }

    /**
     * Navigate to URL
     */
    navigate() {
        let url = this.urlBar.value.trim();
        if (!url) return;

        // Add protocol if missing
        if (!url.match(/^https?:\/\//i)) {
            // Check if it looks like a domain
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url;
            } else {
                // Treat as search query
                url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
            }
        }

        this.navigateTo(url);
    }

    /**
     * Navigate to specific URL
     */
    navigateTo(url) {
        this.addToHistory(url);
        this.currentUrl = url;
        window.location.href = url;
    }

    /**
     * Go back in history
     */
    goBack() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const url = this.history[this.historyIndex];
            this.currentUrl = url;
            window.history.back();
        }
    }

    /**
     * Go forward in history
     */
    goForward() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const url = this.history[this.historyIndex];
            this.currentUrl = url;
            window.history.forward();
        }
    }

    /**
     * Refresh current page
     */
    refresh() {
        window.location.reload();
    }

    /**
     * Add current page to history
     */
    addToHistory(url) {
        // Remove forward history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(url);
        this.historyIndex = this.history.length - 1;

        // Limit history size
        if (this.history.length > 100) {
            this.history.shift();
            this.historyIndex--;
        }

        this.saveHistory();
        this.updateHistoryList();
    }

    /**
     * Add current page to bookmarks
     */
    addBookmark() {
        const bookmark = {
            url: this.currentUrl,
            title: document.title || this.currentUrl,
            timestamp: Date.now()
        };

        // Check if already bookmarked
        const exists = this.bookmarks.some(b => b.url === bookmark.url);
        if (exists) {
            VRUtils.showNotification('Already bookmarked', 'info');
            return;
        }

        this.bookmarks.unshift(bookmark);
        this.saveBookmarks();
        this.updateBookmarksList();
        VRUtils.showNotification('Bookmark added', 'success');
    }

    /**
     * Remove bookmark
     */
    removeBookmark(url) {
        this.bookmarks = this.bookmarks.filter(b => b.url !== url);
        this.saveBookmarks();
        this.updateBookmarksList();
        VRUtils.showNotification('Bookmark removed', 'success');
    }

    /**
     * Update history list UI
     */
    updateHistoryList() {
        if (!this.navigationPanel) return;

        const listContainer = this.navigationPanel.querySelector('.vr-history-list');
        if (!listContainer) return;

        if (this.history.length === 0) {
            listContainer.innerHTML = '<p class="vr-empty-message">No history yet</p>';
            return;
        }

        const recentHistory = this.history.slice(-20).reverse();
        listContainer.innerHTML = recentHistory.map(url => `
            <div class="vr-history-item" data-url="${url}">
                <span class="vr-history-title">${this.shortenUrl(url)}</span>
                <button class="vr-history-go" aria-label="Visit">→</button>
            </div>
        `).join('');

        // Attach click events
        listContainer.querySelectorAll('.vr-history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('vr-history-go')) {
                    const url = item.dataset.url;
                    this.navigateTo(url);
                }
            });
        });
    }

    /**
     * Update bookmarks list UI
     */
    updateBookmarksList() {
        if (!this.navigationPanel) return;

        const listContainer = this.navigationPanel.querySelector('.vr-bookmarks-list');
        if (!listContainer) return;

        if (this.bookmarks.length === 0) {
            listContainer.innerHTML = '<p class="vr-empty-message">No bookmarks yet</p>';
            return;
        }

        listContainer.innerHTML = this.bookmarks.map(bookmark => `
            <div class="vr-bookmark-item" data-url="${bookmark.url}">
                <div class="vr-bookmark-info">
                    <span class="vr-bookmark-title">${bookmark.title}</span>
                    <span class="vr-bookmark-url">${this.shortenUrl(bookmark.url)}</span>
                </div>
                <div class="vr-bookmark-actions">
                    <button class="vr-bookmark-go" aria-label="Visit">→</button>
                    <button class="vr-bookmark-delete" aria-label="Delete">×</button>
                </div>
            </div>
        `).join('');

        // Attach click events
        listContainer.querySelectorAll('.vr-bookmark-item').forEach(item => {
            const url = item.dataset.url;

            item.querySelector('.vr-bookmark-go').addEventListener('click', () => {
                this.navigateTo(url);
            });

            item.querySelector('.vr-bookmark-delete').addEventListener('click', () => {
                this.removeBookmark(url);
            });
        });
    }

    /**
     * Execute tool action
     */
    executeTool(tool) {
        switch (tool) {
            case 'screenshot':
                this.takeScreenshot();
                break;
            case 'fullscreen':
                this.toggleFullscreen();
                break;
            case 'share':
                this.shareCurrentPage();
                break;
            case 'settings':
                if (window.vrSettings) {
                    window.vrSettings.show();
                }
                break;
        }
    }

    /**
     * Take screenshot
     */
    async takeScreenshot() {
        try {
            // In VR mode, capture canvas
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.toBlob(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `vr-screenshot-${Date.now()}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                    VRUtils.showNotification('Screenshot saved', 'success');
                });
            }
        } catch (error) {
            VRUtils.showNotification('Screenshot failed', 'error');
            console.error('Screenshot error:', error);
        }
    }

    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Share current page
     */
    async shareCurrentPage() {
        const shareData = {
            title: document.title,
            url: this.currentUrl
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
                VRUtils.showNotification('Shared successfully', 'success');
            } else {
                await navigator.clipboard.writeText(this.currentUrl);
                VRUtils.showNotification('URL copied to clipboard', 'success');
            }
        } catch (error) {
            console.error('Share error:', error);
        }
    }

    /**
     * Shorten URL for display
     */
    shortenUrl(url, maxLength = 50) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength - 3) + '...';
    }

    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + L to focus URL bar
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                this.show();
                if (this.urlBar) {
                    this.urlBar.focus();
                    this.urlBar.select();
                }
            }

            // Escape to close panel
            if (e.key === 'Escape' && this.navigationPanel?.classList.contains('active')) {
                this.hide();
            }
        });

        // Track navigation events
        window.addEventListener('popstate', () => {
            this.currentUrl = window.location.href;
        });
    }

    /**
     * Load history from storage
     */
    loadHistory() {
        try {
            const saved = localStorage.getItem('vr-browser-history');
            if (saved) {
                const data = JSON.parse(saved);
                this.history = data.history || [];
                this.historyIndex = data.index || -1;
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    /**
     * Save history to storage
     */
    saveHistory() {
        try {
            localStorage.setItem('vr-browser-history', JSON.stringify({
                history: this.history,
                index: this.historyIndex
            }));
        } catch (error) {
            console.error('Error saving history:', error);
        }
    }

    /**
     * Load bookmarks from storage
     */
    loadBookmarks() {
        try {
            const saved = localStorage.getItem('vr-browser-bookmarks');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading bookmarks:', error);
            return [];
        }
    }

    /**
     * Save bookmarks to storage
     */
    saveBookmarks() {
        try {
            localStorage.setItem('vr-browser-bookmarks', JSON.stringify(this.bookmarks));
        } catch (error) {
            console.error('Error saving bookmarks:', error);
        }
    }

    /**
     * Clear all history
     */
    clearHistory() {
        this.history = [];
        this.historyIndex = -1;
        this.saveHistory();
        this.updateHistoryList();
        VRUtils.showNotification('History cleared', 'success');
    }

    /**
     * Clear all bookmarks
     */
    clearBookmarks() {
        this.bookmarks = [];
        this.saveBookmarks();
        this.updateBookmarksList();
        VRUtils.showNotification('Bookmarks cleared', 'success');
    }
}

// Initialize VR Navigation
const vrNavigation = new VRNavigation();

// Export for global access
if (typeof window !== 'undefined') {
    window.vrNavigation = vrNavigation;
}
