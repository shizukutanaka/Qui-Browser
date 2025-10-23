/**
 * VR Accessibility System
 * Unified accessibility features for VR browser (統合版)
 * @version 2.0.1
 * 設計原則: Robert C. MartinのSOLID原則を適用、シンプルで拡張可能な設計
 */

class VRAccessibilitySystem {
  constructor() {
    this.settings = {
      language: {
        current: 'ja-JP',
        available: ['ja-JP', 'en-US'],
        fallback: 'ja-JP'
      },
      textSize: {
        enabled: true,
        scale: 1.0, // 0.5 - 2.0
        minimum: 48 // pixels
      },
      highContrast: {
        enabled: false,
        theme: 'dark', // 'dark', 'light', 'yellow-black'
        ratio: 7.0 // WCAG AAA
      },
      colorBlindness: {
        enabled: false,
        type: 'none', // 'protanopia', 'deuteranopia', 'tritanopia', 'monochromacy'
        filter: null
      },
      reducedMotion: {
        enabled: false,
        disableAnimations: true,
        smoothTransitions: false
      },
      audioDescriptions: {
        enabled: false,
        voiceRate: 1.0,
        voicePitch: 1.0,
        volume: 0.8
      },
      captions: {
        enabled: false,
        size: 'medium', // 'small', 'medium', 'large'
        position: 'bottom', // 'top', 'bottom'
        background: true
      },
      focusIndicator: {
        enabled: true,
        size: 'large',
        color: '#00ffff',
        thickness: 4 // pixels
      },
      voiceControl: {
        enabled: false,
        language: 'ja-JP'
      },
      hapticFeedback: {
        enabled: true,
        intensity: 0.5,
        duration: 100,
        patterns: new Map()
      },
      cognitiveSupport: {
        simplifiedUI: false,
        reducedAnimations: false,
        clearLabels: true,
        audioCues: false,
        stepByStepGuidance: false
      },
      performance: {
        enabled: true,
        debounceDelay: 300,
        virtualScrollThreshold: 1000,
        cacheSize: 100,
        lazyLoadDelay: 100
      },
      advancedAccessibility: {
        enabled: false,
        keyboardNavigation: true,
        enhancedScreenReader: false,
        gestureRecognition: false,
        realTimeTranslation: false,
        contextAwareness: false,
        predictiveAssistance: false,
        adaptiveInterface: false
      }
    };

    this.cache = new Map();
    this.debounceTimers = new Map();
    this.observer = null;
    this.init();
  }

  /**
   * 翻訳データをロード
   */
  loadTranslations() {
    return {
      'ja-JP': {
        // メニュー関連
        'accessibility_settings': 'アクセシビリティ設定',
        'close_menu': 'メニューを閉じる',
        'large_text': '大きなテキスト',
        'high_contrast': 'ハイコントラスト',
        'color_support': '色覚サポート',
        'motion_reduction': 'モーション軽減',
        'voice_guide': '音声ガイド',
        'captions': 'キャプション',
        'voice_control': '音声コントロール',
        'haptic_feedback': '触覚フィードバック',
        'simplified_ui': '簡単化UI',

        // テーマ
        'dark': 'ダーク',
        'light': 'ライト',
        'yellow_black': '黄色・黒',

        // 色覚異常タイプ
        'none': 'なし',
        'protanopia': '第1色覚異常',
        'deuteranopia': '第2色覚異常',
        'tritanopia': '第3色覚異常',

        // 音声コマンド
        'command_received': 'コマンド',
        'unrecognized_command': '認識できないコマンドです。ヘルプと言ってください。',
        'available_commands': '利用可能なコマンド',
        'voice_recognition_started': '音声認識を開始しました',
        'voice_recognition_ended': '音声認識を終了しました',
        'error': 'エラー',
        'page_reading_started': 'ページの内容を読み上げます',
        'reading_completed': '読み上げを終了しました',
        'no_content_to_read': '読み上げる内容がありません',
        'settings_saved': '設定を保存しました',
        'setting_updated': 'をに設定しました',

        // メッセージ
        'back': '戻る',
        'forward': '進む',
        'refresh': '更新',
        'settings': '設定',
        'button': 'ボタン',
        'element': '要素',
        'step': 'ステップ',
        'form_item': '番目の項目です',
        'selected': 'が選択されました'
      },

      'en-US': {
        // Menu related
        'accessibility_settings': 'Accessibility Settings',
        'close_menu': 'Close Menu',
        'large_text': 'Large Text',
        'high_contrast': 'High Contrast',
        'color_support': 'Color Support',
        'motion_reduction': 'Motion Reduction',
        'voice_guide': 'Voice Guide',
        'captions': 'Captions',
        'voice_control': 'Voice Control',
        'haptic_feedback': 'Haptic Feedback',
        'simplified_ui': 'Simplified UI',

        // Themes
        'dark': 'Dark',
        'light': 'Light',
        'yellow_black': 'Yellow-Black',

        // Color blindness types
        'none': 'None',
        'protanopia': 'Protanopia',
        'deuteranopia': 'Deuteranopia',
        'tritanopia': 'Tritanopia',

        // Voice commands
        'command_received': 'Command',
        'unrecognized_command': 'Unrecognized command. Please say Help.',
        'available_commands': 'Available Commands',
        'voice_recognition_started': 'Voice recognition started',
        'voice_recognition_ended': 'Voice recognition ended',
        'error': 'Error',
        'page_reading_started': 'Reading page content',
        'reading_completed': 'Reading completed',
        'no_content_to_read': 'No content to read',
        'settings_saved': 'Settings saved',
        'setting_updated': 'set to',

        // Messages
        'back': 'Back',
        'forward': 'Forward',
        'refresh': 'Refresh',
        'settings': 'Settings',
        'button': 'Button',
        'element': 'Element',
        'step': 'Step',
        'form_item': 'item in form',
        'selected': 'selected'
      }
    };
  }

  /**
   * 翻訳を取得
   */
  t(key, params = {}) {
    const translation = this.translations[this.settings.language.current]?.[key] ||
                       this.translations[this.settings.language.fallback]?.[key] ||
                       key;

    // パラメータ置換
    return translation.replace(/{(\w+)}/g, (match, param) => params[param] || match);
  }

  /**
   * デバウンス処理で関数実行を遅延
   */
  debounce(func, delay, key) {
    if (!this.settings.performance.enabled) {
      return func.apply(this, arguments);
    }

    const timerKey = key || func.toString();
    const existingTimer = this.debounceTimers.get(timerKey);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      func.apply(this, Array.prototype.slice.call(arguments, 2));
      this.debounceTimers.delete(timerKey);
    }, delay || this.settings.performance.debounceDelay);

    this.debounceTimers.set(timerKey, timer);
    return timer;
  }

  /**
   * スロットル処理で関数実行を制限
   */
  throttle(func, limit, key) {
    if (!this.settings.performance.enabled) {
      return func.apply(this, arguments);
    }

    const timerKey = key || func.toString();
    const lastCall = this.cache.get(`throttle_${timerKey}`);

    if (!lastCall || Date.now() - lastCall > limit) {
      this.cache.set(`throttle_${timerKey}`, Date.now());
      return func.apply(this, Array.prototype.slice.call(arguments, 2));
    }
  }

  /**
   * メモ化機能で計算結果をキャッシュ
   */
  memoize(func, keyGenerator) {
    return (...args) => {
      if (!this.settings.performance.enabled) {
        return func.apply(this, args);
      }

      const cacheKey = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      const cached = this.cache.get(cacheKey);

      if (cached && cached.expiry > Date.now()) {
        return cached.result;
      }

      const result = func.apply(this, args);
      this.cache.set(cacheKey, {
        result: result,
        expiry: Date.now() + (this.settings.performance.cacheSize * 1000)
      });

      // キャッシュサイズ制限を適用
      if (this.cache.size > this.settings.performance.cacheSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      return result;
    };
  }

  /**
   * 遅延読み込み機能
   */
  lazyLoad(selector, callback, threshold = 0.1) {
    if (!this.settings.performance.enabled) {
      return callback();
    }

    const elements = document.querySelectorAll(selector);
    const observerOptions = {
      root: null,
      rootMargin: '50px',
      threshold: threshold
    };

    if (!this.observer) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target;
            const lazyCallback = element.getAttribute('data-lazy-callback');
            if (lazyCallback && this[lazyCallback]) {
              this[lazyCallback](element);
              this.observer.unobserve(element);
            }
          }
        });
      }, observerOptions);
    }

    elements.forEach(element => {
      element.setAttribute('data-lazy-callback', callback.name || callback.toString());
      this.observer.observe(element);
    });
  }

  /**
   * 仮想スクロール機能（大規模コンテンツ用）
   */
  createVirtualScroll(container, items, itemHeight, renderCallback) {
    if (!this.settings.performance.enabled || items.length < this.settings.performance.virtualScrollThreshold) {
      return this.renderAllItems(container, items, renderCallback);
    }

    const containerHeight = container.clientHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2; // バッファを含む
    const totalHeight = items.length * itemHeight;

    container.style.height = `${containerHeight}px`;
    container.style.overflow = 'auto';

    let startIndex = 0;
    let scrollElement = null;

    const renderItems = (start) => {
      const end = Math.min(start + visibleCount, items.length);
      const fragment = document.createDocumentFragment();

      for (let i = start; i < end; i++) {
        const itemElement = renderCallback(items[i], i);
        itemElement.style.position = 'absolute';
        itemElement.style.top = `${i * itemHeight}px`;
        itemElement.style.width = '100%';
        fragment.appendChild(itemElement);
      }

      if (scrollElement) {
        scrollElement.remove();
      }

      scrollElement = document.createElement('div');
      scrollElement.style.height = `${totalHeight}px`;
      scrollElement.style.position = 'relative';
      scrollElement.appendChild(fragment);

      container.appendChild(scrollElement);
    };

    container.addEventListener('scroll', this.throttle(() => {
      const scrollTop = container.scrollTop;
      const newStartIndex = Math.floor(scrollTop / itemHeight);
      if (newStartIndex !== startIndex) {
        startIndex = Math.max(0, newStartIndex - 1);
        renderItems(startIndex);
      }
    }, 100));

    renderItems(startIndex);
  }

  /**
   * 全てのアイテムを通常レンダリング
   */
  renderAllItems(container, items, renderCallback) {
    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      fragment.appendChild(renderCallback(item, index));
    });
    container.appendChild(fragment);
  }

  /**
   * ウェブワーカーを使用した重い処理の実行
   */
  runInWorker(workerScript, data) {
    return new Promise((resolve, reject) => {
      if (!this.settings.performance.enabled) {
        resolve(this.processInMainThread(data));
        return;
      }

      const worker = new Worker(workerScript);
      worker.postMessage(data);

      worker.onmessage = (e) => {
        resolve(e.data);
        worker.terminate();
      };

      worker.onerror = (error) => {
        reject(error);
        worker.terminate();
      };
    });
  }

  /**
   * 高度なアクセシビリティを適用
   */
  initAdvancedAccessibility() {
    if (!this.settings.advancedAccessibility.enabled) return;

    this.initKeyboardNavigation();
    this.initEnhancedScreenReader();
    this.initGestureRecognition();
    this.initRealTimeTranslation();
    this.initContextAwareness();
    this.initPredictiveAssistance();
    this.initAdaptiveInterface();
  }

  /**
   * 高度なキーボードナビゲーションを初期化
   */
  initKeyboardNavigation() {
    if (!this.settings.advancedAccessibility.keyboardNavigation) return;

    document.addEventListener('keydown', this.handleAdvancedKeyboardNavigation.bind(this));
    this.createKeyboardShortcuts();
  }

  /**
   * 高度なキーボードナビゲーションを適用
   */
  applyKeyboardNavigation() {
    if (!this.settings.advancedAccessibility.keyboardNavigation) return;

    // フォーカス可能な要素に追加のキーボードサポートを追加
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    focusableElements.forEach(element => {
      if (!element.hasAttribute('data-keyboard-enhanced')) {
        element.setAttribute('data-keyboard-enhanced', 'true');

        // 矢印キーによるナビゲーション
        element.addEventListener('keydown', (e) => {
          this.handleElementKeyNavigation(e, element);
        });
      }
    });

    // ランドマークナビゲーション
    this.createLandmarkNavigation();
  }

  /**
   * 高度なキーボードナビゲーションを処理
   */
  handleAdvancedKeyboardNavigation(e) {
    if (!this.settings.advancedAccessibility.keyboardNavigation) return;

    const keyActions = {
      'Alt+1': () => this.navigateToLandmark('main'),
      'Alt+2': () => this.navigateToLandmark('navigation'),
      'Alt+3': () => this.navigateToLandmark('complementary'),
      'Alt+4': () => this.navigateToLandmark('contentinfo'),
      'Alt+M': () => this.toggleAccessibilityMenu(),
      'Alt+R': () => this.readCurrentPage(),
      'Alt+S': () => this.saveSettings(),
      'Escape': () => this.handleEscapeKey(),
    };

    const keyCombo = `${e.altKey ? 'Alt+' : ''}${e.key}`;
    if (keyActions[keyCombo]) {
      e.preventDefault();
      keyActions[keyCombo]();
    }
  }

  /**
   * エレメントのキーナビゲーションを処理
   */
  handleElementKeyNavigation(e, element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    switch (e.key) {
      case 'ArrowRight':
        this.focusNearestElement(element, 'right', centerY);
        break;
      case 'ArrowLeft':
        this.focusNearestElement(element, 'left', centerY);
        break;
      case 'ArrowDown':
        this.focusNearestElement(element, 'down', centerX);
        break;
      case 'ArrowUp':
        this.focusNearestElement(element, 'up', centerX);
        break;
      case 'Enter':
      case ' ':
        if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
          element.click();
          this.triggerHapticFeedback('button-press');
        }
        break;
    }
  }

  /**
   * ランドマークナビゲーションを作成
   */
  createLandmarkNavigation() {
    const landmarks = {
      main: document.querySelector('main, [role="main"]'),
      navigation: document.querySelector('nav, [role="navigation"]'),
      complementary: document.querySelector('aside, [role="complementary"]'),
      contentinfo: document.querySelector('footer, [role="contentinfo"]')
    };

    Object.keys(landmarks).forEach(role => {
      const element = landmarks[role];
      if (element && !element.hasAttribute('data-landmark-nav')) {
        element.setAttribute('data-landmark-nav', role);
        element.setAttribute('tabindex', '0');
      }
    });
  }

  /**
   * ランドマークに移動
   */
  navigateToLandmark(role) {
    const landmark = document.querySelector(`[data-landmark-nav="${role}"]`);
    if (landmark) {
      landmark.focus();
      landmark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.speak(`移動しました：${role === 'main' ? 'メインコンテンツ' :
                   role === 'navigation' ? 'ナビゲーション' :
                   role === 'complementary' ? 'サイドバー' : 'フッター'}`);
    }
  }

  /**
   * キーボードショートカットを作成
   */
  createKeyboardShortcuts() {
    const shortcutsContainer = document.createElement('div');
    shortcutsContainer.id = 'keyboard-shortcuts';
    shortcutsContainer.className = 'keyboard-shortcuts';
    shortcutsContainer.innerHTML = `
      <div class="shortcuts-help">
        <h3>キーボードショートカット</h3>
        <dl>
          <dt>Alt + 1-4</dt><dd>ランドマーク間を移動</dd>
          <dt>Alt + M</dt><dd>アクセシビリティメニュー</dd>
          <dt>Alt + R</dt><dd>ページ読み上げ</dd>
          <dt>Alt + S</dt><dd>設定保存</dd>
          <dt>矢印キー</dt><dd>要素間を移動</dd>
          <dt>Escape</dt><dd>フォーカス解除</dd>
        </dl>
      </div>
    `;

    shortcutsContainer.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-size: 12px;
      z-index: 1000;
      max-width: 250px;
      opacity: 0;
      transition: opacity 0.3s;
    `;

    document.body.appendChild(shortcutsContainer);

    // ヘルプの表示/非表示
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F1') {
        const help = document.getElementById('keyboard-shortcuts');
        help.style.opacity = help.style.opacity === '0' ? '1' : '0';
      }
    });
  }

  /**
   * 最寄りの要素にフォーカス
   */
  focusNearestElement(currentElement, direction, centerLine) {
    const focusableElements = Array.from(document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => el !== currentElement && this.isVisible(el));

    let nearestElement = null;
    let nearestDistance = Infinity;

    focusableElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const elementCenter = direction === 'right' || direction === 'left'
        ? rect.top + rect.height / 2
        : rect.left + rect.width / 2;

      const distance = Math.abs(centerLine - elementCenter);

      if (direction === 'right' && rect.left > currentElement.getBoundingClientRect().right) {
        if (distance < nearestDistance) {
          nearestElement = element;
          nearestDistance = distance;
        }
      } else if (direction === 'left' && rect.right < currentElement.getBoundingClientRect().left) {
        if (distance < nearestDistance) {
          nearestElement = element;
          nearestDistance = distance;
        }
      } else if (direction === 'down' && rect.top > currentElement.getBoundingClientRect().bottom) {
        if (distance < nearestDistance) {
          nearestElement = element;
          nearestDistance = distance;
        }
      } else if (direction === 'up' && rect.bottom < currentElement.getBoundingClientRect().top) {
        if (distance < nearestDistance) {
          nearestElement = element;
          nearestDistance = distance;
        }
      }
    });

    if (nearestElement) {
      nearestElement.focus();
      nearestElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * 要素が表示されているかチェック
   */
  isVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           element.offsetParent !== null &&
           element.getBoundingClientRect().width > 0 &&
           element.getBoundingClientRect().height > 0;
  }

  /**
   * Escapeキーを処理
   */
  handleEscapeKey() {
    // モーダルやメニューを閉じる
    const activeModal = document.querySelector('.modal.active, .menu.open');
    if (activeModal) {
      activeModal.classList.remove('active', 'open');
      return;
    }

    // 現在のフォーカスを解除
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }

  /**
   * UI言語を更新
   */
  updateUILanguage() {
    // メニュー内のテキストを更新
    const menu = document.getElementById('vr-accessibility-menu');
    if (menu) {
      this.updateMenuLanguage(menu);
    }
  }

  /**
   * メニューの言語を更新
   */
  updateMenuLanguage(menu) {
    const header = menu.querySelector('.menu-header h2');
    if (header) header.textContent = this.t('accessibility_settings');

    const closeBtn = menu.querySelector('.close-btn');
    if (closeBtn) closeBtn.setAttribute('aria-label', this.t('close_menu'));

    // 各設定項目のラベルを更新
    const labels = menu.querySelectorAll('label');
    labels.forEach(label => {
      const text = label.textContent.trim();
      const translated = this.t(text.toLowerCase().replace(/\s+/g, '_'));
      if (translated !== text) {
        label.textContent = translated;
      }
    });
  }

  /**
   * 設定を適用
   */
  applySettings() {
    this.applyTextSize();
    this.applyHighContrast();
    this.applyColorBlindness();
    this.applyReducedMotion();
    this.applyFocusIndicator();
    this.applyCaptions();
    this.applyCognitiveSupport();
    this.applyAdvancedAccessibility();
  }

  /**
   * 認知サポートを適用
   */
  applyCognitiveSupport() {
    if (this.settings.cognitiveSupport.simplifiedUI) {
      this.applySimplifiedUI();
    } else {
      this.removeSimplifiedUI();
    }

    if (this.settings.cognitiveSupport.reducedAnimations) {
      this.applyReducedAnimations();
    }

    if (this.settings.cognitiveSupport.clearLabels) {
      this.applyClearLabels();
    }

    if (this.settings.cognitiveSupport.audioCues) {
      this.applyAudioCues();
    }

    if (this.settings.cognitiveSupport.stepByStepGuidance) {
      this.applyStepByStepGuidance();
    }
  }

  /**
   * 簡単化UIを適用
   */
  applySimplifiedUI() {
    // 複雑な要素を非表示または簡略化
    const complexElements = document.querySelectorAll('.complex-ui, .advanced-options, .sidebar, .toolbar');
    complexElements.forEach(element => {
      element.classList.add('simplified-hidden');
    });

    // 重要な要素にシンプルな代替を提供
    this.createSimpleNavigation();
  }

  /**
   * 簡単化UIを解除
   */
  removeSimplifiedUI() {
    const hiddenElements = document.querySelectorAll('.simplified-hidden');
    hiddenElements.forEach(element => {
      element.classList.remove('simplified-hidden');
    });

    // シンプルナビゲーションを削除
    const simpleNav = document.getElementById('simple-navigation');
    if (simpleNav) {
      simpleNav.remove();
    }
  }

  /**
   * アニメーション軽減を適用
   */
  applyReducedAnimations() {
    document.body.classList.add('reduced-animations');

    // アニメーションの無効化
    const style = document.createElement('style');
    style.id = 'reduced-animations-style';
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * クリアなラベルを適用
   */
  applyClearLabels() {
    // 曖昧なアイコンに明確なテキストラベルを追加
    const buttons = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
    buttons.forEach(button => {
      if (!button.textContent.trim() && !button.hasAttribute('data-original-label')) {
        // アイコンだけのボタンに説明を追加
        const iconText = this.getIconDescription(button);
        if (iconText) {
          button.setAttribute('data-original-label', 'true');
          button.setAttribute('aria-label', iconText);
        }
      }
    });
  }

  /**
   * アイコンの説明を取得
   */
  getIconDescription(button) {
    // クラス名やIDからアイコンの種類を推測
    const classList = Array.from(button.classList);

    const iconDescriptions = {
      'icon-home': 'ホーム',
      'icon-back': '戻る',
      'icon-forward': '進む',
      'icon-refresh': '更新',
      'icon-settings': '設定',
      'icon-search': '検索',
      'icon-menu': 'メニュー',
      'icon-close': '閉じる',
      'icon-play': '再生',
      'icon-pause': '一時停止',
      'icon-volume': '音量'
    };

    for (const className of classList) {
      if (iconDescriptions[className]) {
        return iconDescriptions[className];
      }
    }

    return null;
  }

  /**
   * 音声キューを適用
   */
  applyAudioCues() {
    // 重要な操作時に音声フィードバックを提供
    const importantElements = document.querySelectorAll('button, a, input[type="submit"]');
    importantElements.forEach(element => {
      if (!element.hasAttribute('data-audio-cue')) {
        element.setAttribute('data-audio-cue', 'true');

        element.addEventListener('click', () => {
          this.playAudioCue(element);
        });

        element.addEventListener('mouseenter', () => {
          if (element.matches(':focus')) {
            this.playHoverCue(element);
          }
        });
      }
    });
  }

  /**
   * 音声キューを再生
   */
  playAudioCue(element) {
    const label = element.textContent.trim() || element.getAttribute('aria-label') || 'ボタン';
    this.speak(`${label}が選択されました`);
  }

  /**
   * ホバー音声キューを再生
   */
  playHoverCue(element) {
    const label = element.textContent.trim() || element.getAttribute('aria-label') || '要素';
    // ホバー時は短い音声のみ
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(label);
      utterance.volume = 0.3;
      utterance.rate = 2.0;
      speechSynthesis.speak(utterance);
    }
  }

  /**
   * ステップバイステップガイダンスを適用
   */
  applyStepByStepGuidance() {
    // 複雑なフォームや操作にガイダンスを追加
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      if (!form.hasAttribute('data-guidance-added')) {
        form.setAttribute('data-guidance-added', 'true');
        this.addFormGuidance(form);
      }
    });
  }

  /**
   * フォームにガイダンスを追加
   */
  addFormGuidance(form) {
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach((input, index) => {
      input.addEventListener('focus', () => {
        const label = input.getAttribute('aria-label') ||
                     input.getAttribute('placeholder') ||
                     input.name ||
                     `ステップ ${index + 1}`;

        this.speak(`${label}。これはフォームの${index + 1}番目の項目です。`);
      });
    });
  }

  /**
   * シンプルナビゲーションを作成
   */
  createSimpleNavigation() {
    if (document.getElementById('simple-navigation')) return;

    const nav = document.createElement('div');
    nav.id = 'simple-navigation';
    nav.className = 'simple-navigation';
    nav.innerHTML = `
      <button onclick="window.history.back()" aria-label="前のページに戻る">← 戻る</button>
      <button onclick="window.history.forward()" aria-label="次のページに進む">進む →</button>
      <button onclick="window.location.reload()" aria-label="ページを更新する">更新</button>
      <button onclick="window.VRAccessibilitySystem.toggleAccessibilityMenu()" aria-label="アクセシビリティメニューを開く">設定</button>
    `;

    nav.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 10px;
      background: rgba(0, 0, 0, 0.8);
      padding: 10px;
      border-radius: 5px;
      z-index: 1000;
    `;

    document.body.appendChild(nav);
  }

  /**
   * キャプションを適用
   */
  applyCaptions() {
    if (!this.settings.captions.enabled) {
      this.hideAllCaptions();
      return;
    }

    // 動画要素にキャプションを追加
    this.addVideoCaptions();
    // 音声要素にキャプションを追加
    this.addAudioCaptions();
  }

  /**
   * 動画要素にキャプションを追加
   */
  addVideoCaptions() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      if (!video.hasAttribute('data-captions-added')) {
        const captionContainer = this.createCaptionContainer(video);
        video.parentNode.insertBefore(captionContainer, video.nextSibling);
        video.setAttribute('data-captions-added', 'true');

        // 動画の時間更新時にキャプションを更新
        video.addEventListener('timeupdate', () => {
          this.updateVideoCaptions(video, captionContainer);
        });

        // 動画が再生開始されたらキャプションを開始
        video.addEventListener('play', () => {
          this.startCaptionUpdates(video, captionContainer);
        });

        // 動画が停止されたらキャプションを停止
        video.addEventListener('pause', () => {
          this.stopCaptionUpdates();
        });
      }
    });
  }

  /**
   * 音声要素にキャプションを追加
   */
  addAudioCaptions() {
    const audios = document.querySelectorAll('audio');
    audios.forEach(audio => {
      if (!audio.hasAttribute('data-captions-added')) {
        const captionContainer = this.createCaptionContainer(audio);
        audio.parentNode.insertBefore(captionContainer, audio.nextSibling);
        audio.setAttribute('data-captions-added', 'true');

        // 音声の時間更新時にキャプションを更新
        audio.addEventListener('timeupdate', () => {
          this.updateAudioCaptions(audio, captionContainer);
        });

        // 音声が再生開始されたらキャプションを開始
        audio.addEventListener('play', () => {
          this.startCaptionUpdates(audio, captionContainer);
        });

        // 音声が停止されたらキャプションを停止
        audio.addEventListener('pause', () => {
          this.stopCaptionUpdates();
        });
      }
    });
  }

  /**
   * キャプションコンテナを作成
   */
  createCaptionContainer(media) {
    const container = document.createElement('div');
    container.className = 'caption-container';
    container.setAttribute('aria-live', 'polite');
    container.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: ${this.getCaptionFontSize()}px;
      font-family: Arial, sans-serif;
      text-align: center;
      max-width: 80%;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // メディア要素が相対位置の場合の調整
    if (getComputedStyle(media.parentNode).position === 'static') {
      media.parentNode.style.position = 'relative';
    }

    return container;
  }

  /**
   * 動画キャプションを更新
   */
  updateVideoCaptions(video, container) {
    const currentTime = video.currentTime;
    const track = this.getCurrentCaptionTrack(video, currentTime);

    if (track && track.text) {
      container.textContent = track.text;
      container.style.opacity = '1';
    } else {
      container.style.opacity = '0';
    }
  }

  /**
   * 音声キャプションを更新
   */
  updateAudioCaptions(audio, container) {
    // 音声ファイルの場合、外部キャプションが必要
    // ここでは簡易的にタイムスタンプベースで処理
    this.updateVideoCaptions(audio, container);
  }

  /**
   * 現在のキャプショントラックを取得
   */
  getCurrentCaptionTrack(media, currentTime) {
    // トラック要素からキャプションを取得
    const tracks = media.querySelectorAll('track[kind="captions"], track[kind="subtitles"]');
    if (tracks.length === 0) return null;

    // VTT形式のキャプションをパース（簡易版）
    const track = tracks[0];
    if (track && track.src) {
      return this.parseVTTTrack(track.src, currentTime);
    }

    return null;
  }

  /**
   * VTTトラックをパース（簡易版）
   */
  parseVTTTrack(src, currentTime) {
    // 実際の実装では、VTTファイルをフェッチしてパースする必要がある
    // ここではデモ用の簡易実装
    const demoCaptions = [
      { start: 0, end: 5, text: 'これはデモのキャプションです。' },
      { start: 5, end: 10, text: '動画の再生に合わせて表示されます。' },
      { start: 10, end: 15, text: 'アクセシビリティ機能により提供されています。' }
    ];

    return demoCaptions.find(caption =>
      currentTime >= caption.start && currentTime <= caption.end
    ) || null;
  }

  /**
   * キャプション更新を開始
   */
  startCaptionUpdates(media, container) {
    if (this.captionUpdateInterval) {
      clearInterval(this.captionUpdateInterval);
    }

    this.captionUpdateInterval = setInterval(() => {
      if (media.paused) return;

      if (media.tagName === 'VIDEO') {
        this.updateVideoCaptions(media, container);
      } else {
        this.updateAudioCaptions(media, container);
      }
    }, 100);
  }

  /**
   * キャプション更新を停止
   */
  stopCaptionUpdates() {
    if (this.captionUpdateInterval) {
      clearInterval(this.captionUpdateInterval);
      this.captionUpdateInterval = null;
    }

    // すべてのキャプションを非表示に
    const containers = document.querySelectorAll('.caption-container');
    containers.forEach(container => {
      container.style.opacity = '0';
    });
  }

  /**
   * すべてのキャプションを非表示に
   */
  hideAllCaptions() {
    this.stopCaptionUpdates();
    const containers = document.querySelectorAll('.caption-container');
    containers.forEach(container => {
      container.remove();
    });

    // データ属性をクリア
    const medias = document.querySelectorAll('[data-captions-added]');
    medias.forEach(media => {
      media.removeAttribute('data-captions-added');
    });
  }

  /**
   * キャプションのフォントサイズを取得
   */
  getCaptionFontSize() {
    const sizes = { small: 14, medium: 16, large: 18 };
    return sizes[this.settings.captions.size] || 16;
  }

  /**
   * テキストサイズを適用
   */
  applyTextSize() {
    if (!this.settings.textSize.enabled) return;
    const scale = this.settings.textSize.scale;
    const minSize = this.settings.textSize.minimum;
    document.documentElement.style.fontSize = `${Math.max(scale * 16, minSize)}px`;
  }

  /**
   * ハイコントラストを適用
   */
  applyHighContrast() {
    if (!this.settings.highContrast.enabled) return;
    const theme = this.settings.highContrast.theme;
    document.body.className = `high-contrast-${theme}`;
  }

  /**
   * 色覚異常フィルターを適用
   */
  applyColorBlindness() {
    if (!this.settings.colorBlindness.enabled) return;
    // フィルター実装（簡略化）
    const filter = this.getColorBlindnessFilter(this.settings.colorBlindness.type);
    document.body.style.filter = filter;
  }

  /**
   * モーション軽減を適用
   */
  applyReducedMotion() {
    if (!this.settings.reducedMotion.enabled) return;
    document.body.classList.add('reduced-motion');
  }

  /**
   * フォーカスインジケーターを適用
   */
  applyFocusIndicator() {
    // フォーカスインジケーターの実装
    const style = document.createElement('style');
    style.textContent = `
      .focus-indicator {
        outline: ${this.settings.focusIndicator.thickness}px solid ${this.settings.focusIndicator.color};
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 色覚異常フィルターを取得
   */
  getColorBlindnessFilter(type) {
    const filters = {
      protanopia: 'url(#protanopia)',
      deuteranopia: 'url(#deuteranopia)',
      tritanopia: 'url(#tritanopia)',
      monochromacy: 'grayscale(100%)'
    };
    return filters[type] || 'none';
  }

  /**
   * 設定を保存
   */
  saveSettings() {
    localStorage.setItem('vr-accessibility-settings', JSON.stringify(this.settings));
  }

  /**
   * 設定を読み込み
   */
  loadSettings() {
    const saved = localStorage.getItem('vr-accessibility-settings');
    if (saved) {
      this.settings = { ...this.settings, ...JSON.parse(saved) };
    }
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    // 設定変更時のイベントリスナー
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.toggleAccessibilityMenu();
      }
    });
  }

  /**
   * アクセシビリティメニューをトグル
   */
  toggleAccessibilityMenu() {
    let menu = document.getElementById('vr-accessibility-menu');
    if (menu) {
      menu.remove();
      return;
    }

    menu = this.createAccessibilityMenu();
    document.body.appendChild(menu);
    this.triggerHapticFeedback('menu-open');
  }

  /**
   * アクセシビリティメニューを作成
   */
  createAccessibilityMenu() {
    const menu = document.createElement('div');
    menu.id = 'vr-accessibility-menu';
    menu.className = 'vr-accessibility-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'アクセシビリティ設定');

    menu.innerHTML = `
      <div class="menu-header">
        <h2>${this.t('accessibility_settings')}</h2>
        <button class="close-btn" onclick="window.VRAccessibilitySystem.toggleAccessibilityMenu()"
                aria-label="${this.t('close_menu')}">&times;</button>
      </div>
      <div class="menu-content">
        <div class="setting-group">
          <label>
            <input type="checkbox" ${this.settings.textSize.enabled ? 'checked' : ''}
                   onchange="window.VRAccessibilitySystem.updateSetting('textSize.enabled', this.checked)">
            ${this.t('large_text')}
          </label>
          <input type="range" min="0.5" max="2.0" step="0.1"
                 value="${this.settings.textSize.scale}"
                 onchange="window.VRAccessibilitySystem.updateSetting('textSize.scale', parseFloat(this.value))"
                 ${!this.settings.textSize.enabled ? 'disabled' : ''}>
        </div>

        <div class="setting-group">
          <label>
            <input type="checkbox" ${this.settings.highContrast.enabled ? 'checked' : ''}
                   onchange="window.VRAccessibilitySystem.updateSetting('highContrast.enabled', this.checked)">
            ${this.t('high_contrast')}
          </label>
          <select onchange="window.VRAccessibilitySystem.updateSetting('highContrast.theme', this.value)"
                  ${!this.settings.highContrast.enabled ? 'disabled' : ''}>
            <option value="dark" ${this.settings.highContrast.theme === 'dark' ? 'selected' : ''}>${this.t('dark')}</option>
            <option value="light" ${this.settings.highContrast.theme === 'light' ? 'selected' : ''}>${this.t('light')}</option>
            <option value="yellow-black" ${this.settings.highContrast.theme === 'yellow-black' ? 'selected' : ''}>${this.t('yellow_black')}</option>
          </select>
        </div>

        <div class="setting-group">
          <label>
            <input type="checkbox" ${this.settings.colorBlindness.enabled ? 'checked' : ''}
                   onchange="window.VRAccessibilitySystem.updateSetting('colorBlindness.enabled', this.checked)">
            ${this.t('color_support')}
          </label>
          <select onchange="window.VRAccessibilitySystem.updateSetting('colorBlindness.type', this.value)"
                  ${!this.settings.colorBlindness.enabled ? 'disabled' : ''}>
            <option value="none" ${this.settings.colorBlindness.type === 'none' ? 'selected' : ''}>${this.t('none')}</option>
            <option value="protanopia" ${this.settings.colorBlindness.type === 'protanopia' ? 'selected' : ''}>${this.t('protanopia')}</option>
            <option value="deuteranopia" ${this.settings.colorBlindness.type === 'deuteranopia' ? 'selected' : ''}>${this.t('deuteranopia')}</option>
            <option value="tritanopia" ${this.settings.colorBlindness.type === 'tritanopia' ? 'selected' : ''}>${this.t('tritanopia')}</option>
          </select>
        </div>

        <div class="setting-group">
          <label>
            <input type="checkbox" ${this.settings.reducedMotion.enabled ? 'checked' : ''}
                   onchange="window.VRAccessibilitySystem.updateSetting('reducedMotion.enabled', this.checked)">
            ${this.t('motion_reduction')}
          </label>
        </div>

        <div class="setting-group">
          <label>
            <input type="checkbox" ${this.settings.audioDescriptions.enabled ? 'checked' : ''}
                   onchange="window.VRAccessibilitySystem.updateSetting('audioDescriptions.enabled', this.checked)">
            ${this.t('voice_guide')}
          </label>
        </div>

        <div class="setting-group">
          <label>
            <input type="checkbox" ${this.settings.captions.enabled ? 'checked' : ''}
                   onchange="window.VRAccessibilitySystem.updateSetting('captions.enabled', this.checked)">
            ${this.t('captions')}
          </label>
        </div>

        <div class="setting-group">
          <label>
            <input type="checkbox" ${this.settings.voiceControl.enabled ? 'checked' : ''}
                   onchange="window.VRAccessibilitySystem.updateSetting('voiceControl.enabled', this.checked)">
            ${this.t('voice_control')}
          </label>
        </div>

        <div class="setting-group">
          <label>
            <input type="checkbox" ${this.settings.hapticFeedback.enabled ? 'checked' : ''}
                   onchange="window.VRAccessibilitySystem.updateSetting('hapticFeedback.enabled', this.checked)">
            ${this.t('haptic_feedback')}
          </label>
        </div>

        <div class="setting-group">
          <label>
            <input type="checkbox" ${this.settings.cognitiveSupport.simplifiedUI ? 'checked' : ''}
                   onchange="window.VRAccessibilitySystem.updateSetting('cognitiveSupport.simplifiedUI', this.checked)">
            ${this.t('simplified_ui')}
          </label>
        </div>
      </div>
    `;

    // メニュー用のスタイルを追加
    this.addMenuStyles();

    return menu;
  }

  /**
   * メニュー用のスタイルを追加
   */
  addMenuStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .vr-accessibility-menu {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
        z-index: 10000;
        max-width: 400px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        font-family: Arial, sans-serif;
      }

      .menu-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        border-bottom: 1px solid #00ffff;
        padding-bottom: 10px;
      }

      .menu-header h2 {
        margin: 0;
        color: #00ffff;
        font-size: 1.2em;
      }

      .close-btn {
        background: none;
        border: none;
        color: #00ffff;
        font-size: 24px;
        cursor: pointer;
        padding: 5px;
        border-radius: 3px;
      }

      .close-btn:hover {
        background: rgba(0, 255, 255, 0.2);
      }

      .menu-content {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }

      .setting-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        border: 1px solid rgba(0, 255, 255, 0.3);
        border-radius: 5px;
      }

      .setting-group label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-weight: bold;
      }

      .setting-group input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: #00ffff;
      }

      .setting-group input[type="range"] {
        width: 100%;
        height: 6px;
        background: rgba(0, 255, 255, 0.3);
        border-radius: 3px;
        outline: none;
      }

      .setting-group input[type="range"]::-webkit-slider-thumb {
        appearance: none;
        width: 20px;
        height: 20px;
        background: #00ffff;
        border-radius: 50%;
        cursor: pointer;
      }

      .setting-group select {
        background: rgba(0, 255, 255, 0.1);
        color: white;
        border: 1px solid #00ffff;
        padding: 5px;
        border-radius: 3px;
      }

      .setting-group select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .setting-group input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      @media (max-width: 480px) {
        .vr-accessibility-menu {
          padding: 15px;
          font-size: 14px;
        }

        .setting-group {
          padding: 8px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 音声認識を初期化
   */
  initVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('音声認識がサポートされていません');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = this.settings.voiceControl.language;

    this.recognition.onstart = () => {
      this.isListening = true;
    this.speak(this.t('voice_recognition_started'));
    };

    this.recognition.onresult = (event) => {
      const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      this.processVoiceCommand(command);
    };

    this.recognition.onerror = (event) => {
      console.error('音声認識エラー:', event.error);
      this.speak(`${this.t('error')}: ${event.error}`);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.settings.voiceControl.enabled) {
        // 連続モードでない場合は自動で再開しない
        this.speak(this.t('voice_recognition_ended'));
      }
    };

    if (this.settings.voiceControl.enabled) {
      this.startVoiceRecognition();
    }
  }

  /**
   * 音声認識を開始
   */
  startVoiceRecognition() {
    if (this.recognition && !this.isListening) {
      this.recognition.start();
    }
  }

  /**
   * 音声認識を停止
   */
  stopVoiceRecognition() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * 音声コマンドを処理
   */
  processVoiceCommand(command) {
    this.speak(`コマンド: ${command}`);

    // 基本的なコマンド処理
    const commands = {
      'メニューを開く': () => this.toggleAccessibilityMenu(),
      'メニューを閉じる': () => {
        const menu = document.getElementById('vr-accessibility-menu');
        if (menu) this.toggleAccessibilityMenu();
      },
      '音声ガイドを有効': () => this.updateSetting('audioDescriptions.enabled', true),
      '音声ガイドを無効': () => this.updateSetting('audioDescriptions.enabled', false),
      'テキストを拡大': () => this.updateSetting('textSize.scale', Math.min(this.settings.textSize.scale + 0.2, 2.0)),
      'テキストを縮小': () => this.updateSetting('textSize.scale', Math.max(this.settings.textSize.scale - 0.2, 0.5)),
      'ハイコントラストを有効': () => this.updateSetting('highContrast.enabled', true),
      'ハイコントラストを無効': () => this.updateSetting('highContrast.enabled', false),
      'ヘルプ': () => this.speakAvailableCommands(),
      '設定を保存': () => this.saveSettings(),
      'ページを読み上げ': () => this.readCurrentPage()
    };

    // コマンドの類似度チェック
    for (const [key, action] of Object.entries(commands)) {
      if (command.includes(key) || this.calculateSimilarity(command, key) > 0.8) {
        action();
        return;
      }
    }

    this.speak('認識できないコマンドです。ヘルプと言ってください。');
  }

  /**
   * 文字列類似度を計算（簡易版）
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * レーベンシュタイン距離を計算
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 利用可能なコマンドを読み上げる
   */
  speakAvailableCommands() {
    const commands = [
      'メニューを開く、メニューを閉じる',
      '音声ガイドを有効、無効',
      'テキストを拡大、縮小',
      'ハイコントラストを有効、無効',
      'ページを読み上げ、設定を保存、ヘルプ'
    ].join('、');

    this.speak(`利用可能なコマンド: ${commands}`);
  }

  /**
   * 現在のページを読み上げる
   */
  readCurrentPage() {
    const text = document.body.innerText || document.body.textContent;
    if (text && text.trim()) {
      const sentences = text.split(/[。．！？]/).filter(s => s.trim());
      this.speak('ページの内容を読み上げます');
      this.speakPageContent(sentences, 0);
    } else {
      this.speak('読み上げる内容がありません');
    }
  }

  /**
   * ページ内容を順次読み上げ
   */
  speakPageContent(sentences, index) {
    if (index >= sentences.length) {
      this.speak('読み上げを終了しました');
      return;
    }

    const sentence = sentences[index].trim();
    if (sentence) {
      this.speak(sentence);
      // 次の文を遅延読み上げ
      setTimeout(() => {
        this.speakPageContent(sentences, index + 1);
      }, 2000);
    } else {
      this.speakPageContent(sentences, index + 1);
    }
  }

  /**
   * 触覚フィードバック
   */
  triggerHapticFeedback(pattern = 'default') {
    if (!navigator.vibrate || !this.settings.hapticFeedback.enabled) return;

    const patterns = this.getHapticPatterns();
    const hapticPattern = patterns[pattern] || patterns.default;

    // 振動の強度を適用
    const intensity = this.settings.hapticFeedback.intensity;
    const scaledPattern = hapticPattern.map(duration =>
      typeof duration === 'number' ? Math.round(duration * intensity) : duration
    );

    navigator.vibrate(scaledPattern);
  }

  /**
   * ハプティックパターンを取得
   */
  getHapticPatterns() {
    return {
      // 基本パターン
      default: [100],
      short: [50],
      long: [300],
      double: [100, 50, 100],

      // 通知パターン
      success: [100, 30, 100, 30, 200],
      error: [200, 50, 200, 50, 200],
      warning: [100, 30, 100, 30, 100, 30, 200],

      // UI操作パターン
      'button-press': [50],
      'menu-open': [100, 30, 50],
      'menu-close': [50, 30, 100],
      'navigation': [80, 40, 80],

      // テキスト入力パターン
      'typing': [30],
      'delete': [100, 30, 50],
      'enter': [150, 50, 100],

      // メディアパターン
      'play': [100, 50, 100],
      'pause': [150],
      'volume-change': [50, 25, 50, 25, 75],

      // 認知サポートパターン
      'focus-gained': [200],
      'focus-lost': [100, 50, 100],
      'step-complete': [100, 30, 100, 30, 200],
      'task-complete': [200, 100, 200, 100, 300],

      // カスタムパターン（ユーザー定義）
      ...this.settings.hapticFeedback.patterns
    };
  }

  /**
   * カスタムハプティックパターンを追加
   */
  addHapticPattern(name, pattern) {
    if (!this.settings.hapticFeedback.patterns) {
      this.settings.hapticFeedback.patterns = new Map();
    }
    this.settings.hapticFeedback.patterns.set(name, pattern);
    this.saveSettings();
  }

  /**
   * ハプティックパターンを削除
   */
  removeHapticPattern(name) {
    if (this.settings.hapticFeedback.patterns) {
      this.settings.hapticFeedback.patterns.delete(name);
      this.saveSettings();
    }
  }

  /**
   * シーケンシャルなハプティックフィードバック
   */
  triggerSequentialFeedback(patterns, interval = 200) {
    if (!navigator.vibrate || !this.settings.hapticFeedback.enabled) return;

    patterns.forEach((pattern, index) => {
      setTimeout(() => {
        this.triggerHapticFeedback(pattern);
      }, index * interval);
    });
  }

  /**
   * 状況に応じたハプティックフィードバックを自動適用
   */
  applyContextualHaptics() {
    // ボタンクリック時のフィードバック
    document.addEventListener('click', (e) => {
      if (e.target.matches('button, [role="button"]')) {
        this.triggerHapticFeedback('button-press');
      }
    });

    // フォーム送信時のフィードバック
    document.addEventListener('submit', () => {
      this.triggerHapticFeedback('success');
    });

    // エラーが発生した時のフィードバック
    document.addEventListener('error', () => {
      this.triggerHapticFeedback('error');
    }, true);

    // フォーカス変更時のフィードバック
    document.addEventListener('focusin', (e) => {
      if (e.target.matches('input, textarea, select, button, a')) {
        this.triggerHapticFeedback('focus-gained');
      }
    });

    document.addEventListener('focusout', (e) => {
      if (e.target.matches('input, textarea, select, button, a')) {
        this.triggerHapticFeedback('focus-lost');
      }
    });
  }
}

// グローバルインスタンス
window.VRAccessibilitySystem = new VRAccessibilitySystem();
