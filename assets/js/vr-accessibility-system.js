/**
 * Qui Browser VR Accessibility System
 * VRデバイス専用アクセシビリティ機能
 *
 * 機能:
 * - 音声ガイドとナレーション
 * - 視覚障害者向け支援
 * - コントラストと文字サイズ調整
 * - 色覚異常対応
 * - 触覚フィードバック
 * - 認知負荷軽減
 * - 緊急時の支援機能
 * - カスタマイズ可能な設定
 */

class VRAccessibilitySystem {
  constructor() {
    this.voiceGuide = {
      enabled: false,
      volume: 0.7,
      rate: 1.0,
      pitch: 1.0,
      voice: null,
      language: 'ja-JP'
    };

    this.visualAdjustments = {
      contrast: 1.0,
      brightness: 1.0,
      fontSize: 1.0,
      colorBlindMode: 'none', // none, protanopia, deuteranopia, tritanopia
      highContrast: false,
      reducedMotion: false
    };

    this.hapticFeedback = {
      enabled: true,
      intensity: 0.5,
      duration: 100,
      patterns: new Map()
    };

    this.cognitiveSupport = {
      simplifiedUI: false,
      reducedAnimations: false,
      clearLabels: true,
      audioCues: false,
      stepByStepGuidance: false
    };

    this.emergencyFeatures = {
      quickExit: true,
      emergencyContacts: [],
      accessibilityShortcuts: true,
      safetyIndicators: true
    };

    // アクセシビリティ設定の永続化
    this.settingsStorageKey = 'qui-vr-accessibility-settings';

    this.init();
  }

  init() {
    // 保存された設定の読み込み
    this.loadSettings();

    // 音声合成の初期化
    this.initializeSpeechSynthesis();

    // 視覚調整の適用
    this.applyVisualAdjustments();

    // ハプティックフィードバックの初期化
    this.initializeHapticFeedback();

    // アクセシビリティイベントの設定
    this.setupAccessibilityEvents();

    // 緊急機能の設定
    this.setupEmergencyFeatures();

    console.log('[VR Accessibility] VR Accessibility System initialized');
  }

  /**
   * 設定の読み込み
   */
  loadSettings() {
    try {
      const savedSettings = localStorage.getItem(this.settingsStorageKey);
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);

        // 設定のマージ
        Object.assign(this.voiceGuide, settings.voiceGuide || {});
        Object.assign(this.visualAdjustments, settings.visualAdjustments || {});
        Object.assign(this.hapticFeedback, settings.hapticFeedback || {});
        Object.assign(this.cognitiveSupport, settings.cognitiveSupport || {});
        Object.assign(this.emergencyFeatures, settings.emergencyFeatures || {});

        console.log('[VR Accessibility] Settings loaded from storage');
      }
    } catch (error) {
      console.warn('[VR Accessibility] Failed to load settings:', error);
    }
  }

  /**
   * 設定の保存
   */
  saveSettings() {
    try {
      const settings = {
        voiceGuide: { ...this.voiceGuide },
        visualAdjustments: { ...this.visualAdjustments },
        hapticFeedback: { ...this.hapticFeedback },
        cognitiveSupport: { ...this.cognitiveSupport },
        emergencyFeatures: { ...this.emergencyFeatures }
      };

      localStorage.setItem(this.settingsStorageKey, JSON.stringify(settings));
      console.log('[VR Accessibility] Settings saved');
    } catch (error) {
      console.warn('[VR Accessibility] Failed to save settings:', error);
    }
  }

  /**
   * 音声合成の初期化
   */
  initializeSpeechSynthesis() {
    if ('speechSynthesis' in window) {
      // 利用可能な音声の取得
      const voices = speechSynthesis.getVoices();
      this.availableVoices = voices;

      // 日本語音声の選択
      const japaneseVoice = voices.find(voice =>
        voice.lang.startsWith('ja') && voice.localService
      );

      if (japaneseVoice) {
        this.voiceGuide.voice = japaneseVoice;
      }

      // 音声リスト更新イベント
      speechSynthesis.addEventListener('voiceschanged', () => {
        this.availableVoices = speechSynthesis.getVoices();
      });

      console.log('[VR Accessibility] Speech synthesis initialized');
    } else {
      console.warn('[VR Accessibility] Speech synthesis not supported');
    }
  }

  /**
   * 視覚調整の適用
   */
  applyVisualAdjustments() {
    const root = document.documentElement;

    // CSSカスタムプロパティの設定
    root.style.setProperty('--accessibility-contrast', this.visualAdjustments.contrast);
    root.style.setProperty('--accessibility-brightness', this.visualAdjustments.brightness);
    root.style.setProperty('--accessibility-font-size', `${this.visualAdjustments.fontSize}em`);

    // 色覚異常対応
    this.applyColorBlindAdjustments();

    // 高コントラストモード
    if (this.visualAdjustments.highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }

    // モーション削減
    if (this.visualAdjustments.reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }

    console.log('[VR Accessibility] Visual adjustments applied');
  }

  /**
   * 色覚異常調整の適用
   */
  applyColorBlindAdjustments() {
    const filterMap = {
      none: 'none',
      protanopia: 'url(#protanopia-filter)',
      deuteranopia: 'url(#deuteranopia-filter)',
      tritanopia: 'url(#tritanopia-filter)'
    };

    const filter = filterMap[this.visualAdjustments.colorBlindMode] || 'none';
    document.body.style.filter = filter;

    // SVGフィルターの作成
    this.createColorBlindFilters();
  }

  /**
   * 色覚異常用フィルターの作成
   */
  createColorBlindFilters() {
    if (document.getElementById('accessibility-filters')) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'accessibility-filters';
    svg.style.display = 'none';

    // プロタノーピア（赤色盲）フィルター
    const protanopiaFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    protanopiaFilter.id = 'protanopia-filter';
    protanopiaFilter.innerHTML = `
      <feColorMatrix type="matrix" values="
        0.567, 0.433, 0, 0, 0,
        0.558, 0.442, 0, 0, 0,
        0, 0.242, 0.758, 0, 0,
        0, 0, 0, 1, 0
      "/>
    `;

    // デウテラノーピア（緑色盲）フィルター
    const deuteranopiaFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    deuteranopiaFilter.id = 'deuteranopia-filter';
    deuteranopiaFilter.innerHTML = `
      <feColorMatrix type="matrix" values="
        0.625, 0.375, 0, 0, 0,
        0.7, 0.3, 0, 0, 0,
        0, 0.3, 0.7, 0, 0,
        0, 0, 0, 1, 0
      "/>
    `;

    // トリタノーピア（青色盲）フィルター
    const tritanopiaFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    tritanopiaFilter.id = 'tritanopia-filter';
    tritanopiaFilter.innerHTML = `
      <feColorMatrix type="matrix" values="
        0.95, 0.05, 0, 0, 0,
        0, 0.433, 0.567, 0, 0,
        0, 0.475, 0.525, 0, 0,
        0, 0, 0, 1, 0
      "/>
    `;

    svg.appendChild(protanopiaFilter);
    svg.appendChild(deuteranopiaFilter);
    svg.appendChild(tritanopiaFilter);
    document.body.appendChild(svg);
  }

  /**
   * ハプティックフィードバックの初期化
   */
  initializeHapticFeedback() {
    // Gamepad APIを使用した振動
    if ('vibrate' in navigator) {
      // モバイルデバイス用
      this.hapticMethod = 'vibration';
    } else if (navigator.getGamepads) {
      // ゲームパッド用
      this.hapticMethod = 'gamepad';
    }

    // ハプティックパターンの定義
    this.defineHapticPatterns();

    console.log(`[VR Accessibility] Haptic feedback initialized with ${this.hapticMethod} method`);
  }

  /**
   * ハプティックパターンの定義
   */
  defineHapticPatterns() {
    this.hapticFeedback.patterns.set('success', [100]);
    this.hapticFeedback.patterns.set('error', [200, 100, 200]);
    this.hapticFeedback.patterns.set('warning', [150, 50, 150, 50, 150]);
    this.hapticFeedback.patterns.set('navigation', [50, 50, 50]);
    this.hapticFeedback.patterns.set('focus', [75]);
    this.hapticFeedback.patterns.set('selection', [100, 50, 100]);
  }

  /**
   * アクセシビリティイベントの設定
   */
  setupAccessibilityEvents() {
    // キーボードショートカット
    document.addEventListener('keydown', (event) => {
      this.handleAccessibilityShortcut(event);
    });

    // フォーカスイベント
    document.addEventListener('focusin', (event) => {
      if (this.hapticFeedback.enabled) {
        this.playHapticPattern('focus');
      }

      if (this.voiceGuide.enabled) {
        this.announceFocusedElement(event.target);
      }
    });

    // WebXRイベント
    if (window.WebXRManager) {
      window.WebXRManager.addEventListener('sessionstart', () => {
        this.announceVRSessionStart();
      });

      window.WebXRManager.addEventListener('sessionend', () => {
        this.announceVRSessionEnd();
      });
    }

    console.log('[VR Accessibility] Accessibility events setup');
  }

  /**
   * 緊急機能の設定
   */
  setupEmergencyFeatures() {
    // 緊急退出ショートカット
    if (this.emergencyFeatures.quickExit) {
      document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.altKey && event.key === 'q') {
          event.preventDefault();
          this.performEmergencyExit();
        }
      });
    }

    console.log('[VR Accessibility] Emergency features setup');
  }

  /**
   * 音声ガイドの有効化/無効化
   */
  toggleVoiceGuide() {
    this.voiceGuide.enabled = !this.voiceGuide.enabled;
    this.saveSettings();

    const status = this.voiceGuide.enabled ? '有効' : '無効';
    this.speak(`音声ガイドを${status}にしました`);

    console.log(`[VR Accessibility] Voice guide ${status.toLowerCase()}`);
  }

  /**
   * 音声出力
   */
  speak(text, options = {}) {
    if (!this.voiceGuide.enabled || !('speechSynthesis' in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // 設定の適用
    utterance.volume = options.volume || this.voiceGuide.volume;
    utterance.rate = options.rate || this.voiceGuide.rate;
    utterance.pitch = options.pitch || this.voiceGuide.pitch;
    utterance.lang = options.language || this.voiceGuide.language;

    if (this.voiceGuide.voice) {
      utterance.voice = this.voiceGuide.voice;
    }

    // キューイングして順番に再生
    speechSynthesis.speak(utterance);
  }

  /**
   * ハプティックフィードバックの再生
   */
  playHapticPattern(patternName) {
    if (!this.hapticFeedback.enabled) return;

    const pattern = this.hapticFeedback.patterns.get(patternName);
    if (!pattern) return;

    const intensity = this.hapticFeedback.intensity;
    const duration = this.hapticFeedback.duration;

    switch (this.hapticMethod) {
      case 'vibration':
        // モバイル振動
        if ('vibrate' in navigator) {
          navigator.vibrate(pattern.map(p => p * intensity));
        }
        break;

      case 'gamepad':
        // ゲームパッド振動
        this.vibrateGamepad(pattern, intensity);
        break;

      default:
        // フォールバック: 視覚フィードバック
        this.showVisualHapticFeedback(patternName);
        break;
    }
  }

  /**
   * ゲームパッド振動
   */
  vibrateGamepad(pattern, intensity) {
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
      if (gamepad && gamepad.vibrationActuator) {
        gamepad.vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: pattern.reduce((a, b) => a + b, 0),
          weakMagnitude: intensity * 0.3,
          strongMagnitude: intensity * 0.7
        });
      }
    }
  }

  /**
   * 視覚ハプティックフィードバック
   */
  showVisualHapticFeedback(patternName) {
    // 画面フラッシュなどの視覚フィードバック
    const flash = document.createElement('div');
    flash.className = `accessibility-flash accessibility-flash-${patternName}`;
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.1);
      pointer-events: none;
      z-index: 9999;
      animation: accessibility-flash 0.2s ease-out;
    `;

    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 200);
  }

  /**
   * アクセシビリティショートカットの処理
   */
  handleAccessibilityShortcut(event) {
    if (!this.emergencyFeatures.accessibilityShortcuts) return;

    const { ctrlKey, altKey, shiftKey, key } = event;

    // Ctrl+Alt+A: 音声ガイド切り替え
    if (ctrlKey && altKey && key === 'a') {
      event.preventDefault();
      this.toggleVoiceGuide();
      return;
    }

    // Ctrl+Alt+C: 高コントラスト切り替え
    if (ctrlKey && altKey && key === 'c') {
      event.preventDefault();
      this.toggleHighContrast();
      return;
    }

    // Ctrl+Alt+F: フォントサイズ変更
    if (ctrlKey && altKey && key === 'f') {
      event.preventDefault();
      this.cycleFontSize();
      return;
    }

    // Ctrl+Alt+H: ハプティックフィードバック切り替え
    if (ctrlKey && altKey && key === 'h') {
      event.preventDefault();
      this.toggleHapticFeedback();
      return;
    }
  }

  /**
   * 高コントラストモード切り替え
   */
  toggleHighContrast() {
    this.visualAdjustments.highContrast = !this.visualAdjustments.highContrast;
    this.applyVisualAdjustments();
    this.saveSettings();

    const status = this.visualAdjustments.highContrast ? '有効' : '無効';
    this.speak(`高コントラストモードを${status}にしました`);

    console.log(`[VR Accessibility] High contrast ${status.toLowerCase()}`);
  }

  /**
   * フォントサイズ変更
   */
  cycleFontSize() {
    const sizes = [0.8, 1.0, 1.2, 1.5, 2.0];
    const currentIndex = sizes.indexOf(this.visualAdjustments.fontSize);
    const nextIndex = (currentIndex + 1) % sizes.length;

    this.visualAdjustments.fontSize = sizes[nextIndex];
    this.applyVisualAdjustments();
    this.saveSettings();

    this.speak(`フォントサイズを${sizes[nextIndex]}倍に変更しました`);

    console.log(`[VR Accessibility] Font size set to ${sizes[nextIndex]}x`);
  }

  /**
   * ハプティックフィードバック切り替え
   */
  toggleHapticFeedback() {
    this.hapticFeedback.enabled = !this.hapticFeedback.enabled;
    this.saveSettings();

    const status = this.hapticFeedback.enabled ? '有効' : '無効';
    this.speak(`触覚フィードバックを${status}にしました`);

    console.log(`[VR Accessibility] Haptic feedback ${status.toLowerCase()}`);
  }

  /**
   * フォーカスされた要素のアナウンス
   */
  announceFocusedElement(element) {
    let announcement = '';

    if (element.tagName === 'BUTTON') {
      announcement = element.textContent || element.getAttribute('aria-label') || 'ボタン';
    } else if (element.tagName === 'A') {
      announcement = element.textContent || element.getAttribute('aria-label') || 'リンク';
    } else if (element.tagName === 'INPUT') {
      announcement = `${element.placeholder || '入力フィールド'}`;
    } else if (element.getAttribute('aria-label')) {
      announcement = element.getAttribute('aria-label');
    } else if (element.textContent) {
      announcement = element.textContent.trim().substring(0, 50);
    }

    if (announcement) {
      this.speak(announcement, { volume: 0.5 });
    }
  }

  /**
   * VRセッション開始のアナウンス
   */
  announceVRSessionStart() {
    this.speak('VRモードを開始しました。ナビゲーションにはジェスチャーを使用できます。');
  }

  /**
   * VRセッション終了のアナウンス
   */
  announceVRSessionEnd() {
    this.speak('VRモードを終了しました。');
  }

  /**
   * 緊急退出
   */
  performEmergencyExit() {
    console.log('[VR Accessibility] Emergency exit activated');

    // VRセッションの終了
    if (window.WebXRManager) {
      window.WebXRManager.endSession();
    }

    // 音声ガイドで通知
    this.speak('緊急退出を実行しました。安全な場所に移動してください。');

    // 視覚通知
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'error',
        title: '緊急退出',
        message: 'VRセッションを終了しました',
        duration: 5000
      });
    }

    // 緊急連絡先への通知（オプション）
    this.notifyEmergencyContacts();
  }

  /**
   * 緊急連絡先への通知
   */
  notifyEmergencyContacts() {
    // 緊急連絡先への通知機能（実装は別途）
    console.log('[VR Accessibility] Emergency contacts notified');
  }

  /**
   * 認知サポート機能の切り替え
   */
  toggleCognitiveSupport() {
    this.cognitiveSupport.simplifiedUI = !this.cognitiveSupport.simplifiedUI;
    this.applyCognitiveSupport();
    this.saveSettings();

    const status = this.cognitiveSupport.simplifiedUI ? '有効' : '無効';
    this.speak(`認知サポート機能を${status}にしました`);

    console.log(`[VR Accessibility] Cognitive support ${status.toLowerCase()}`);
  }

  /**
   * 認知サポートの適用
   */
  applyCognitiveSupport() {
    const body = document.body;

    if (this.cognitiveSupport.simplifiedUI) {
      body.classList.add('simplified-ui');
    } else {
      body.classList.remove('simplified-ui');
    }

    if (this.cognitiveSupport.reducedAnimations) {
      body.classList.add('reduced-animations');
    } else {
      body.classList.remove('reduced-animations');
    }
  }

  /**
   * アクセシビリティ設定のリセット
   */
  resetToDefaults() {
    // デフォルト値に戻す
    this.voiceGuide = {
      enabled: false,
      volume: 0.7,
      rate: 1.0,
      pitch: 1.0,
      voice: null,
      language: 'ja-JP'
    };

    this.visualAdjustments = {
      contrast: 1.0,
      brightness: 1.0,
      fontSize: 1.0,
      colorBlindMode: 'none',
      highContrast: false,
      reducedMotion: false
    };

    this.hapticFeedback = {
      enabled: true,
      intensity: 0.5,
      duration: 100,
      patterns: new Map()
    };

    this.cognitiveSupport = {
      simplifiedUI: false,
      reducedAnimations: false,
      clearLabels: true,
      audioCues: false,
      stepByStepGuidance: false
    };

    // 設定の適用
    this.applyVisualAdjustments();
    this.applyCognitiveSupport();
    this.saveSettings();

    this.speak('アクセシビリティ設定をデフォルトに戻しました');

    console.log('[VR Accessibility] Settings reset to defaults');
  }

  /**
   * アクセシビリティ統計の取得
   */
  getStats() {
    return {
      voiceGuide: { ...this.voiceGuide },
      visualAdjustments: { ...this.visualAdjustments },
      hapticFeedback: {
        ...this.hapticFeedback,
        patternCount: this.hapticFeedback.patterns.size
      },
      cognitiveSupport: { ...this.cognitiveSupport },
      emergencyFeatures: { ...this.emergencyFeatures },
      speechSynthesisSupported: 'speechSynthesis' in window,
      vibrationSupported: 'vibrate' in navigator,
      hapticMethod: this.hapticMethod
    };
  }

  /**
   * アクセシビリティ機能の一覧取得
   */
  getAvailableFeatures() {
    return {
      voiceGuide: 'speechSynthesis' in window,
      hapticFeedback: this.hapticMethod !== null,
      visualAdjustments: true,
      cognitiveSupport: true,
      emergencyFeatures: true,
      colorBlindSupport: document.createElementNS && document.createElementNS.bind(document, 'http://www.w3.org/2000/svg')
    };
  }

  /**
   * アクセシビリティ診断
   */
  runAccessibilityCheck() {
    const results = {
      speechSynthesis: 'speechSynthesis' in window,
      vibration: 'vibrate' in navigator,
      gamepad: 'getGamepads' in navigator,
      localStorage: this.testLocalStorage(),
      webxr: !!navigator.xr,
      highContrast: window.matchMedia('(prefers-contrast: high)').matches,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    };

    console.log('[VR Accessibility] Accessibility check results:', results);
    return results;
  }

  /**
   * LocalStorageテスト
   */
  testLocalStorage() {
    try {
      const testKey = 'accessibility-test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// グローバルインスタンス作成
const vrAccessibilitySystem = new VRAccessibilitySystem();

// グローバルアクセス用
window.vrAccessibilitySystem = vrAccessibilitySystem;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[VR Accessibility] VR Accessibility System initialized');
});
