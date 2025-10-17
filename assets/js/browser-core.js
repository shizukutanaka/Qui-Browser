/**
 * Qui Browser Core
 * 改善されたブラウザコア機能
 */

class QuiBrowser {
  constructor() {
    this.currentTabId = 1;
    this.tabs = new Map();
    this.history = [];
    this.historyIndex = -1;
    this.bookmarks = null;
    this.bookmarksLoaded = false;
    this.activeLoadTimeout = null;
    this.autoSaveInterval = null;

    this.init();
  }

  init() {
    this.initializeEventListeners();
    this.initializeKeyboardShortcuts();
    this.updateConnectionStatus(navigator.onLine);
    this.restoreSession();
    this.startAutoSave();

    // ページアンロード時のクリーンアップ
    window.addEventListener('beforeunload', () => this.cleanup());

    // スクロール検出アニメーション
    this.initScrollReveal();
  }

  initializeEventListeners() {
    // ナビゲーションボタン
    document.getElementById('backBtn')?.addEventListener('click', () => this.goBack());
    document.getElementById('forwardBtn')?.addEventListener('click', () => this.goForward());
    document.getElementById('refreshBtn')?.addEventListener('click', () => this.refresh());
    document.getElementById('homeBtn')?.addEventListener('click', () => this.goHome());
    document.getElementById('bookmarkBtn')?.addEventListener('click', () => this.bookmark());

    // URLバー
    const urlBar = document.getElementById('urlBar');
    urlBar?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.navigate(e.target.value);
      }
    });

    // オートコンプリート
    urlBar?.addEventListener(
      'input',
      this.debounce(e => {
        this.showSuggestions(e.target.value);
      }, 300)
    );

    // 新しいタブ
    document.getElementById('newTabBtn')?.addEventListener('click', () => this.createNewTab());

    // オンライン/オフライン検出
    window.addEventListener('online', () => this.updateConnectionStatus(true));
    window.addEventListener('offline', () => this.updateConnectionStatus(false));

    // ページロード完了
    const pageFrame = document.getElementById('pageFrame');
    pageFrame?.addEventListener('load', () => this.onPageLoad());
  }

  initializeKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      // Ctrl/Cmd キーショートカット
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 't':
            e.preventDefault();
            this.createNewTab();
            break;
          case 'w':
            e.preventDefault();
            this.closeCurrentTab();
            break;
          case 'r':
            e.preventDefault();
            this.refresh();
            break;
          case 'd':
            e.preventDefault();
            this.bookmark();
            break;
          case 'l':
            e.preventDefault();
            document.getElementById('urlBar')?.select();
            break;
          case 'f':
            e.preventDefault();
            this.showSearchDialog();
            break;
          case 'h':
            if (e.shiftKey) {
              e.preventDefault();
              this.showHistory();
            }
            break;
          case 'b':
            if (e.shiftKey) {
              e.preventDefault();
              this.showBookmarks();
            }
            break;
        }
      }

      // Alt キーショートカット
      if (e.altKey) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            this.goBack();
            break;
          case 'ArrowRight':
            e.preventDefault();
            this.goForward();
            break;
          case 'Home':
            e.preventDefault();
            this.goHome();
            break;
        }
      }

      // F1 - ヘルプ
      if (e.key === 'F1') {
        e.preventDefault();
        this.showHelp();
      }
    });
  }

  navigate(url, retryCount = 0) {
    if (!url) {
      return;
    }

    const sanitizedUrl = this.sanitizeUrl(url);
    if (!sanitizedUrl) {
      window.toast?.error('無効なURLです');
      return;
    }

    this.showLoadingIndicator();
    this.updateSecurityIndicator(sanitizedUrl);

    if (retryCount === 0) {
      this.addToHistory(sanitizedUrl);
    }

    const pageFrame = document.getElementById('pageFrame');
    if (!pageFrame) {
      return;
    }

    // エラーハンドリング
    const errorHandler = () => {
      if (retryCount < 2) {
        console.warn(`Navigation failed, retrying (${retryCount + 1}/2)...`);
        setTimeout(
          () => {
            this.navigate(url, retryCount + 1);
          },
          1000 * (retryCount + 1)
        );
      } else {
        window.toast?.error('ページの読み込みに失敗しました', 'エラー');
        this.hideLoadingIndicator();
      }
    };

    // タイムアウト処理
    if (this.activeLoadTimeout) {
      clearTimeout(this.activeLoadTimeout);
    }

    this.activeLoadTimeout = setTimeout(() => {
      errorHandler();
      this.activeLoadTimeout = null;
    }, 30000);

    pageFrame.onload = () => {
      if (this.activeLoadTimeout) {
        clearTimeout(this.activeLoadTimeout);
        this.activeLoadTimeout = null;
      }
    };

    pageFrame.src = sanitizedUrl;
    document.getElementById('urlBar').value = sanitizedUrl;
  }

  sanitizeUrl(url) {
    const trimmed = url.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.length > 2048) {
      window.toast?.warning('URLが長すぎます');
      return null;
    }

    // 危険なスキームをブロック
    const dangerousSchemes = ['data:', 'vbscript:', 'file:', 'about:', 'blob:', 'filesystem:'];

    const normalized = trimmed.toLowerCase();
    for (const scheme of dangerousSchemes) {
      if (normalized.startsWith(scheme)) {
        console.warn('Blocked dangerous URL scheme:', scheme);
        return null;
      }
    }

    // 検索クエリ vs URL判定
    if (trimmed.includes(' ') || (!trimmed.includes('.') && !trimmed.startsWith('http'))) {
      return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
    }

    // HTTP/HTTPSのみ許可
    try {
      const testUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      const parsed = new URL(testUrl);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        console.warn('Blocked non-HTTP(S) protocol:', parsed.protocol);
        return null;
      }

      return parsed.href;
    } catch (e) {
      return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
    }
  }

  showSuggestions(query) {
    if (!query || query.length < 2) {
      this.hideSuggestions();
      return;
    }

    // ブックマークと履歴から候補を検索
    const suggestions = [];

    // 履歴から検索
    this.history.forEach(url => {
      if (url.toLowerCase().includes(query.toLowerCase())) {
        suggestions.push({ type: 'history', url });
      }
    });

    // ブックマークから検索
    if (this.bookmarksLoaded && this.bookmarks) {
      this.bookmarks.forEach(bookmark => {
        if (
          bookmark.url.toLowerCase().includes(query.toLowerCase()) ||
          bookmark.title.toLowerCase().includes(query.toLowerCase())
        ) {
          suggestions.push({ type: 'bookmark', ...bookmark });
        }
      });
    }

    if (suggestions.length > 0) {
      this.displaySuggestions(suggestions.slice(0, 5));
    } else {
      this.hideSuggestions();
    }
  }

  displaySuggestions(suggestions) {
    let dropdown = document.querySelector('.url-suggestions');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'dropdown-menu url-suggestions';
      dropdown.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 4px;
        max-height: 300px;
        overflow-y: auto;
      `;
      document.querySelector('.url-container')?.appendChild(dropdown);
    }

    dropdown.innerHTML = suggestions
      .map(
        (item, _index) => `
      <div class="dropdown-item" data-url="${this.escapeHtml(item.url)}" role="option" tabindex="0">
        <span style="margin-right: 8px;">${item.type === 'bookmark' ? '⭐' : '🕐'}</span>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis;">
            ${item.type === 'bookmark' ? this.escapeHtml(item.title) : this.escapeHtml(item.url)}
          </div>
          ${item.type === 'bookmark' ? `<div style="font-size: 12px; color: var(--color-text-subtle); overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(item.url)}</div>` : ''}
        </div>
      </div>
    `
      )
      .join('');

    dropdown.style.display = 'block';
    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        this.navigate(url);
        this.hideSuggestions();
      });
    });
  }

  hideSuggestions() {
    const dropdown = document.querySelector('.url-suggestions');
    if (dropdown) {
      dropdown.style.display = 'none';
    }
  }

  goBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const url = this.history[this.historyIndex];
      const pageFrame = document.getElementById('pageFrame');
      if (pageFrame) {
        pageFrame.src = url;
        document.getElementById('urlBar').value = url;
      }
      this.updateNavigationButtons();
    }
  }

  goForward() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const url = this.history[this.historyIndex];
      const pageFrame = document.getElementById('pageFrame');
      if (pageFrame) {
        pageFrame.src = url;
        document.getElementById('urlBar').value = url;
      }
      this.updateNavigationButtons();
    }
  }

  refresh() {
    const pageFrame = document.getElementById('pageFrame');
    if (pageFrame && pageFrame.src) {
      const currentSrc = pageFrame.src;
      pageFrame.src = '';
      pageFrame.src = currentSrc;
      this.showLoadingIndicator();
    }
  }

  goHome() {
    this.navigate('dashboard.html');
  }

  createNewTab() {
    this.currentTabId++;
    const tabBar = document.querySelector('.tab-bar');
    const newTabBtn = document.getElementById('newTabBtn');

    if (!tabBar || !newTabBtn) {
      return;
    }

    const tab = document.createElement('div');
    tab.className = 'tab animate-slideInRight';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-tab-id', this.currentTabId);

    const tabTitle = document.createElement('span');
    tabTitle.className = 'tab-title';
    tabTitle.textContent = '新しいタブ';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.setAttribute('aria-label', 'タブを閉じる');
    closeBtn.textContent = '×';

    tab.appendChild(tabTitle);
    tab.appendChild(closeBtn);

    tab.addEventListener('click', e => {
      if (e.target !== closeBtn) {
        this.switchToTab(this.currentTabId);
      }
    });

    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      this.closeTab(this.currentTabId);
    });

    tabBar.insertBefore(tab, newTabBtn);
    this.switchToTab(this.currentTabId);
    document.getElementById('urlBar')?.focus();

    // タブデータを保存
    this.tabs.set(this.currentTabId, {
      id: this.currentTabId,
      title: '新しいタブ',
      url: 'dashboard.html'
    });
  }

  switchToTab(tabId) {
    document.querySelectorAll('.tab').forEach(tab => {
      const isActive = tab.dataset.tabId === tabId;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive);
    });
    this.currentTabId = tabId;
  }

  closeTab(tabId) {
    const tab = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (!tab) {
      return;
    }

    tab.style.animation = 'slideOutRight 0.2s ease-in';
    setTimeout(() => {
      tab.remove();
      this.tabs.delete(tabId);

      if (tabId === this.currentTabId) {
        const remainingTabs = document.querySelectorAll('.tab');
        if (remainingTabs.length > 0) {
          const lastTab = remainingTabs[remainingTabs.length - 1];
          this.switchToTab(lastTab.dataset.tabId);
        } else {
          this.createNewTab();
        }
      }
    }, 200);
  }

  closeCurrentTab() {
    this.closeTab(this.currentTabId);
  }

  bookmark() {
    const currentUrl = document.getElementById('urlBar')?.value;
    if (!currentUrl || currentUrl === 'about:blank') {
      window.toast?.warning('ブックマークできるページがありません');
      return;
    }

    this.ensureBookmarksLoaded();

    if (typeof UIComponents === 'undefined') {
      window.toast?.error('UIコンポーネントが読み込まれていません');
      return;
    }

    const modal = new UIComponents.Modal({
      title: 'ブックマークを追加',
      content: `
        <div class="input-group">
          <label class="input-label" for="bookmark-title">タイトル</label>
          <input type="text" class="input" id="bookmark-title" value="${this.escapeHtml(currentUrl)}" required>
        </div>
        <div class="input-group" style="margin-top: 16px;">
          <label class="input-label" for="bookmark-url">URL</label>
          <input type="url" class="input" id="bookmark-url" value="${this.escapeHtml(currentUrl)}" required>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary modal-cancel">キャンセル</button>
        <button class="btn btn-primary modal-save">保存</button>
      `
    });

    modal.open();

    setTimeout(() => {
      const saveBtn = modal.modal.querySelector('.modal-save');
      const cancelBtn = modal.modal.querySelector('.modal-cancel');
      const titleInput = modal.modal.querySelector('#bookmark-title');

      titleInput?.focus();

      saveBtn?.addEventListener('click', () => {
        const title = titleInput.value.trim();
        const url = modal.modal.querySelector('#bookmark-url').value.trim();

        if (!title || !url) {
          window.toast?.error('タイトルとURLを入力してください');
          return;
        }

        this.bookmarks.push({
          id: Date.now(),
          title,
          url,
          date: new Date().toISOString()
        });

        this.saveBookmarks();
        window.toast?.success('ブックマークに追加しました');
        modal.close();
      });

      cancelBtn?.addEventListener('click', () => modal.close());
    }, 0);
  }

  updateSecurityIndicator(url) {
    const indicator = document.getElementById('securityIndicator');
    if (!indicator) {
      return;
    }

    if (url.startsWith('https://')) {
      indicator.className = 'security-indicator secure';
      indicator.title = '安全な接続 (HTTPS)';
      indicator.setAttribute('aria-label', '安全な接続');
    } else if (url.startsWith('http://')) {
      indicator.className = 'security-indicator warning';
      indicator.title = '安全でない接続 (HTTP)';
      indicator.setAttribute('aria-label', '安全でない接続');
    } else {
      indicator.className = 'security-indicator';
      indicator.title = 'ローカルページ';
      indicator.setAttribute('aria-label', 'ローカルページ');
    }
  }

  showLoadingIndicator() {
    const loadingBar = document.getElementById('loadingBar');
    const pageInfo = document.getElementById('pageInfo');

    if (loadingBar) {
      loadingBar.style.width = '0%';
      loadingBar.style.display = 'block';
      loadingBar.setAttribute('aria-hidden', 'false');

      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setTimeout(() => this.hideLoadingIndicator(), 300);
        }
        loadingBar.style.width = `${Math.min(progress, 100)}%`;
      }, 100);
    }

    if (pageInfo) {
      pageInfo.textContent = '読み込み中...';
      pageInfo.style.color = 'var(--color-brand-primary)';
    }
  }

  hideLoadingIndicator() {
    const loadingBar = document.getElementById('loadingBar');
    if (loadingBar) {
      loadingBar.style.display = 'none';
      loadingBar.setAttribute('aria-hidden', 'true');
    }
  }

  updateConnectionStatus(isOnline) {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) {
      return;
    }

    statusElement.className = isOnline ? 'status-indicator online' : 'status-indicator offline';
    statusElement.innerHTML = `
      <span class="status-dot" aria-hidden="true"></span>
      <span>${isOnline ? 'オンライン' : 'オフライン'}</span>
    `;

    if (!isOnline) {
      window.toast?.warning('インターネット接続がありません', '警告');
    } else {
      window.toast?.success('インターネットに接続しました');
    }
  }

  addToHistory(url) {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(url);
    this.historyIndex = this.history.length - 1;

    if (this.history.length > 100) {
      this.history.shift();
      this.historyIndex--;
    }

    this.updateNavigationButtons();
    this.saveHistory();
  }

  updateNavigationButtons() {
    const backBtn = document.getElementById('backBtn');
    const forwardBtn = document.getElementById('forwardBtn');

    if (backBtn) {
      backBtn.disabled = this.historyIndex <= 0;
    }
    if (forwardBtn) {
      forwardBtn.disabled = this.historyIndex >= this.history.length - 1;
    }
  }

  onPageLoad() {
    this.hideLoadingIndicator();
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
      pageInfo.textContent = '読み込み完了';
      pageInfo.style.color = 'var(--color-success)';

      setTimeout(() => {
        pageInfo.textContent = '準備完了';
        pageInfo.style.color = 'var(--color-text-subtle)';
      }, 2000);
    }
  }

  ensureBookmarksLoaded() {
    if (!this.bookmarksLoaded) {
      try {
        const saved = localStorage.getItem('qui-bookmarks');
        this.bookmarks = saved ? JSON.parse(saved).bookmarks || [] : [];
        this.bookmarksLoaded = true;
      } catch (e) {
        console.error('Failed to load bookmarks:', e);
        this.bookmarks = [];
        this.bookmarksLoaded = true;
      }
    }
  }

  saveBookmarks() {
    if (!this.bookmarksLoaded || !this.bookmarks) {
      return;
    }
    try {
      const data = {
        bookmarks: this.bookmarks.slice(-100),
        timestamp: Date.now()
      };
      localStorage.setItem('qui-bookmarks', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save bookmarks:', e);
    }
  }

  saveHistory() {
    try {
      const data = {
        history: this.history.slice(-50),
        index: Math.min(this.historyIndex, 49),
        timestamp: Date.now()
      };
      localStorage.setItem('qui-history', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }

  restoreSession() {
    try {
      const saved = localStorage.getItem('qui-history');
      if (saved) {
        const data = JSON.parse(saved);
        this.history = data.history || [];
        this.historyIndex = data.index || -1;
        this.updateNavigationButtons();
      }
    } catch (e) {
      console.error('Failed to restore session:', e);
    }
  }

  startAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    this.autoSaveInterval = setInterval(() => {
      try {
        this.saveHistory();
        this.saveBookmarks();
      } catch (e) {
        console.error('Auto-save failed:', e);
      }
    }, 60000);
  }

  cleanup() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    if (this.activeLoadTimeout) {
      clearTimeout(this.activeLoadTimeout);
      this.activeLoadTimeout = null;
    }

    try {
      this.saveHistory();
      if (this.bookmarksLoaded) {
        this.saveBookmarks();
      }
    } catch (e) {
      console.error('Final save failed:', e);
    }
  }

  initScrollReveal() {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      {
        threshold: 0.1
      }
    );

    document.querySelectorAll('.scroll-reveal').forEach(el => {
      observer.observe(el);
    });
  }

  showHelp() {
    if (typeof UIComponents === 'undefined') {
      window.toast?.error('UIコンポーネントが読み込まれていません');
      return;
    }

    const modal = new UIComponents.Modal({
      title: 'Qui Browser ヘルプ',
      content: `
        <div style="max-height: 400px; overflow-y: auto;">
          <h3 style="margin-bottom: 12px;">キーボードショートカット</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px;">
            <div><kbd>Ctrl+T</kbd> 新しいタブ</div>
            <div><kbd>Ctrl+W</kbd> タブを閉じる</div>
            <div><kbd>Ctrl+R</kbd> ページ更新</div>
            <div><kbd>Ctrl+D</kbd> ブックマーク</div>
            <div><kbd>Ctrl+L</kbd> アドレスバー</div>
            <div><kbd>Ctrl+F</kbd> ページ内検索</div>
            <div><kbd>Alt+←</kbd> 戻る</div>
            <div><kbd>Alt+→</kbd> 進む</div>
            <div><kbd>Ctrl+Shift+D</kbd> ダークモード切替</div>
            <div><kbd>F1</kbd> このヘルプ</div>
          </div>

          <h3 style="margin-bottom: 12px;">機能</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="margin-bottom: 8px;">✓ セキュアなブラウジング</li>
            <li style="margin-bottom: 8px;">✓ ダークモード対応</li>
            <li style="margin-bottom: 8px;">✓ アクセシビリティ最適化</li>
            <li style="margin-bottom: 8px;">✓ オフライン対応</li>
          </ul>
        </div>
      `,
      footer: '<button class="btn btn-primary modal-close">閉じる</button>'
    });

    modal.open();

    setTimeout(() => {
      modal.modal.querySelector('.modal-close')?.addEventListener('click', () => modal.close());
    }, 0);
  }

  debounce(func, wait) {
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// グローバルインスタンス
document.addEventListener('DOMContentLoaded', () => {
  window.browser = new QuiBrowser();
});

// Service Worker登録
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// エラーハンドリング
window.addEventListener('error', event => {
  console.error('Global error:', event.error);
  event.preventDefault();
  window.toast?.error('予期しないエラーが発生しました');
});

window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled rejection:', event.reason);
  event.preventDefault();
  const isNetworkError = event.reason?.message?.includes('fetch') || event.reason?.message?.includes('network');
  const message = isNetworkError ? 'ネットワークエラーが発生しました' : '処理中にエラーが発生しました';
  window.toast?.error(message);
});

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuiBrowser;
}
