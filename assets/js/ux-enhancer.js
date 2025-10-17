/**
 * Qui Browser UX Enhancer
 * ユーザー体験の向上とインタラクションの改善
 *
 * 機能:
 * - マイクロインタラクションの追加
 * - フィードバックアニメーション
 * - スムースなトランジション
 * - ジェスチャー対応
 * - アクセシビリティ対応のインタラクション
 * - ユーザーフロー最適化
 */

class UXEnhancer {
  constructor() {
    this.animations = new Map();
    this.interactions = new Map();
    this.feedbackQueue = [];
    this.gestureHandlers = new Map();

    this.init();
  }

  init() {
    this.setupMicroInteractions();
    this.setupFeedbackAnimations();
    this.setupSmoothTransitions();
    this.setupGestureInteractions();
    this.setupAccessibilityInteractions();
    this.setupUserFlowOptimizations();
    this.setupPerformanceFeedback();
  }

  // マイクロインタラクションの設定
  setupMicroInteractions() {
    this.setupButtonInteractions();
    this.setupInputInteractions();
    this.setupCardInteractions();
    this.setupNavigationInteractions();
    this.setupLoadingInteractions();
  }

  setupButtonInteractions() {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button, .btn, [role="button"]');
      if (button && !button.disabled) {
        this.createRippleEffect(button, e);
        this.playClickFeedback(button);
      }
    });

    // ホバー時のマイクロインタラクション
    document.addEventListener('mouseenter', (e) => {
      const button = e.target.closest('button, .btn, [role="button"]');
      if (button && !button.disabled) {
        this.addHoverEffect(button);
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const button = e.target.closest('button, .btn, [role="button"]');
      if (button) {
        this.removeHoverEffect(button);
      }
    }, true);
  }

  createRippleEffect(element, event) {
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';

    // 既存のrippleを削除
    const existingRipple = element.querySelector('.ripple-effect');
    if (existingRipple) {
      existingRipple.remove();
    }

    element.appendChild(ripple);

    // アニメーション完了後に削除
    setTimeout(() => {
      if (ripple.parentElement) {
        ripple.remove();
      }
    }, 600);
  }

  playClickFeedback(element) {
    element.classList.add('click-feedback');
    setTimeout(() => {
      element.classList.remove('click-feedback');
    }, 150);
  }

  addHoverEffect(element) {
    element.classList.add('hover-lift');
  }

  removeHoverEffect(element) {
    element.classList.remove('hover-lift');
  }

  setupInputInteractions() {
    document.addEventListener('focusin', (e) => {
      const input = e.target;
      if (input.matches('input, textarea, select')) {
        this.addFocusEffect(input);
      }
    });

    document.addEventListener('focusout', (e) => {
      const input = e.target;
      if (input.matches('input, textarea, select')) {
        this.removeFocusEffect(input);
      }
    });

    // 入力時のフィードバック
    document.addEventListener('input', (e) => {
      const input = e.target;
      if (input.matches('input, textarea')) {
        this.handleInputFeedback(input);
      }
    });
  }

  addFocusEffect(element) {
    const container = element.closest('.input-container') || element.parentElement;
    container.classList.add('input-focused');

    // ラベルアニメーション
    const label = container.querySelector('label');
    if (label) {
      label.classList.add('label-float');
    }
  }

  removeFocusEffect(element) {
    const container = element.closest('.input-container') || element.parentElement;
    if (!element.value) {
      container.classList.remove('input-focused');
      const label = container.querySelector('label');
      if (label) {
        label.classList.remove('label-float');
      }
    }
  }

  handleInputFeedback(input) {
    const container = input.closest('.input-container') || input.parentElement;

    // 入力内容のバリデーション表示
    if (input.checkValidity()) {
      container.classList.remove('input-error');
      container.classList.add('input-valid');
    } else {
      container.classList.remove('input-valid');
      container.classList.add('input-error');
    }

    // 文字数カウンター
    this.updateCharacterCount(input);
  }

  updateCharacterCount(input) {
    const counter = input.parentElement.querySelector('.char-counter');
    if (counter) {
      const current = input.value.length;
      const max = input.maxLength;
      counter.textContent = `${current}/${max}`;
      counter.classList.toggle('near-limit', current > max * 0.8);
      counter.classList.toggle('at-limit', current >= max);
    }
  }

  setupCardInteractions() {
    document.addEventListener('mouseenter', (e) => {
      const card = e.target.closest('.card, .card-mobile');
      if (card) {
        this.addCardHoverEffect(card);
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const card = e.target.closest('.card, .card-mobile');
      if (card) {
        this.removeCardHoverEffect(card);
      }
    }, true);

    // カードクリック時のインタラクション
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.card, .card-mobile');
      if (card) {
        this.handleCardClick(card);
      }
    });
  }

  addCardHoverEffect(card) {
    card.classList.add('card-hover');
    // 影のアニメーション
    card.style.transform = 'translateY(-2px)';
    card.style.boxShadow = 'var(--shadow-overlay)';
  }

  removeCardHoverEffect(card) {
    card.classList.remove('card-hover');
    card.style.transform = '';
    card.style.boxShadow = '';
  }

  handleCardClick(card) {
    card.classList.add('card-clicked');
    setTimeout(() => {
      card.classList.remove('card-clicked');
    }, 200);
  }

  setupNavigationInteractions() {
    // ナビゲーション項目のアクティブ状態管理
    document.addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item, .navbar-mobile .nav-tab');
      if (navItem) {
        this.handleNavigationClick(navItem);
      }
    });

    // スクロール時のナビゲーションバー挙動
    this.setupScrollNavigation();
  }

  handleNavigationClick(navItem) {
    // アクティブ状態の切り替え
    const navContainer = navItem.closest('.navbar, .navbar-mobile');
    const siblings = navContainer.querySelectorAll('.nav-item, .nav-tab');

    siblings.forEach(sibling => {
      sibling.classList.remove('active');
    });

    navItem.classList.add('active');

    // クリックフィードバック
    this.playClickFeedback(navItem);
  }

  setupScrollNavigation() {
    let lastScrollY = window.scrollY;
    const navbar = document.querySelector('.navbar');

    if (navbar) {
      window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          // 下スクロール - ナビゲーションバーを隠す
          navbar.classList.add('navbar-hidden');
        } else {
          // 上スクロール - ナビゲーションバーを表示
          navbar.classList.remove('navbar-hidden');
        }

        lastScrollY = currentScrollY;
      });
    }
  }

  setupLoadingInteractions() {
    // ローディング状態の管理
    this.setupLoadingStates();
    this.setupSkeletonLoading();
    this.setupProgressIndicators();
  }

  setupLoadingStates() {
    // ボタンのローディング状態
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-loading]');
      if (button) {
        this.setButtonLoading(button, true);
      }
    });
  }

  setButtonLoading(button, loading) {
    const originalText = button.textContent;
    const loadingText = button.getAttribute('data-loading-text') || '読み込み中...';

    if (loading) {
      button.disabled = true;
      button.setAttribute('data-original-text', originalText);
      button.innerHTML = `
        <span class="loading-spinner"></span>
        ${loadingText}
      `;
      button.classList.add('loading');
    } else {
      button.disabled = false;
      button.textContent = button.getAttribute('data-original-text') || originalText;
      button.classList.remove('loading');
    }
  }

  setupSkeletonLoading() {
    // スケルトンローディングの管理
    const skeletonElements = document.querySelectorAll('[data-skeleton]');

    skeletonElements.forEach(element => {
      const skeletonType = element.getAttribute('data-skeleton');
      this.applySkeletonLoading(element, skeletonType);
    });
  }

  applySkeletonLoading(element, type) {
    const skeletonHTML = this.getSkeletonHTML(type);

    element.innerHTML = skeletonHTML;
    element.classList.add('skeleton-loading');

    // 実際のコンテンツ読み込み完了時にスケルトンを削除
    this.loadActualContent(element);
  }

  getSkeletonHTML(type) {
    switch (type) {
      case 'card':
        return `
          <div class="skeleton-card">
            <div class="skeleton-image"></div>
            <div class="skeleton-title"></div>
            <div class="skeleton-text"></div>
            <div class="skeleton-text short"></div>
          </div>
        `;
      case 'list':
        return `
          <div class="skeleton-list">
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
            <div class="skeleton-item"></div>
          </div>
        `;
      default:
        return '<div class="skeleton-text"></div>';
    }
  }

  async loadActualContent(element) {
    // 実際のコンテンツ読み込み（遅延）
    setTimeout(() => {
      element.classList.remove('skeleton-loading');
      // 実際のコンテンツをここで設定
    }, 2000);
  }

  setupProgressIndicators() {
    // プログレスバーの管理
    this.progressBars = new Map();

    document.addEventListener('progress-start', (e) => {
      this.showProgressBar(e.detail.id, e.detail.options);
    });

    document.addEventListener('progress-update', (e) => {
      this.updateProgressBar(e.detail.id, e.detail.progress);
    });

    document.addEventListener('progress-end', (e) => {
      this.hideProgressBar(e.detail.id);
    });
  }

  showProgressBar(id, options = {}) {
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar-container';
    progressBar.innerHTML = `
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      <div class="progress-text">${options.text || ''}</div>
    `;

    document.body.appendChild(progressBar);
    this.progressBars.set(id, progressBar);

    // アニメーションで表示
    setTimeout(() => {
      progressBar.classList.add('visible');
    }, 10);
  }

  updateProgressBar(id, progress) {
    const progressBar = this.progressBars.get(id);
    if (progressBar) {
      const fill = progressBar.querySelector('.progress-fill');
      fill.style.width = `${progress}%`;
    }
  }

  hideProgressBar(id) {
    const progressBar = this.progressBars.get(id);
    if (progressBar) {
      progressBar.classList.remove('visible');
      setTimeout(() => {
        progressBar.remove();
        this.progressBars.delete(id);
      }, 300);
    }
  }

  // フィードバックアニメーション
  setupFeedbackAnimations() {
    this.setupSuccessAnimations();
    this.setupErrorAnimations();
    this.setupToastNotifications();
    this.setupTooltipInteractions();
  }

  setupSuccessAnimations() {
    document.addEventListener('success', (e) => {
      this.showSuccessFeedback(e.target, e.detail);
    });
  }

  setupErrorAnimations() {
    document.addEventListener('error', (e) => {
      this.showErrorFeedback(e.target, e.detail);
    });
  }

  showSuccessFeedback(element, options = {}) {
    this.showFeedbackAnimation(element, 'success', options);
  }

  showErrorFeedback(element, options = {}) {
    this.showFeedbackAnimation(element, 'error', options);
  }

  showFeedbackAnimation(element, type, options = {}) {
    const feedback = document.createElement('div');
    feedback.className = `feedback-animation feedback-${type}`;
    feedback.innerHTML = `
      <div class="feedback-icon">${this.getFeedbackIcon(type)}</div>
      <div class="feedback-text">${options.message || ''}</div>
    `;

    // 要素にフィードバックを追加
    element.appendChild(feedback);

    // アニメーション
    setTimeout(() => {
      feedback.classList.add('animate');
    }, 10);

    // 自動削除
    setTimeout(() => {
      feedback.classList.add('fade-out');
      setTimeout(() => {
        if (feedback.parentElement) {
          feedback.remove();
        }
      }, 300);
    }, options.duration || 3000);
  }

  getFeedbackIcon(type) {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '';
    }
  }

  setupToastNotifications() {
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'toast-container';
    document.body.appendChild(this.toastContainer);

    document.addEventListener('show-toast', (e) => {
      this.showToast(e.detail);
    });
  }

  showToast(options = {}) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${options.type || 'info'}`;
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon">${this.getFeedbackIcon(options.type)}</div>
        <div class="toast-text">${options.message || ''}</div>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    this.toastContainer.appendChild(toast);

    // アニメーションで表示
    setTimeout(() => {
      toast.classList.add('visible');
    }, 10);

    // 自動削除
    setTimeout(() => {
      this.hideToast(toast);
    }, options.duration || 5000);
  }

  hideToast(toast) {
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 300);
  }

  setupTooltipInteractions() {
    document.addEventListener('mouseenter', (e) => {
      const element = e.target;
      if (element.hasAttribute('data-tooltip')) {
        this.showTooltip(element);
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const element = e.target;
      if (element.hasAttribute('data-tooltip')) {
        this.hideTooltip();
      }
    }, true);
  }

  showTooltip(element) {
    const text = element.getAttribute('data-tooltip');
    const position = element.getAttribute('data-tooltip-position') || 'top';

    const tooltip = document.createElement('div');
    tooltip.className = `tooltip tooltip-${position}`;
    tooltip.textContent = text;

    document.body.appendChild(tooltip);

    // 位置調整
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top, left;

    switch (position) {
      case 'top':
        top = rect.top - tooltipRect.height - 8;
        left = rect.left + (rect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = rect.bottom + 8;
        left = rect.left + (rect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = rect.top + (rect.height - tooltipRect.height) / 2;
        left = rect.left - tooltipRect.width - 8;
        break;
      case 'right':
        top = rect.top + (rect.height - tooltipRect.height) / 2;
        left = rect.right + 8;
        break;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    // アニメーションで表示
    setTimeout(() => {
      tooltip.classList.add('visible');
    }, 10);

    this.currentTooltip = tooltip;
  }

  hideTooltip() {
    if (this.currentTooltip) {
      this.currentTooltip.classList.remove('visible');
      setTimeout(() => {
        if (this.currentTooltip && this.currentTooltip.parentElement) {
          this.currentTooltip.remove();
        }
      }, 300);
      this.currentTooltip = null;
    }
  }

  // スムースなトランジション
  setupSmoothTransitions() {
    this.setupPageTransitions();
    this.setupElementTransitions();
    this.setupScrollAnimations();
  }

  setupPageTransitions() {
    // ページ遷移時のトランジション
    document.addEventListener('page-transition', (e) => {
      this.handlePageTransition(e.detail);
    });
  }

  handlePageTransition(options = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'page-transition-overlay';
    overlay.style.backgroundColor = options.color || '#ffffff';

    document.body.appendChild(overlay);

    // フェードイン
    setTimeout(() => {
      overlay.classList.add('fade-in');
    }, 10);

    // 遷移完了後にフェードアウト
    setTimeout(() => {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }, options.duration || 1000);
  }

  setupElementTransitions() {
    // 要素の表示/非表示トランジション
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const element = mutation.target;
          if (element.classList.contains('fade-in')) {
            this.handleFadeIn(element);
          } else if (element.classList.contains('fade-out')) {
            this.handleFadeOut(element);
          }
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class']
    });
  }

  handleFadeIn(element) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';

    requestAnimationFrame(() => {
      element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    });
  }

  handleFadeOut(element) {
    element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    element.style.opacity = '0';
    element.style.transform = 'translateY(-20px)';
  }

  setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('[data-scroll-animate]').forEach(element => {
      observer.observe(element);
    });
  }

  // ジェスチャーインタラクション
  setupGestureInteractions() {
    this.setupSwipeGestures();
    this.setupPinchGestures();
    this.setupDragAndDrop();
  }

  setupSwipeGestures() {
    let startX = 0;
    let startY = 0;
    let isTracking = false;

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isTracking = true;
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!isTracking || e.touches.length !== 1) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      // スワイプ判定
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          this.handleSwipeRight();
        } else {
          this.handleSwipeLeft();
        }
        isTracking = false;
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      isTracking = false;
    });
  }

  setupPinchGestures() {
    let initialDistance = 0;

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        const currentDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialDistance;

        if (scale > 1.2) {
          this.handlePinchZoomIn();
        } else if (scale < 0.8) {
          this.handlePinchZoomOut();
        }
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      initialDistance = 0;
    });
  }

  getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  setupDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
      const element = e.target;
      if (element.draggable) {
        element.classList.add('dragging');
      }
    });

    document.addEventListener('dragend', (e) => {
      const element = e.target;
      element.classList.remove('dragging');
    });

    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dropZone = e.target.closest('[data-drop-zone]');
      if (dropZone) {
        dropZone.classList.add('drag-over');
      }
    });

    document.addEventListener('dragleave', (e) => {
      const dropZone = e.target.closest('[data-drop-zone]');
      if (dropZone) {
        dropZone.classList.remove('drag-over');
      }
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      const dropZone = e.target.closest('[data-drop-zone]');
      if (dropZone) {
        dropZone.classList.remove('drag-over');
        this.handleDrop(dropZone, e.dataTransfer);
      }
    });
  }

  // アクセシビリティ対応インタラクション
  setupAccessibilityInteractions() {
    this.setupKeyboardNavigation();
    this.setupScreenReaderFeedback();
    this.setupHighContrastSupport();
  }

  setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      // Tabキーの拡張
      if (e.key === 'Tab') {
        this.handleTabNavigation(e);
      }

      // Enter/Spaceキーのアクティブ化
      if (e.key === 'Enter' || e.key === ' ') {
        this.handleActivation(e);
      }

      // Escapeキーのキャンセル
      if (e.key === 'Escape') {
        this.handleEscape(e);
      }
    });
  }

  handleTabNavigation(e) {
    const activeElement = document.activeElement;

    // フォーカス可能な要素の循環
    if (e.shiftKey) {
      if (!activeElement || activeElement === document.body) {
        this.focusLastFocusableElement();
        e.preventDefault();
      }
    }
  }

  handleActivation(e) {
    const element = e.target;
    if (element.hasAttribute('data-activatable') ||
        element.getAttribute('role') === 'button' ||
        element.tagName === 'SUMMARY') {
      element.click();
      e.preventDefault();
    }
  }

  handleEscape(e) {
    // モーダルやポップアップの閉じる
    const modal = document.querySelector('[role="dialog"][aria-hidden="false"]');
    if (modal) {
      this.closeModal(modal);
      e.preventDefault();
    }

    // ツールチップの非表示
    this.hideTooltip();
  }

  setupScreenReaderFeedback() {
    // 動的コンテンツの変更をスクリーンリーダーに通知
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          this.announceContentChange('コンテンツが追加されました');
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  announceContentChange(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      announcement.remove();
    }, 1000);
  }

  setupHighContrastSupport() {
    // 高コントラストモードの検知と対応
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      document.documentElement.classList.add('high-contrast');
    }

    window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
      document.documentElement.classList.toggle('high-contrast', e.matches);
    });
  }

  // ユーザーフロー最適化
  setupUserFlowOptimizations() {
    this.setupProgressiveDisclosure();
    this.setupContextualHelp();
    this.setupOnboardingFlow();
  }

  setupProgressiveDisclosure() {
    // プログレッシブディスクロージャー
    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-toggle]');
      if (toggle) {
        this.handleProgressiveDisclosure(toggle);
      }
    });
  }

  handleProgressiveDisclosure(toggle) {
    const targetId = toggle.getAttribute('data-toggle');
    const target = document.getElementById(targetId);

    if (target) {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', (!isExpanded).toString());
      target.setAttribute('aria-hidden', isExpanded.toString());

      // アニメーション
      if (isExpanded) {
        this.collapseElement(target);
      } else {
        this.expandElement(target);
      }
    }
  }

  expandElement(element) {
    element.style.display = 'block';
    element.style.maxHeight = '0';
    element.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      element.style.transition = 'max-height 0.3s ease';
      element.style.maxHeight = element.scrollHeight + 'px';
    });

    setTimeout(() => {
      element.style.maxHeight = '';
      element.style.overflow = '';
    }, 300);
  }

  collapseElement(element) {
    element.style.maxHeight = element.scrollHeight + 'px';
    element.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      element.style.transition = 'max-height 0.3s ease';
      element.style.maxHeight = '0';
    });

    setTimeout(() => {
      element.style.display = 'none';
      element.style.maxHeight = '';
      element.style.overflow = '';
    }, 300);
  }

  setupContextualHelp() {
    // コンテキストヘルプの管理
    document.addEventListener('mouseenter', (e) => {
      const element = e.target;
      if (element.hasAttribute('data-help')) {
        this.showContextualHelp(element);
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const element = e.target;
      if (element.hasAttribute('data-help')) {
        this.hideContextualHelp();
      }
    }, true);
  }

  showContextualHelp(element) {
    const helpText = element.getAttribute('data-help');
    const help = document.createElement('div');
    help.className = 'contextual-help';
    help.textContent = helpText;

    document.body.appendChild(help);

    // 要素の位置に配置
    const rect = element.getBoundingClientRect();
    help.style.top = `${rect.bottom + 8}px`;
    help.style.left = `${rect.left}px`;

    setTimeout(() => {
      help.classList.add('visible');
    }, 10);

    this.currentHelp = help;
  }

  hideContextualHelp() {
    if (this.currentHelp) {
      this.currentHelp.classList.remove('visible');
      setTimeout(() => {
        if (this.currentHelp && this.currentHelp.parentElement) {
          this.currentHelp.remove();
        }
      }, 300);
      this.currentHelp = null;
    }
  }

  setupOnboardingFlow() {
    // オンボーディングフローの管理
    if (!localStorage.getItem('onboarding_completed')) {
      this.startOnboarding();
    }
  }

  startOnboarding() {
    const steps = [
      { target: '.navbar', content: 'ここがナビゲーションバーです。' },
      { target: '.main-content', content: 'メインコンテンツが表示されます。' },
      { target: '[data-action="new-tab"]', content: '新しいタブを開くにはここをクリックします。' }
    ];

    let currentStep = 0;

    const showStep = () => {
      if (currentStep >= steps.length) {
        this.completeOnboarding();
        return;
      }

      const step = steps[currentStep];
      const target = document.querySelector(step.target);

      if (target) {
        this.showOnboardingStep(target, step.content, () => {
          currentStep++;
          showStep();
        });
      } else {
        currentStep++;
        showStep();
      }
    };

    showStep();
  }

  showOnboardingStep(target, content, onNext) {
    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';

    const step = document.createElement('div');
    step.className = 'onboarding-step';
    step.innerHTML = `
      <div class="onboarding-content">${content}</div>
      <button class="btn btn-primary onboarding-next">次へ</button>
    `;

    overlay.appendChild(step);
    document.body.appendChild(overlay);

    // ターゲットをハイライト
    const rect = target.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.className = 'onboarding-highlight';
    highlight.style.top = `${rect.top - 4}px`;
    highlight.style.left = `${rect.left - 4}px`;
    highlight.style.width = `${rect.width + 8}px`;
    highlight.style.height = `${rect.height + 8}px`;

    overlay.appendChild(highlight);

    // 次へボタンのクリックで次のステップへ
    step.querySelector('.onboarding-next').addEventListener('click', () => {
      overlay.remove();
      onNext();
    });
  }

  completeOnboarding() {
    localStorage.setItem('onboarding_completed', 'true');
    this.showToast({
      type: 'success',
      message: 'オンボーディングが完了しました！'
    });
  }

  // パフォーマンスフィードバック
  setupPerformanceFeedback() {
    // 遅い操作のフィードバック
    this.setupSlowOperationFeedback();
    this.setupLoadingStateFeedback();
  }

  setupSlowOperationFeedback() {
    // 処理時間が長い操作の検知
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const startTime = Date.now();
      const result = await originalFetch(...args);
      const duration = Date.now() - startTime;

      if (duration > 2000) {
        this.showPerformanceWarning('ネットワークリクエストが遅いです');
      }

      return result;
    };
  }

  setupLoadingStateFeedback() {
    // ローディング状態の自動管理
    document.addEventListener('loading-start', (e) => {
      const element = e.target;
      element.classList.add('loading');
    });

    document.addEventListener('loading-end', (e) => {
      const element = e.target;
      element.classList.remove('loading');
    });
  }

  showPerformanceWarning(message) {
    this.showToast({
      type: 'warning',
      message: message,
      duration: 3000
    });
  }

  // ユーティリティメソッド
  dispatchEvent(eventName, detail = {}) {
    const event = new CustomEvent(`ux:${eventName}`, { detail });
    document.dispatchEvent(event);
  }

  handleSwipeLeft() {
    this.dispatchEvent('swipe-left');
  }

  handleSwipeRight() {
    this.dispatchEvent('swipe-right');
  }

  handlePinchZoomIn() {
    this.dispatchEvent('pinch-zoom-in');
  }

  handlePinchZoomOut() {
    this.dispatchEvent('pinch-zoom-out');
  }

  handleDrop(dropZone, dataTransfer) {
    this.dispatchEvent('drop', { dropZone, dataTransfer });
  }

  focusLastFocusableElement() {
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const lastElement = focusableElements[focusableElements.length - 1];
    if (lastElement) {
      lastElement.focus();
    }
  }

  closeModal(modal) {
    modal.setAttribute('aria-hidden', 'true');
    this.dispatchEvent('modal-closed', { modal });
  }
}

// グローバルインスタンス作成
const uxEnhancer = new UXEnhancer();

// グローバルアクセス用
window.uxEnhancer = uxEnhancer;
