/**
 * Qui Browser Accessibility Enhancements
 * WCAG 2.1 AA準拠のアクセシビリティ対応
 *
 * 機能:
 * - ARIA属性の動的更新
 * - キーボードナビゲーション
 * - スクリーンリーダー対応
 * - フォーカス管理
 * - 高コントラスト対応
 * - モーション軽減対応
 */

class AccessibilityManager {
  constructor() {
    this.focusableElements = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]';
    this.liveRegions = new Map();
    this.skipLinks = new Map();
    this.announcements = [];

    this.init();
  }

  init() {
    this.setupAriaAttributes();
    this.setupKeyboardNavigation();
    this.setupScreenReaderSupport();
    this.setupFocusManagement();
    this.setupHighContrastSupport();
    this.setupReducedMotionSupport();
    this.setupColorBlindSupport();
    this.setupFontSizeAdjustment();
  }

  // ARIA属性の動的更新
  setupAriaAttributes() {
    // 動的コンテンツのaria-live属性設定
    this.setupLiveRegions();

    // ステータスメッセージの通知
    this.setupStatusAnnouncements();

    // フォーム要素のラベル関連付け
    this.setupFormAccessibility();

    // モーダルダイアログのARIA属性
    this.setupModalAccessibility();

    // タブインターフェースのARIA属性
    this.setupTabAccessibility();

    // ツリー構造のARIA属性
    this.setupTreeAccessibility();
  }

  setupLiveRegions() {
    // 通知領域の作成
    const notificationRegion = document.createElement('div');
    notificationRegion.id = 'notification-region';
    notificationRegion.setAttribute('aria-live', 'polite');
    notificationRegion.setAttribute('aria-atomic', 'true');
    notificationRegion.className = 'sr-only';
    document.body.appendChild(notificationRegion);

    // エラーメッセージ領域の作成
    const errorRegion = document.createElement('div');
    errorRegion.id = 'error-region';
    errorRegion.setAttribute('aria-live', 'assertive');
    errorRegion.setAttribute('aria-atomic', 'true');
    errorRegion.className = 'sr-only';
    document.body.appendChild(errorRegion);

    this.liveRegions.set('notification', notificationRegion);
    this.liveRegions.set('error', errorRegion);
  }

  setupStatusAnnouncements() {
    // ステータス変更の監視と通知
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const target = mutation.target;
          if (target.hasAttribute && target.hasAttribute('data-status')) {
            this.announceStatus(target.getAttribute('data-status'));
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-status']
    });
  }

  setupFormAccessibility() {
    // フォーム要素のラベルチェックと修正
    document.addEventListener('DOMContentLoaded', () => {
      const inputs = document.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        this.ensureLabel(input);
        this.setupFieldValidation(input);
      });
    });
  }

  ensureLabel(element) {
    const id = element.id || this.generateUniqueId();
    element.id = id;

    // 既存のラベルを確認
    const existingLabel = document.querySelector(`label[for="${id}"]`);
    if (!existingLabel) {
      // aria-labelまたはaria-labelledbyを確認
      if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
        // プレースホルダーをラベルとして使用
        const placeholder = element.getAttribute('placeholder');
        if (placeholder) {
          element.setAttribute('aria-label', placeholder);
        } else {
          // 汎用ラベルを作成
          const label = document.createElement('label');
          label.setAttribute('for', id);
          label.textContent = this.getGenericLabel(element);
          label.className = 'sr-only';
          element.parentNode.insertBefore(label, element);
        }
      }
    }
  }

  setupFieldValidation(element) {
    element.addEventListener('invalid', (e) => {
      e.preventDefault();
      const message = this.getValidationMessage(element);
      this.announceError(message);
      this.setFieldError(element, message);
    });

    element.addEventListener('input', () => {
      this.clearFieldError(element);
    });
  }

  setupModalAccessibility() {
    document.addEventListener('click', (e) => {
      const modalTrigger = e.target.closest('[data-modal-trigger]');
      if (modalTrigger) {
        const modalId = modalTrigger.getAttribute('data-modal-trigger');
        this.openModal(modalId);
      }

      const modalClose = e.target.closest('[data-modal-close]');
      if (modalClose) {
        this.closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.setAttribute('aria-hidden', 'false');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    // フォーカス管理
    const focusableElements = modal.querySelectorAll(this.focusableElements);
    if (focusableElements.length > 0) {
      this.trapFocus(modal, focusableElements[0]);
    }

    // スクリーンリーダー通知
    this.announceStatus('モーダルダイアログが開きました');
  }

  closeModal() {
    const openModal = document.querySelector('[aria-modal="true"]');
    if (!openModal) return;

    openModal.setAttribute('aria-hidden', 'true');
    openModal.removeAttribute('aria-modal');
    openModal.removeAttribute('role');

    // フォーカス解放
    this.releaseFocus();

    // スクリーンリーダー通知
    this.announceStatus('モーダルダイアログが閉じました');
  }

  setupTabAccessibility() {
    document.addEventListener('keydown', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (!tab) return;

      const tablist = tab.closest('[role="tablist"]');
      if (!tablist) return;

      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
      const currentIndex = tabs.indexOf(tab);

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.activateTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.activateTab(tabs[(currentIndex + 1) % tabs.length]);
          break;
        case 'Home':
          e.preventDefault();
          this.activateTab(tabs[0]);
          break;
        case 'End':
          e.preventDefault();
          this.activateTab(tabs[tabs.length - 1]);
          break;
      }
    });
  }

  activateTab(tab) {
    if (!tab) return;

    // 他のタブを非アクティブに
    const tablist = tab.closest('[role="tablist"]');
    const allTabs = tablist.querySelectorAll('[role="tab"]');
    const allPanels = tablist.parentNode.querySelectorAll('[role="tabpanel"]');

    allTabs.forEach(t => {
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
    });

    allPanels.forEach(panel => {
      panel.setAttribute('aria-hidden', 'true');
    });

    // 選択されたタブをアクティブに
    tab.setAttribute('aria-selected', 'true');
    tab.setAttribute('tabindex', '0');
    tab.focus();

    // 対応するパネルを表示
    const panelId = tab.getAttribute('aria-controls');
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.setAttribute('aria-hidden', 'false');
    }

    // スクリーンリーダー通知
    const tabLabel = tab.textContent || tab.getAttribute('aria-label');
    this.announceStatus(`${tabLabel}タブが選択されました`);
  }

  setupTreeAccessibility() {
    document.addEventListener('keydown', (e) => {
      const treeitem = e.target.closest('[role="treeitem"]');
      if (!treeitem) return;

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          this.toggleTreeItem(treeitem);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.focusTreeItem(treeitem, 'previous');
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.focusTreeItem(treeitem, 'next');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.collapseTreeItem(treeitem);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.expandTreeItem(treeitem);
          break;
      }
    });
  }

  toggleTreeItem(treeitem) {
    const isExpanded = treeitem.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      this.collapseTreeItem(treeitem);
    } else {
      this.expandTreeItem(treeitem);
    }
  }

  expandTreeItem(treeitem) {
    treeitem.setAttribute('aria-expanded', 'true');
    const label = treeitem.textContent || treeitem.getAttribute('aria-label');
    this.announceStatus(`${label}が展開されました`);
  }

  collapseTreeItem(treeitem) {
    treeitem.setAttribute('aria-expanded', 'false');
    const label = treeitem.textContent || treeitem.getAttribute('aria-label');
    this.announceStatus(`${label}が折りたたまれました`);
  }

  focusTreeItem(treeitem, direction) {
    const tree = treeitem.closest('[role="tree"]');
    const items = Array.from(tree.querySelectorAll('[role="treeitem"]'));
    const currentIndex = items.indexOf(treeitem);

    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % items.length;
    } else {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    }

    const nextItem = items[nextIndex];
    if (nextItem) {
      nextItem.focus();
    }
  }

  // キーボードナビゲーション
  setupKeyboardNavigation() {
    // スキップリンクの作成
    this.createSkipLinks();

    // カスタムキーボードショートカット
    this.setupKeyboardShortcuts();

    // フォーカス可能な要素の順序管理
    this.setupRovingTabIndex();
  }

  createSkipLinks() {
    const skipLinks = [
      { href: '#main-content', text: 'メインコンテンツへ' },
      { href: '#navigation', text: 'ナビゲーションへ' },
      { href: '#search', text: '検索へ' },
      { href: '#footer', text: 'フッターへ' }
    ];

    const skipLinksContainer = document.createElement('div');
    skipLinksContainer.className = 'skip-links sr-only';
    skipLinksContainer.setAttribute('aria-hidden', 'true');

    skipLinks.forEach(link => {
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.text;
      a.className = 'skip-link';
      skipLinksContainer.appendChild(a);
    });

    document.body.insertBefore(skipLinksContainer, document.body.firstChild);

    // フォーカス時に表示
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        skipLinksContainer.setAttribute('aria-hidden', 'false');
        skipLinksContainer.classList.remove('sr-only');
      }
    });

    document.addEventListener('click', () => {
      skipLinksContainer.setAttribute('aria-hidden', 'true');
      skipLinksContainer.classList.add('sr-only');
    });
  }

  setupKeyboardShortcuts() {
    const shortcuts = {
      'h': () => this.focusElement('#navigation'),
      'm': () => this.focusElement('#main-content'),
      's': () => this.focusElement('#search'),
      '/': () => this.focusElement('#search input'),
      'b': () => this.focusElement('#bookmarks'),
      't': () => this.focusElement('#tabs'),
      '?': () => this.showKeyboardHelp()
    };

    document.addEventListener('keydown', (e) => {
      // Altキーとの組み合わせ、または通常のキー
      if (e.altKey && shortcuts[e.key.toLowerCase()]) {
        e.preventDefault();
        shortcuts[e.key.toLowerCase()]();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && shortcuts[e.key]) {
        // 検索フィールドでの/キー
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'INPUT' && activeElement.type === 'text') {
          return; // 検索フィールドでは通常動作
        }
        if (e.key === '/' && !this.isInputFocused()) {
          e.preventDefault();
          shortcuts['/']();
        }
      }
    });
  }

  setupRovingTabIndex() {
    // 複合コントロール内のフォーカス管理
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const container = e.target.closest('[data-roving-tabindex]');
        if (container) {
          const focusableElements = container.querySelectorAll(this.focusableElements);
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      }
    });
  }

  // スクリーンリーダー対応
  setupScreenReaderSupport() {
    // ページタイトル更新の通知
    this.setupPageTitleUpdates();

    // 動的コンテンツの通知
    this.setupDynamicContentAnnouncements();

    // プログレスバーとステータスの通知
    this.setupProgressAnnouncements();
  }

  setupPageTitleUpdates() {
    let lastTitle = document.title;

    const observer = new MutationObserver(() => {
      if (document.title !== lastTitle) {
        this.announceStatus(`ページタイトルが ${document.title} に変更されました`);
        lastTitle = document.title;
      }
    });

    observer.observe(document.querySelector('title'), {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  setupDynamicContentAnnouncements() {
    // 動的に追加されるコンテンツの監視
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              if (element.hasAttribute('data-announce')) {
                this.announceStatus(element.getAttribute('data-announce'));
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  setupProgressAnnouncements() {
    // プログレスバーの値変更を監視
    document.addEventListener('input', (e) => {
      const target = e.target;
      if (target.hasAttribute('role') && target.getAttribute('role') === 'progressbar') {
        const value = target.getAttribute('aria-valuenow');
        const max = target.getAttribute('aria-valuemax');
        if (value && max) {
          this.announceStatus(`進行状況: ${value} / ${max}`);
        }
      }
    });
  }

  // フォーカス管理
  setupFocusManagement() {
    // ページ読み込み時の初期フォーカス
    this.setupInitialFocus();

    // モーダル内のフォーカストラップ
    this.setupFocusTrap();

    // フォーカスインジケーターの改善
    this.setupFocusIndicators();
  }

  setupInitialFocus() {
    document.addEventListener('DOMContentLoaded', () => {
      // メインコンテンツにフォーカスを移動
      const mainContent = document.querySelector('main, [role="main"], #main-content');
      if (mainContent && !this.isInputFocused()) {
        // スキップリンクを経由してメインコンテンツにフォーカス
        const skipLink = document.querySelector('.skip-links a[href="#main-content"]');
        if (skipLink) {
          setTimeout(() => skipLink.focus(), 100);
        }
      }
    });
  }

  setupFocusTrap() {
    this.focusTrapStack = [];

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && this.focusTrapStack.length > 0) {
        const trap = this.focusTrapStack[this.focusTrapStack.length - 1];
        const focusableElements = trap.container.querySelectorAll(this.focusableElements);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });
  }

  trapFocus(container, initialFocus) {
    const trap = {
      container,
      previousFocus: document.activeElement
    };

    this.focusTrapStack.push(trap);

    if (initialFocus) {
      initialFocus.focus();
    }

    container.setAttribute('aria-hidden', 'false');
  }

  releaseFocus() {
    const trap = this.focusTrapStack.pop();
    if (trap && trap.previousFocus) {
      trap.previousFocus.focus();
    }
  }

  setupFocusIndicators() {
    // 高コントラスト時のフォーカスインジケーター
    const style = document.createElement('style');
    style.textContent = `
      *:focus-visible {
        outline: 3px solid var(--color-focus-ring, #0052cc);
        outline-offset: 2px;
      }

      @media (prefers-contrast: high) {
        *:focus-visible {
          outline: 3px solid #ffffff;
          outline-offset: 1px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ユーザー設定対応
  setupHighContrastSupport() {
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
    this.updateHighContrastMode(prefersHighContrast.matches);

    prefersHighContrast.addEventListener('change', (e) => {
      this.updateHighContrastMode(e.matches);
    });
  }

  setupReducedMotionSupport() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.updateReducedMotionMode(prefersReducedMotion.matches);

    prefersReducedMotion.addEventListener('change', (e) => {
      this.updateReducedMotionMode(e.matches);
    });
  }

  setupColorBlindSupport() {
    // カラーブラインドモードの検知と対応
    if (window.matchMedia) {
      const colorSchemes = [
        '(prefers-color-scheme: dark)',
        '(prefers-color-scheme: light)'
      ];

      colorSchemes.forEach(query => {
        const mediaQuery = window.matchMedia(query);
        mediaQuery.addEventListener('change', () => {
          this.updateColorScheme();
        });
      });

      this.updateColorScheme();
    }
  }

  setupFontSizeAdjustment() {
    // ブラウザのズームレベルを検知
    let lastZoom = this.getZoomLevel();

    window.addEventListener('resize', () => {
      const currentZoom = this.getZoomLevel();
      if (Math.abs(currentZoom - lastZoom) > 0.1) {
        this.announceStatus(`ズームレベルが ${Math.round(currentZoom * 100)}% に変更されました`);
        lastZoom = currentZoom;
      }
    });
  }

  // ユーティリティメソッド
  generateUniqueId() {
    return 'a11y-' + Math.random().toString(36).substr(2, 9);
  }

  getGenericLabel(element) {
    const type = element.type || element.tagName.toLowerCase();
    const labels = {
      text: 'テキスト入力',
      email: 'メールアドレス',
      password: 'パスワード',
      search: '検索',
      tel: '電話番号',
      url: 'URL',
      number: '数値',
      date: '日付',
      textarea: 'テキストエリア',
      select: '選択'
    };
    return labels[type] || '入力フィールド';
  }

  getValidationMessage(element) {
    if (element.validity.valueMissing) {
      return 'このフィールドは必須です';
    }
    if (element.validity.typeMismatch) {
      return '正しい形式で入力してください';
    }
    if (element.validity.tooShort) {
      return `最低 ${element.minLength} 文字以上入力してください`;
    }
    if (element.validity.tooLong) {
      return `最大 ${element.maxLength} 文字以内で入力してください`;
    }
    return '入力内容を確認してください';
  }

  announceStatus(message, priority = 'polite') {
    const region = priority === 'assertive' ? this.liveRegions.get('error') : this.liveRegions.get('notification');
    if (region) {
      region.textContent = message;
      // スクリーンリーダーが確実に読み上げるために少し遅延
      setTimeout(() => {
        region.textContent = '';
      }, 1000);
    }
  }

  announceError(message) {
    this.announceStatus(message, 'assertive');
  }

  setFieldError(element, message) {
    element.setAttribute('aria-invalid', 'true');
    element.setAttribute('aria-describedby', element.id + '-error');

    let errorElement = document.getElementById(element.id + '-error');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = element.id + '-error';
      errorElement.className = 'field-error';
      errorElement.setAttribute('role', 'alert');
      element.parentNode.insertBefore(errorElement, element.nextSibling);
    }
    errorElement.textContent = message;
  }

  clearFieldError(element) {
    element.setAttribute('aria-invalid', 'false');
    element.removeAttribute('aria-describedby');

    const errorElement = document.getElementById(element.id + '-error');
    if (errorElement) {
      errorElement.remove();
    }
  }

  focusElement(selector) {
    const element = document.querySelector(selector);
    if (element && typeof element.focus === 'function') {
      element.focus();
      if (element.setSelectionRange) {
        element.setSelectionRange(element.value.length, element.value.length);
      }
    }
  }

  isInputFocused() {
    const activeElement = document.activeElement;
    return activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'SELECT' ||
      activeElement.contentEditable === 'true'
    );
  }

  getZoomLevel() {
    return window.devicePixelRatio || 1;
  }

  updateHighContrastMode(enabled) {
    document.documentElement.setAttribute('data-high-contrast', enabled.toString());
  }

  updateReducedMotionMode(enabled) {
    document.documentElement.setAttribute('data-reduced-motion', enabled.toString());
  }

  updateColorScheme() {
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-color-scheme', darkMode ? 'dark' : 'light');
  }

  showKeyboardHelp() {
    const help = `
キーボードショートカット:
Alt + H: ナビゲーションにフォーカス
Alt + M: メインコンテンツにフォーカス
Alt + S: 検索にフォーカス
/: 検索フィールドにフォーカス
Alt + B: ブックマークにフォーカス
Alt + T: タブにフォーカス
`;

    this.announceStatus(help);
    console.log(help); // 開発者向けにも表示
  }
}

// グローバルインスタンス作成
const accessibilityManager = new AccessibilityManager();

// グローバルアクセス用
window.accessibilityManager = accessibilityManager;
