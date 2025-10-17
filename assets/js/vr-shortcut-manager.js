/**
 * Qui Browser VR Shortcut Manager
 * VRデバイス専用ショートカット管理機能
 *
 * 機能:
 * - カスタマイズ可能なキーボードショートカット
 * - ジェスチャーショートカットの管理
 * - ショートカットの競合解決
 * - ショートカットの保存・復元
 * - アクセシビリティ対応
 */

class VRShortcutManager {
  constructor() {
    this.shortcuts = new Map();
    this.gestureShortcuts = new Map();
    this.categories = new Map();
    this.recordingShortcut = null;
    this.isRecording = false;

    // デフォルトショートカット
    this.defaultShortcuts = {
      'settings': {
        keys: ['Control', 'Alt', 'KeyS'],
        description: '設定画面を開く',
        category: 'system',
        enabled: true
      },
      'help': {
        keys: ['Control', 'Alt', 'KeyH'],
        description: 'ヘルプ画面を開く',
        category: 'system',
        enabled: true
      },
      'performance': {
        keys: ['Control', 'Alt', 'KeyP'],
        description: 'パフォーマンス監視表示',
        category: 'system',
        enabled: true
      },
      'battery': {
        keys: ['Control', 'Alt', 'KeyB'],
        description: 'バッテリー情報表示',
        category: 'system',
        enabled: true
      },
      'emergency_exit': {
        keys: ['Control', 'Alt', 'KeyQ'],
        description: '緊急退出',
        category: 'emergency',
        enabled: true
      },
      'reset_view': {
        keys: ['Control', 'Alt', 'KeyR'],
        description: '視点をリセット',
        category: 'navigation',
        enabled: true
      },
      'toggle_ui': {
        keys: ['Control', 'Alt', 'KeyU'],
        description: 'UI表示切り替え',
        category: 'interface',
        enabled: true
      }
    };

    // デフォルトジェスチャーショートカット
    this.defaultGestureShortcuts = {
      'teleport': {
        gesture: 'pinch',
        description: 'テレポート',
        category: 'navigation',
        enabled: true
      },
      'menu': {
        gesture: 'open',
        description: 'メニュー表示',
        category: 'interface',
        enabled: true
      },
      'emergency_stop': {
        gesture: 'fist',
        description: '緊急停止',
        category: 'emergency',
        enabled: true
      },
      'quick_settings': {
        gesture: 'thumbsUp',
        description: 'クイック設定',
        category: 'system',
        enabled: true
      },
      'point_select': {
        gesture: 'point',
        description: 'ポイント選択',
        category: 'interaction',
        enabled: true
      }
    };

    // カテゴリ定義
    this.categories.set('system', { name: 'システム', icon: '⚙️', order: 1 });
    this.categories.set('navigation', { name: 'ナビゲーション', icon: '🧭', order: 2 });
    this.categories.set('interface', { name: 'インターフェース', icon: '🖥️', order: 3 });
    this.categories.set('interaction', { name: 'インタラクション', icon: '👆', order: 4 });
    this.categories.set('emergency', { name: '緊急', icon: '🚨', order: 5 });

    this.init();
  }

  init() {
    // 設定の読み込み
    this.loadShortcuts();

    // イベントリスナーの設定
    this.setupEventListeners();

    // デフォルトショートカットの登録
    this.registerDefaultShortcuts();

    console.log('[VR Shortcuts] VR Shortcut Manager initialized');
  }

  /**
   * ショートカットの読み込み
   */
  loadShortcuts() {
    try {
      const savedShortcuts = localStorage.getItem('qui-vr-shortcuts');
      const savedGestures = localStorage.getItem('qui-vr-gesture-shortcuts');

      if (savedShortcuts) {
        const parsed = JSON.parse(savedShortcuts);
        Object.entries(parsed).forEach(([id, shortcut]) => {
          this.shortcuts.set(id, shortcut);
        });
      } else {
        // デフォルトショートカットをコピー
        this.shortcuts = new Map(Object.entries(this.defaultShortcuts));
      }

      if (savedGestures) {
        const parsed = JSON.parse(savedGestures);
        Object.entries(parsed).forEach(([id, shortcut]) => {
          this.gestureShortcuts.set(id, shortcut);
        });
      } else {
        // デフォルトジェスチャーショートカットをコピー
        this.gestureShortcuts = new Map(Object.entries(this.defaultGestureShortcuts));
      }

    } catch (error) {
      console.warn('[VR Shortcuts] Failed to load shortcuts:', error);
      // デフォルトを使用
      this.shortcuts = new Map(Object.entries(this.defaultShortcuts));
      this.gestureShortcuts = new Map(Object.entries(this.defaultGestureShortcuts));
    }
  }

  /**
   * ショートカットの保存
   */
  saveShortcuts() {
    try {
      const shortcutsToSave = {};
      this.shortcuts.forEach((shortcut, id) => {
        shortcutsToSave[id] = shortcut;
      });

      const gesturesToSave = {};
      this.gestureShortcuts.forEach((shortcut, id) => {
        gesturesToSave[id] = shortcut;
      });

      localStorage.setItem('qui-vr-shortcuts', JSON.stringify(shortcutsToSave));
      localStorage.setItem('qui-vr-gesture-shortcuts', JSON.stringify(gesturesToSave));

    } catch (error) {
      console.warn('[VR Shortcuts] Failed to save shortcuts:', error);
    }
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // キーボードイベント
    document.addEventListener('keydown', (event) => {
      this.handleKeyDown(event);
    });

    document.addEventListener('keyup', (event) => {
      this.handleKeyUp(event);
    });

    // VRジェスチャーイベント
    if (window.vrGestureControls) {
      window.vrGestureControls.onGesture('any', (action, data) => {
        if (action === 'start') {
          this.handleGesture(data.gesture, data);
        }
      });
    }

    // 設定UIとの連携
    if (window.vrSettingsUI) {
      // 設定UIが開かれたときにショートカット設定を更新
      document.addEventListener('vrsettingsopened', () => {
        this.updateSettingsUI();
      });
    }
  }

  /**
   * デフォルトショートカットの登録
   */
  registerDefaultShortcuts() {
    // アクションの実行関数を登録
    this.shortcuts.forEach((shortcut, id) => {
      if (shortcut.enabled) {
        this.registerShortcutAction(id, shortcut);
      }
    });

    this.gestureShortcuts.forEach((shortcut, id) => {
      if (shortcut.enabled) {
        this.registerGestureShortcutAction(id, shortcut);
      }
    });
  }

  /**
   * ショートカットアクションの登録
   */
  registerShortcutAction(id, shortcut) {
    shortcut.action = this.getShortcutAction(id);
  }

  /**
   * ジェスチャーショートカットアクションの登録
   */
  registerGestureShortcutAction(id, shortcut) {
    shortcut.action = this.getGestureShortcutAction(id);
  }

  /**
   * ショートカットアクションの取得
   */
  getShortcutAction(id) {
    const actions = {
      'settings': () => {
        if (window.vrSettingsUI) {
          window.vrSettingsUI.show();
        }
      },
      'help': () => {
        if (window.vrHelpSystem) {
          window.vrHelpSystem.show();
        }
      },
      'performance': () => {
        if (window.vrPerformanceMonitor) {
          console.log('Performance stats:', window.vrPerformanceMonitor.getStats());
          // パフォーマンス情報を表示
          this.showPerformanceInfo();
        }
      },
      'battery': () => {
        if (window.vrBatteryMonitor) {
          console.log('Battery stats:', window.vrBatteryMonitor.getStatus());
          // バッテリー情報を表示
          this.showBatteryInfo();
        }
      },
      'emergency_exit': () => {
        if (window.vrAccessibilitySystem) {
          window.vrAccessibilitySystem.performEmergencyExit();
        }
      },
      'reset_view': () => {
        if (window.WebXRManager) {
          window.WebXRManager.resetView();
        }
      },
      'toggle_ui': () => {
        this.toggleUI();
      }
    };

    return actions[id] || (() => console.log(`Unknown shortcut action: ${id}`));
  }

  /**
   * ジェスチャーショートカットアクションの取得
   */
  getGestureShortcutAction(id) {
    const actions = {
      'teleport': (data) => {
        if (window.vrSpatialNavigation) {
          window.vrSpatialNavigation.initiateTeleport(data.handedness);
        }
      },
      'menu': (data) => {
        // メニュー表示はジェスチャーハンドラーで処理済み
      },
      'emergency_stop': (data) => {
        if (window.vrSpatialNavigation) {
          window.vrSpatialNavigation.emergencyStop();
        }
      },
      'quick_settings': (data) => {
        if (window.vrSettingsUI) {
          window.vrSettingsUI.show();
        }
      },
      'point_select': (data) => {
        // ポイント選択はジェスチャーハンドラーで処理
      }
    };

    return actions[id] || (() => console.log(`Unknown gesture shortcut action: ${id}`));
  }

  /**
   * キーダウンイベントの処理
   */
  handleKeyDown(event) {
    if (this.isRecording) {
      this.recordShortcutKey(event);
      return;
    }

    // アクティブなキーを追跡
    this.activeKeys = this.activeKeys || new Set();
    this.activeKeys.add(event.code);

    // ショートカットチェック
    this.checkShortcutActivation();
  }

  /**
   * キーアップイベントの処理
   */
  handleKeyUp(event) {
    if (this.activeKeys) {
      this.activeKeys.delete(event.code);
    }
  }

  /**
   * ショートカットアクティベーションのチェック
   */
  checkShortcutActivation() {
    if (!this.activeKeys) return;

    this.shortcuts.forEach((shortcut, id) => {
      if (shortcut.enabled && this.isShortcutActive(shortcut)) {
        event.preventDefault();
        this.executeShortcut(id);
        return;
      }
    });
  }

  /**
   * ショートカットがアクティブかチェック
   */
  isShortcutActive(shortcut) {
    if (!shortcut.keys || !this.activeKeys) return false;

    // 全ての必要なキーが押されているかチェック
    return shortcut.keys.every(key => this.activeKeys.has(key));
  }

  /**
   * ショートカットの実行
   */
  executeShortcut(id) {
    const shortcut = this.shortcuts.get(id);
    if (shortcut && shortcut.action) {
      try {
        shortcut.action();
        console.log(`[VR Shortcuts] Executed shortcut: ${id}`);

        // 使用統計の記録
        if (window.vrUsageStatistics) {
          window.vrUsageStatistics.trackFeatureUsage(`shortcut_${id}`);
        }

      } catch (error) {
        console.error(`[VR Shortcuts] Failed to execute shortcut ${id}:`, error);
      }
    }
  }

  /**
   * ジェスチャーの処理
   */
  handleGesture(gesture, data) {
    this.gestureShortcuts.forEach((shortcut, id) => {
      if (shortcut.enabled && shortcut.gesture === gesture) {
        this.executeGestureShortcut(id, data);
      }
    });
  }

  /**
   * ジェスチャーショートカットの実行
   */
  executeGestureShortcut(id, data) {
    const shortcut = this.gestureShortcuts.get(id);
    if (shortcut && shortcut.action) {
      try {
        shortcut.action(data);
        console.log(`[VR Shortcuts] Executed gesture shortcut: ${id}`);

        // 使用統計の記録
        if (window.vrUsageStatistics) {
          window.vrUsageStatistics.trackFeatureUsage(`gesture_shortcut_${id}`);
        }

      } catch (error) {
        console.error(`[VR Shortcuts] Failed to execute gesture shortcut ${id}:`, error);
      }
    }
  }

  /**
   * ショートカットの追加
   */
  addShortcut(id, keys, description, category = 'custom', enabled = true) {
    if (this.shortcuts.has(id)) {
      console.warn(`[VR Shortcuts] Shortcut ${id} already exists`);
      return false;
    }

    // 競合チェック
    if (this.checkShortcutConflict(keys)) {
      console.warn(`[VR Shortcuts] Shortcut conflict detected for keys: ${keys.join('+')}`);
      return false;
    }

    const shortcut = {
      keys: keys,
      description: description,
      category: category,
      enabled: enabled,
      custom: true
    };

    this.shortcuts.set(id, shortcut);
    this.registerShortcutAction(id, shortcut);
    this.saveShortcuts();

    console.log(`[VR Shortcuts] Added shortcut: ${id}`);
    return true;
  }

  /**
   * ジェスチャーショートカットの追加
   */
  addGestureShortcut(id, gesture, description, category = 'custom', enabled = true) {
    if (this.gestureShortcuts.has(id)) {
      console.warn(`[VR Shortcuts] Gesture shortcut ${id} already exists`);
      return false;
    }

    // 競合チェック
    if (this.checkGestureShortcutConflict(gesture)) {
      console.warn(`[VR Shortcuts] Gesture shortcut conflict detected for gesture: ${gesture}`);
      return false;
    }

    const shortcut = {
      gesture: gesture,
      description: description,
      category: category,
      enabled: enabled,
      custom: true
    };

    this.gestureShortcuts.set(id, shortcut);
    this.registerGestureShortcutAction(id, shortcut);
    this.saveShortcuts();

    console.log(`[VR Shortcuts] Added gesture shortcut: ${id}`);
    return true;
  }

  /**
   * ショートカットの削除
   */
  removeShortcut(id) {
    const shortcut = this.shortcuts.get(id);
    if (shortcut && shortcut.custom) {
      this.shortcuts.delete(id);
      this.saveShortcuts();
      console.log(`[VR Shortcuts] Removed shortcut: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * ジェスチャーショートカットの削除
   */
  removeGestureShortcut(id) {
    const shortcut = this.gestureShortcuts.get(id);
    if (shortcut && shortcut.custom) {
      this.gestureShortcuts.delete(id);
      this.saveShortcuts();
      console.log(`[VR Shortcuts] Removed gesture shortcut: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * ショートカットの競合チェック
   */
  checkShortcutConflict(keys) {
    for (const [id, shortcut] of this.shortcuts) {
      if (shortcut.enabled && this.arraysEqual(shortcut.keys, keys)) {
        return true;
      }
    }
    return false;
  }

  /**
   * ジェスチャーショートカットの競合チェック
   */
  checkGestureShortcutConflict(gesture) {
    for (const [id, shortcut] of this.gestureShortcuts) {
      if (shortcut.enabled && shortcut.gesture === gesture) {
        return true;
      }
    }
    return false;
  }

  /**
   * ショートカット録画の開始
   */
  startRecordingShortcut(id) {
    this.isRecording = true;
    this.recordingShortcut = id;
    this.recordedKeys = new Set();

    console.log(`[VR Shortcuts] Started recording shortcut: ${id}`);
  }

  /**
   * ショートカット録画の停止
   */
  stopRecordingShortcut() {
    this.isRecording = false;
    this.recordingShortcut = null;
    this.recordedKeys = null;

    console.log('[VR Shortcuts] Stopped recording shortcut');
  }

  /**
   * ショートカットキーの録画
   */
  recordShortcutKey(event) {
    if (!this.recordedKeys) return;

    event.preventDefault();
    this.recordedKeys.add(event.code);

    // 録画完了の判定（キーが離されたタイミング）
    setTimeout(() => {
      if (this.recordedKeys && this.recordedKeys.size > 0) {
        const keys = Array.from(this.recordedKeys).sort();
        this.finalizeShortcutRecording(keys);
      }
    }, 100);
  }

  /**
   * ショートカット録画の完了
   */
  finalizeShortcutRecording(keys) {
    if (this.recordingShortcut) {
      // 競合チェック
      if (this.checkShortcutConflict(keys)) {
        console.warn(`[VR Shortcuts] Cannot record shortcut due to conflict`);
        this.showRecordingError('このキー組み合わせは既に使用されています');
      } else {
        // ショートカットの更新
        const shortcut = this.shortcuts.get(this.recordingShortcut);
        if (shortcut) {
          shortcut.keys = keys;
          this.saveShortcuts();
          console.log(`[VR Shortcuts] Recorded shortcut: ${this.recordingShortcut} = ${keys.join('+')}`);
          this.showRecordingSuccess(`ショートカットを記録しました: ${keys.join('+')}`);
        }
      }
    }

    this.stopRecordingShortcut();
  }

  /**
   * UI表示の切り替え
   */
  toggleUI() {
    // UI要素の表示/非表示切り替え
    const uiElements = document.querySelectorAll('.vr-ui-element');
    uiElements.forEach(element => {
      element.style.display = element.style.display === 'none' ? 'block' : 'none';
    });

    console.log('[VR Shortcuts] Toggled UI visibility');
  }

  /**
   * パフォーマンス情報の表示
   */
  showPerformanceInfo() {
    if (window.vrPerformanceMonitor) {
      const stats = window.vrPerformanceMonitor.getStats();
      console.log('Current Performance Stats:', stats);

      // UI通知
      if (window.UIComponents && window.UIComponents.Toast) {
        const toast = new window.UIComponents.Toast();
        toast.show({
          type: 'info',
          title: 'パフォーマンス情報',
          message: `FPS: ${stats.fps}, 平均: ${stats.averageFps?.toFixed(1)}`,
          duration: 5000
        });
      }
    }
  }

  /**
   * バッテリー情報の表示
   */
  showBatteryInfo() {
    if (window.vrBatteryMonitor) {
      const status = window.vrBatteryMonitor.getStatus();
      console.log('Current Battery Status:', status);

      // UI通知
      if (window.UIComponents && window.UIComponents.Toast) {
        const toast = new window.UIComponents.Toast();
        toast.show({
          type: 'info',
          title: 'バッテリー情報',
          message: `残量: ${status.level ? Math.round(status.level * 100) : '不明'}%, 充電: ${status.charging ? 'はい' : 'いいえ'}`,
          duration: 5000
        });
      }
    }
  }

  /**
   * 録画エラーの表示
   */
  showRecordingError(message) {
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'error',
        title: '録画エラー',
        message: message,
        duration: 3000
      });
    }
  }

  /**
   * 録画成功の表示
   */
  showRecordingSuccess(message) {
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'success',
        title: '録画完了',
        message: message,
        duration: 3000
      });
    }
  }

  /**
   * 設定UIの更新
   */
  updateSettingsUI() {
    // 設定UIにショートカット設定を統合
    if (window.vrSettingsUI) {
      // 設定UIの拡張（必要に応じて）
      console.log('[VR Shortcuts] Settings UI updated with shortcuts');
    }
  }

  /**
   * 配列の等価性チェック
   */
  arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }

  /**
   * ショートカット一覧の取得
   */
  getShortcuts() {
    const shortcuts = {};
    this.shortcuts.forEach((shortcut, id) => {
      shortcuts[id] = { ...shortcut };
    });

    return shortcuts;
  }

  /**
   * ジェスチャーショートカット一覧の取得
   */
  getGestureShortcuts() {
    const shortcuts = {};
    this.gestureShortcuts.forEach((shortcut, id) => {
      shortcuts[id] = { ...shortcut };
    });

    return shortcuts;
  }

  /**
   * カテゴリ別ショートカットの取得
   */
  getShortcutsByCategory() {
    const byCategory = {};

    this.categories.forEach((categoryInfo, categoryId) => {
      byCategory[categoryId] = {
        ...categoryInfo,
        shortcuts: [],
        gestureShortcuts: []
      };
    });

    this.shortcuts.forEach((shortcut, id) => {
      if (byCategory[shortcut.category]) {
        byCategory[shortcut.category].shortcuts.push({ id, ...shortcut });
      }
    });

    this.gestureShortcuts.forEach((shortcut, id) => {
      if (byCategory[shortcut.category]) {
        byCategory[shortcut.category].gestureShortcuts.push({ id, ...shortcut });
      }
    });

    return byCategory;
  }

  /**
   * ショートカットのリセット
   */
  resetToDefaults() {
    this.shortcuts = new Map(Object.entries(this.defaultShortcuts));
    this.gestureShortcuts = new Map(Object.entries(this.defaultGestureShortcuts));

    this.registerDefaultShortcuts();
    this.saveShortcuts();

    console.log('[VR Shortcuts] Reset to default shortcuts');
  }

  /**
   * ショートカットマネージャーの統計取得
   */
  getStats() {
    return {
      totalShortcuts: this.shortcuts.size,
      totalGestureShortcuts: this.gestureShortcuts.size,
      enabledShortcuts: Array.from(this.shortcuts.values()).filter(s => s.enabled).length,
      enabledGestureShortcuts: Array.from(this.gestureShortcuts.values()).filter(s => s.enabled).length,
      categories: this.categories.size,
      isRecording: this.isRecording,
      recordingShortcut: this.recordingShortcut
    };
  }
}

// グローバルインスタンス作成
const vrShortcutManager = new VRShortcutManager();

// グローバルアクセス用
window.vrShortcutManager = vrShortcutManager;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[VR Shortcuts] VR Shortcut Manager initialized');
});
