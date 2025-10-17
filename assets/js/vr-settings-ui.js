/**
 * Qui Browser VR Settings UI
 * VRデバイス専用設定カスタマイズインターフェース
 *
 * 機能:
 * - VRパフォーマンス設定のカスタマイズ
 * - バッテリー管理設定
 * - アクセシビリティ設定
 * - ネットワーク設定
 * - オフラインストレージ設定
 * - ジェスチャーコントロール設定
 * - 設定の保存・復元
 * - リアルタイム適用
 */

class VRSettingsUI {
  constructor() {
    this.settings = {
      performance: {
        targetFps: 72,
        qualityLevel: 'good',
        adaptiveQuality: true,
        performanceMonitoring: true
      },
      battery: {
        monitoringEnabled: true,
        autoAdjustQuality: true,
        lowBatteryThreshold: 20,
        criticalBatteryThreshold: 10
      },
      accessibility: {
        voiceGuideEnabled: false,
        hapticFeedbackEnabled: true,
        highContrastMode: false,
        reducedMotion: false,
        fontSize: 1.0,
        colorBlindMode: 'none'
      },
      network: {
        monitoringEnabled: true,
        autoAdjustQuality: true,
        offlineMode: false,
        preloadEnabled: true
      },
      offline: {
        autoCacheEnabled: true,
        maxCacheSize: 500,
        cacheStrategy: 'balanced',
        syncOnReconnect: true
      },
      gestures: {
        enabled: true,
        handTrackingEnabled: true,
        controllerFallback: true,
        gestureSensitivity: 0.7,
        dominantHand: 'right'
      }
    };

    this.settingsKey = 'qui-vr-settings';
    this.uiContainer = null;
    this.isVisible = false;

    this.init();
  }

  init() {
    // 保存された設定の読み込み
    this.loadSettings();

    // UIコンテナの作成
    this.createUIContainer();

    // 設定パネルの作成
    this.createSettingsPanel();

    // イベントリスナーの設定
    this.setupEventListeners();

    // キーボードショートカット
    this.setupKeyboardShortcuts();

    console.log('[VR Settings] VR Settings UI initialized');
  }

  /**
   * 設定の読み込み
   */
  loadSettings() {
    try {
      const savedSettings = localStorage.getItem(this.settingsKey);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        // 設定のマージ（新しい設定項目を追加）
        this.settings = this.deepMerge(this.settings, parsedSettings);
        console.log('[VR Settings] Settings loaded from storage');
      }
    } catch (error) {
      console.warn('[VR Settings] Failed to load settings:', error);
    }
  }

  /**
   * 設定の保存
   */
  saveSettings() {
    try {
      localStorage.setItem(this.settingsKey, JSON.stringify(this.settings));
      console.log('[VR Settings] Settings saved');
    } catch (error) {
      console.warn('[VR Settings] Failed to save settings:', error);
    }
  }

  /**
   * UIコンテナの作成
   */
  createUIContainer() {
    // 既存のコンテナをチェック
    this.uiContainer = document.getElementById('vr-settings-container');
    if (!this.uiContainer) {
      this.uiContainer = document.createElement('div');
      this.uiContainer.id = 'vr-settings-container';
      this.uiContainer.className = 'vr-settings-container';
      this.uiContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: none;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      document.body.appendChild(this.uiContainer);
    }
  }

  /**
   * 設定パネルの作成
   */
  createSettingsPanel() {
    const panel = document.createElement('div');
    panel.className = 'vr-settings-panel';
    panel.style.cssText = `
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      padding: 24px;
    `;

    // ヘッダー
    const header = this.createHeader();
    panel.appendChild(header);

    // タブナビゲーション
    const tabs = this.createTabs();
    panel.appendChild(tabs);

    // コンテンツエリア
    const content = this.createContent();
    panel.appendChild(content);

    // フッター
    const footer = this.createFooter();
    panel.appendChild(footer);

    this.uiContainer.appendChild(panel);
    this.panel = panel;
  }

  /**
   * ヘッダーの作成
   */
  createHeader() {
    const header = document.createElement('div');
    header.className = 'vr-settings-header';
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e1e5e9;
    `;

    const title = document.createElement('h2');
    title.textContent = 'VR設定';
    title.style.cssText = `
      margin: 0;
      color: #172b4d;
      font-size: 24px;
      font-weight: 600;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.className = 'vr-settings-close';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #6b778c;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s;
    `;
    closeButton.addEventListener('click', () => this.hide());
    closeButton.addEventListener('mouseover', () => {
      closeButton.style.background = '#f4f5f7';
      closeButton.style.color = '#172b4d';
    });
    closeButton.addEventListener('mouseout', () => {
      closeButton.style.background = 'none';
      closeButton.style.color = '#6b778c';
    });

    header.appendChild(title);
    header.appendChild(closeButton);

    return header;
  }

  /**
   * タブナビゲーションの作成
   */
  createTabs() {
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'vr-settings-tabs';
    tabsContainer.style.cssText = `
      display: flex;
      margin-bottom: 24px;
      border-bottom: 1px solid #e1e5e9;
    `;

    const tabs = [
      { id: 'performance', label: 'パフォーマンス', icon: '⚡' },
      { id: 'battery', label: 'バッテリー', icon: '🔋' },
      { id: 'accessibility', label: 'アクセシビリティ', icon: '🧠' },
      { id: 'network', label: 'ネットワーク', icon: '🌐' },
      { id: 'offline', label: 'オフライン', icon: '💾' },
      { id: 'gestures', label: 'ジェスチャー', icon: '✋' }
    ];

    tabs.forEach((tab, index) => {
      const tabButton = document.createElement('button');
      tabButton.className = `vr-settings-tab ${index === 0 ? 'active' : ''}`;
      tabButton.dataset.tab = tab.id;
      tabButton.style.cssText = `
        background: none;
        border: none;
        padding: 12px 16px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: ${index === 0 ? '#0052cc' : '#6b778c'};
        border-bottom: 2px solid ${index === 0 ? '#0052cc' : 'transparent'};
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
      `;

      const icon = document.createElement('span');
      icon.textContent = tab.icon;
      icon.style.fontSize = '16px';

      const label = document.createElement('span');
      label.textContent = tab.label;

      tabButton.appendChild(icon);
      tabButton.appendChild(label);

      tabButton.addEventListener('click', () => this.switchTab(tab.id));

      tabsContainer.appendChild(tabButton);
    });

    return tabsContainer;
  }

  /**
   * コンテンツエリアの作成
   */
  createContent() {
    const content = document.createElement('div');
    content.className = 'vr-settings-content';
    content.style.cssText = `
      min-height: 300px;
    `;

    // 各タブのコンテンツを作成
    const tabsContent = {
      performance: this.createPerformanceSettings(),
      battery: this.createBatterySettings(),
      accessibility: this.createAccessibilitySettings(),
      network: this.createNetworkSettings(),
      offline: this.createOfflineSettings(),
      gestures: this.createGesturesSettings()
    };

    Object.entries(tabsContent).forEach(([tabId, tabContent]) => {
      tabContent.style.display = tabId === 'performance' ? 'block' : 'none';
      content.appendChild(tabContent);
    });

    return content;
  }

  /**
   * パフォーマンス設定の作成
   */
  createPerformanceSettings() {
    const container = this.createTabContainer('performance');

    const controls = [
      this.createSlider('targetFps', '目標FPS', 30, 90, this.settings.performance.targetFps, (value) => {
        this.settings.performance.targetFps = value;
        if (window.vrPerformanceMonitor) {
          window.vrPerformanceMonitor.updateTargetFps(value);
        }
      }),
      this.createSelect('qualityLevel', '品質レベル', [
        { value: 'critical', label: '最高品質（バッテリー消費大）' },
        { value: 'poor', label: '高品質' },
        { value: 'fair', label: '標準品質' },
        { value: 'good', label: '節約品質' },
        { value: 'excellent', label: '最低品質（バッテリー節約）' }
      ], this.settings.performance.qualityLevel, (value) => {
        this.settings.performance.qualityLevel = value;
      }),
      this.createToggle('adaptiveQuality', '適応品質調整', this.settings.performance.adaptiveQuality, (value) => {
        this.settings.performance.adaptiveQuality = value;
      }),
      this.createToggle('performanceMonitoring', 'パフォーマンス監視', this.settings.performance.performanceMonitoring, (value) => {
        this.settings.performance.performanceMonitoring = value;
        if (window.vrPerformanceMonitor) {
          if (value) {
            window.vrPerformanceMonitor.resumeMonitoring();
          } else {
            window.vrPerformanceMonitor.pauseMonitoring();
          }
        }
      })
    ];

    controls.forEach(control => container.appendChild(control));

    return container;
  }

  /**
   * バッテリー設定の作成
   */
  createBatterySettings() {
    const container = this.createTabContainer('battery');

    const controls = [
      this.createToggle('monitoringEnabled', 'バッテリー監視', this.settings.battery.monitoringEnabled, (value) => {
        this.settings.battery.monitoringEnabled = value;
        if (window.vrBatteryMonitor) {
          if (value) {
            window.vrBatteryMonitor.resumeMonitoring();
          } else {
            window.vrBatteryMonitor.stopMonitoring();
          }
        }
      }),
      this.createToggle('autoAdjustQuality', '自動品質調整', this.settings.battery.autoAdjustQuality, (value) => {
        this.settings.battery.autoAdjustQuality = value;
      }),
      this.createSlider('lowBatteryThreshold', '低バッテリー警告 (%)', 5, 50, this.settings.battery.lowBatteryThreshold, (value) => {
        this.settings.battery.lowBatteryThreshold = value;
      }),
      this.createSlider('criticalBatteryThreshold', '緊急バッテリー警告 (%)', 1, 20, this.settings.battery.criticalBatteryThreshold, (value) => {
        this.settings.battery.criticalBatteryThreshold = value;
      })
    ];

    controls.forEach(control => container.appendChild(control));

    return container;
  }

  /**
   * アクセシビリティ設定の作成
   */
  createAccessibilitySettings() {
    const container = this.createTabContainer('accessibility');

    const controls = [
      this.createToggle('voiceGuideEnabled', '音声ガイド', this.settings.accessibility.voiceGuideEnabled, (value) => {
        this.settings.accessibility.voiceGuideEnabled = value;
        if (window.vrAccessibilitySystem) {
          if (value) {
            window.vrAccessibilitySystem.toggleVoiceGuide();
          }
        }
      }),
      this.createToggle('hapticFeedbackEnabled', '触覚フィードバック', this.settings.accessibility.hapticFeedbackEnabled, (value) => {
        this.settings.accessibility.hapticFeedbackEnabled = value;
        if (window.vrAccessibilitySystem) {
          window.vrAccessibilitySystem.toggleHapticFeedback();
        }
      }),
      this.createToggle('highContrastMode', '高コントラストモード', this.settings.accessibility.highContrastMode, (value) => {
        this.settings.accessibility.highContrastMode = value;
        if (window.vrAccessibilitySystem) {
          window.vrAccessibilitySystem.toggleHighContrast();
        }
      }),
      this.createToggle('reducedMotion', 'モーション削減', this.settings.accessibility.reducedMotion, (value) => {
        this.settings.accessibility.reducedMotion = value;
      }),
      this.createSlider('fontSize', 'フォントサイズ', 0.5, 2.0, this.settings.accessibility.fontSize, (value) => {
        this.settings.accessibility.fontSize = value;
        if (window.vrAccessibilitySystem) {
          window.vrAccessibilitySystem.updateFontSize(value);
        }
      }),
      this.createSelect('colorBlindMode', '色覚補正', [
        { value: 'none', label: 'なし' },
        { value: 'protanopia', label: '第1色覚異常（赤色盲）' },
        { value: 'deuteranopia', label: '第2色覚異常（緑色盲）' },
        { value: 'tritanopia', label: '第3色覚異常（青色盲）' }
      ], this.settings.accessibility.colorBlindMode, (value) => {
        this.settings.accessibility.colorBlindMode = value;
      })
    ];

    controls.forEach(control => container.appendChild(control));

    return container;
  }

  /**
   * ネットワーク設定の作成
   */
  createNetworkSettings() {
    const container = this.createTabContainer('network');

    const controls = [
      this.createToggle('monitoringEnabled', 'ネットワーク監視', this.settings.network.monitoringEnabled, (value) => {
        this.settings.network.monitoringEnabled = value;
        if (window.vrNetworkMonitor) {
          if (value) {
            window.vrNetworkMonitor.resumeMonitoring();
          } else {
            window.vrNetworkMonitor.stopMonitoring();
          }
        }
      }),
      this.createToggle('autoAdjustQuality', '自動品質調整', this.settings.network.autoAdjustQuality, (value) => {
        this.settings.network.autoAdjustQuality = value;
      }),
      this.createToggle('offlineMode', 'オフラインモード', this.settings.network.offlineMode, (value) => {
        this.settings.network.offlineMode = value;
      }),
      this.createToggle('preloadEnabled', 'プリロード有効', this.settings.network.preloadEnabled, (value) => {
        this.settings.network.preloadEnabled = value;
        if (window.vrContentPreloader) {
          if (value) {
            window.vrContentPreloader.enablePreloading();
          } else {
            window.vrContentPreloader.disablePreloading();
          }
        }
      })
    ];

    controls.forEach(control => container.appendChild(control));

    return container;
  }

  /**
   * オフライン設定の作成
   */
  createOfflineSettings() {
    const container = this.createTabContainer('offline');

    const controls = [
      this.createToggle('autoCacheEnabled', '自動キャッシュ', this.settings.offline.autoCacheEnabled, (value) => {
        this.settings.offline.autoCacheEnabled = value;
        if (window.vrOfflineStorage) {
          if (value) {
            window.vrOfflineStorage.enableAutoCaching();
          } else {
            window.vrOfflineStorage.disableAutoCaching();
          }
        }
      }),
      this.createSlider('maxCacheSize', '最大キャッシュサイズ (MB)', 100, 2000, this.settings.offline.maxCacheSize, (value) => {
        this.settings.offline.maxCacheSize = value;
        if (window.vrOfflineStorage) {
          window.vrOfflineStorage.updateMaxCacheSize(value * 1024 * 1024);
        }
      }),
      this.createSelect('cacheStrategy', 'キャッシュ戦略', [
        { value: 'aggressive', label: '積極的（多くのコンテンツを保存）' },
        { value: 'balanced', label: 'バランス（標準設定）' },
        { value: 'conservative', label: '保守的（最小限の保存）' }
      ], this.settings.offline.cacheStrategy, (value) => {
        this.settings.offline.cacheStrategy = value;
        if (window.vrOfflineStorage) {
          window.vrOfflineStorage.setCacheStrategy(value);
        }
      }),
      this.createToggle('syncOnReconnect', '再接続時同期', this.settings.offline.syncOnReconnect, (value) => {
        this.settings.offline.syncOnReconnect = value;
      })
    ];

    controls.forEach(control => container.appendChild(control));

    return container;
  }

  /**
   * ジェスチャー設定の作成
   */
  createGesturesSettings() {
    const container = this.createTabContainer('gestures');

    const controls = [
      this.createToggle('enabled', 'ジェスチャー有効', this.settings.gestures.enabled, (value) => {
        this.settings.gestures.enabled = value;
        if (window.vrGestureControls) {
          if (value) {
            // ジェスチャー有効化ロジック
          } else {
            // ジェスチャー無効化ロジック
          }
        }
      }),
      this.createToggle('handTrackingEnabled', 'ハンドトラッキング', this.settings.gestures.handTrackingEnabled, (value) => {
        this.settings.gestures.handTrackingEnabled = value;
      }),
      this.createToggle('controllerFallback', 'コントローラーフォールバック', this.settings.gestures.controllerFallback, (value) => {
        this.settings.gestures.controllerFallback = value;
      }),
      this.createSlider('gestureSensitivity', 'ジェスチャー感度', 0.1, 1.0, this.settings.gestures.gestureSensitivity, (value) => {
        this.settings.gestures.gestureSensitivity = value;
        if (window.vrGestureControls) {
          window.vrGestureControls.updateSensitivity(value);
        }
      }),
      this.createSelect('dominantHand', '利き手', [
        { value: 'left', label: '左手' },
        { value: 'right', label: '右手' },
        { value: 'auto', label: '自動検出' }
      ], this.settings.gestures.dominantHand, (value) => {
        this.settings.gestures.dominantHand = value;
      })
    ];

    controls.forEach(control => container.appendChild(control));

    return container;
  }

  /**
   * タブコンテナの作成
   */
  createTabContainer(tabId) {
    const container = document.createElement('div');
    container.className = `vr-settings-tab-content`;
    container.id = `vr-settings-${tabId}`;
    container.style.cssText = `
      display: none;
    `;

    return container;
  }

  /**
   * コントロール要素の作成
   */
  createToggle(id, label, value, onChange) {
    const control = document.createElement('div');
    control.className = 'vr-settings-control';
    control.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f4f5f7;
    `;

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.cssText = `
      font-size: 14px;
      color: #172b4d;
      font-weight: 500;
    `;

    const toggle = document.createElement('label');
    toggle.className = 'vr-settings-toggle';
    toggle.style.cssText = `
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      cursor: pointer;
    `;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value;
    input.style.display = 'none';
    input.addEventListener('change', () => onChange(input.checked));

    const slider = document.createElement('span');
    slider.className = 'vr-settings-toggle-slider';
    slider.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      border-radius: 24px;
      transition: 0.3s;
    `;

    if (value) {
      slider.style.backgroundColor = '#0052cc';
    }

    const knob = document.createElement('span');
    knob.className = 'vr-settings-toggle-knob';
    knob.style.cssText = `
      position: absolute;
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      border-radius: 50%;
      transition: 0.3s;
    `;

    if (value) {
      knob.style.transform = 'translateX(20px)';
    }

    input.addEventListener('change', () => {
      if (input.checked) {
        slider.style.backgroundColor = '#0052cc';
        knob.style.transform = 'translateX(20px)';
      } else {
        slider.style.backgroundColor = '#ccc';
        knob.style.transform = 'translateX(0)';
      }
    });

    toggle.appendChild(input);
    toggle.appendChild(slider);
    toggle.appendChild(knob);

    control.appendChild(labelElement);
    control.appendChild(toggle);

    return control;
  }

  createSlider(id, label, min, max, value, onChange) {
    const control = document.createElement('div');
    control.className = 'vr-settings-control';
    control.style.cssText = `
      padding: 16px 0;
      border-bottom: 1px solid #f4f5f7;
    `;

    const labelContainer = document.createElement('div');
    labelContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    `;

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.cssText = `
      font-size: 14px;
      color: #172b4d;
      font-weight: 500;
    `;

    const valueElement = document.createElement('span');
    valueElement.textContent = value;
    valueElement.className = 'vr-settings-slider-value';
    valueElement.style.cssText = `
      font-size: 14px;
      color: #6b778c;
      font-weight: 500;
    `;

    labelContainer.appendChild(labelElement);
    labelContainer.appendChild(valueElement);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = (max - min) / 100;
    slider.value = value;
    slider.className = 'vr-settings-slider';
    slider.style.cssText = `
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #e1e5e9;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
    `;

    // WebKit用スタイル
    const style = document.createElement('style');
    style.textContent = `
      .vr-settings-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #0052cc;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      .vr-settings-slider::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #0052cc;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
    `;
    document.head.appendChild(style);

    slider.addEventListener('input', () => {
      const newValue = parseFloat(slider.value);
      valueElement.textContent = newValue.toFixed(1);
      onChange(newValue);
    });

    control.appendChild(labelContainer);
    control.appendChild(slider);

    return control;
  }

  createSelect(id, label, options, value, onChange) {
    const control = document.createElement('div');
    control.className = 'vr-settings-control';
    control.style.cssText = `
      padding: 12px 0;
      border-bottom: 1px solid #f4f5f7;
    `;

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.cssText = `
      display: block;
      font-size: 14px;
      color: #172b4d;
      font-weight: 500;
      margin-bottom: 8px;
    `;

    const select = document.createElement('select');
    select.className = 'vr-settings-select';
    select.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #dfe1e6;
      border-radius: 4px;
      font-size: 14px;
      color: #172b4d;
      background: white;
      cursor: pointer;
    `;

    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      if (option.value === value) {
        optionElement.selected = true;
      }
      select.appendChild(optionElement);
    });

    select.addEventListener('change', () => onChange(select.value));

    control.appendChild(labelElement);
    control.appendChild(select);

    return control;
  }

  /**
   * フッターの作成
   */
  createFooter() {
    const footer = document.createElement('div');
    footer.className = 'vr-settings-footer';
    footer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e1e5e9;
    `;

    const resetButton = document.createElement('button');
    resetButton.textContent = 'デフォルトに戻す';
    resetButton.className = 'vr-settings-button secondary';
    resetButton.style.cssText = `
      padding: 8px 16px;
      border: 1px solid #dfe1e6;
      border-radius: 4px;
      background: white;
      color: #6b778c;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    resetButton.addEventListener('click', () => this.resetToDefaults());

    const saveButton = document.createElement('button');
    saveButton.textContent = '保存';
    saveButton.className = 'vr-settings-button primary';
    saveButton.style.cssText = `
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      background: #0052cc;
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    `;
    saveButton.addEventListener('click', () => this.saveAndClose());

    footer.appendChild(resetButton);
    footer.appendChild(saveButton);

    return footer;
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // ESCキーで閉じる
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // 背景クリックで閉じる
    this.uiContainer.addEventListener('click', (event) => {
      if (event.target === this.uiContainer) {
        this.hide();
      }
    });
  }

  /**
   * キーボードショートカットの設定
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Ctrl+Alt+S で設定を開く
      if (event.ctrlKey && event.altKey && event.key === 's') {
        event.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * タブ切り替え
   */
  switchTab(tabId) {
    // タブボタンの更新
    const tabs = this.panel.querySelectorAll('.vr-settings-tab');
    tabs.forEach(tab => {
      if (tab.dataset.tab === tabId) {
        tab.classList.add('active');
        tab.style.color = '#0052cc';
        tab.style.borderBottomColor = '#0052cc';
      } else {
        tab.classList.remove('active');
        tab.style.color = '#6b778c';
        tab.style.borderBottomColor = 'transparent';
      }
    });

    // コンテンツの更新
    const contents = this.panel.querySelectorAll('.vr-settings-tab-content');
    contents.forEach(content => {
      content.style.display = content.id === `vr-settings-${tabId}` ? 'block' : 'none';
    });
  }

  /**
   * 設定を表示
   */
  show() {
    this.uiContainer.style.display = 'flex';
    this.isVisible = true;

    // 初期タブを表示
    this.switchTab('performance');

    console.log('[VR Settings] Settings UI shown');
  }

  /**
   * 設定を非表示
   */
  hide() {
    this.uiContainer.style.display = 'none';
    this.isVisible = false;

    console.log('[VR Settings] Settings UI hidden');
  }

  /**
   * 設定の表示/非表示切り替え
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * 設定を保存して閉じる
   */
  saveAndClose() {
    this.saveSettings();
    this.applySettings();
    this.hide();

    // 成功通知
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'success',
        title: '設定保存',
        message: 'VR設定が保存されました',
        duration: 3000
      });
    }

    console.log('[VR Settings] Settings saved and applied');
  }

  /**
   * 設定の適用
   */
  applySettings() {
    // 各サブシステムに設定を適用
    this.applyPerformanceSettings();
    this.applyBatterySettings();
    this.applyAccessibilitySettings();
    this.applyNetworkSettings();
    this.applyOfflineSettings();
    this.applyGesturesSettings();
  }

  /**
   * パフォーマンス設定の適用
   */
  applyPerformanceSettings() {
    if (window.vrPerformanceMonitor) {
      window.vrPerformanceMonitor.updateSettings(this.settings.performance);
    }
  }

  /**
   * バッテリー設定の適用
   */
  applyBatterySettings() {
    if (window.vrBatteryMonitor) {
      window.vrBatteryMonitor.updateSettings(this.settings.battery);
    }
  }

  /**
   * アクセシビリティ設定の適用
   */
  applyAccessibilitySettings() {
    if (window.vrAccessibilitySystem) {
      window.vrAccessibilitySystem.updateSettings(this.settings.accessibility);
    }
  }

  /**
   * ネットワーク設定の適用
   */
  applyNetworkSettings() {
    if (window.vrNetworkMonitor) {
      window.vrNetworkMonitor.updateSettings(this.settings.network);
    }
  }

  /**
   * オフライン設定の適用
   */
  applyOfflineSettings() {
    if (window.vrOfflineStorage) {
      window.vrOfflineStorage.updateSettings(this.settings.offline);
    }
  }

  /**
   * ジェスチャー設定の適用
   */
  applyGesturesSettings() {
    if (window.vrGestureControls) {
      window.vrGestureControls.updateSettings(this.settings.gestures);
    }
  }

  /**
   * デフォルト設定に戻す
   */
  resetToDefaults() {
    // デフォルト設定に戻す
    this.settings = {
      performance: {
        targetFps: 72,
        qualityLevel: 'good',
        adaptiveQuality: true,
        performanceMonitoring: true
      },
      battery: {
        monitoringEnabled: true,
        autoAdjustQuality: true,
        lowBatteryThreshold: 20,
        criticalBatteryThreshold: 10
      },
      accessibility: {
        voiceGuideEnabled: false,
        hapticFeedbackEnabled: true,
        highContrastMode: false,
        reducedMotion: false,
        fontSize: 1.0,
        colorBlindMode: 'none'
      },
      network: {
        monitoringEnabled: true,
        autoAdjustQuality: true,
        offlineMode: false,
        preloadEnabled: true
      },
      offline: {
        autoCacheEnabled: true,
        maxCacheSize: 500,
        cacheStrategy: 'balanced',
        syncOnReconnect: true
      },
      gestures: {
        enabled: true,
        handTrackingEnabled: true,
        controllerFallback: true,
        gestureSensitivity: 0.7,
        dominantHand: 'right'
      }
    };

    this.saveSettings();
    this.applySettingsToUI();

    console.log('[VR Settings] Settings reset to defaults');
  }

  /**
   * UIに設定を適用
   */
  applySettingsToUI() {
    // 各コントロールの値を更新
    this.updateControlValues();
  }

  /**
   * コントロール値の更新
   */
  updateControlValues() {
    // 実装は各コントロールの更新ロジック
    console.log('[VR Settings] UI values updated');
  }

  /**
   * 設定の取得
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * 特定の設定カテゴリの取得
   */
  getCategorySettings(category) {
    return this.settings[category] || {};
  }

  /**
   * オブジェクトの深いマージ
   */
  deepMerge(target, source) {
    const result = { ...target };

    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    });

    return result;
  }
}

// グローバルインスタンス作成
const vrSettingsUI = new VRSettingsUI();

// グローバルアクセス用
window.vrSettingsUI = vrSettingsUI;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[VR Settings] VR Settings UI initialized');

  // 設定ボタンの追加（オプション）
  const settingsButton = document.createElement('button');
  settingsButton.textContent = 'VR設定';
  settingsButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 16px;
    background: #0052cc;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 1000;
  `;
  settingsButton.addEventListener('click', () => vrSettingsUI.show());
  document.body.appendChild(settingsButton);
});
