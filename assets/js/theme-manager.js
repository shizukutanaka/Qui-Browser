/**
 * Qui Browser Theme Manager
 * ダークモード、ハイコントラスト、カスタムテーマの管理
 */

class ThemeManager {
  constructor() {
    this.themes = {
      light: 'light',
      dark: 'dark',
      highContrast: 'high-contrast',
      auto: 'auto'
    };

    this.currentTheme = this.loadTheme();
    this.prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.prefersContrast = window.matchMedia('(prefers-contrast: more)');
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.init();
  }

  init() {
    // 初期テーマを適用
    this.applyTheme(this.currentTheme);

    // システム設定の変更を監視
    this.prefersDark.addEventListener('change', () => {
      if (this.currentTheme === 'auto') {
        this.applyTheme('auto');
      }
    });

    this.prefersContrast.addEventListener('change', e => {
      if (e.matches && this.currentTheme !== 'high-contrast') {
        this.setTheme('high-contrast');
      }
    });

    // キーボードショートカット: Ctrl+Shift+D でダークモード切り替え
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.toggleTheme();
      }
    });
  }

  /**
   * テーマを設定
   */
  setTheme(theme) {
    if (!Object.values(this.themes).includes(theme)) {
      console.warn(`Invalid theme: ${theme}`);
      return;
    }

    this.currentTheme = theme;
    this.applyTheme(theme);
    this.saveTheme(theme);

    // カスタムイベントを発火
    window.dispatchEvent(
      new CustomEvent('themechange', {
        detail: { theme }
      })
    );

    // トースト通知
    if (window.toast) {
      const themeNames = {
        light: 'ライトモード',
        dark: 'ダークモード',
        'high-contrast': 'ハイコントラストモード',
        auto: '自動（システム設定）'
      };
      window.toast.info(`テーマを${themeNames[theme]}に変更しました`);
    }
  }

  /**
   * テーマを適用
   */
  applyTheme(theme) {
    const root = document.documentElement;

    // Remove all theme attributes
    root.removeAttribute('data-theme');
    root.removeAttribute('data-high-contrast');
    root.removeAttribute('data-reduced-motion');

    let effectiveTheme = theme;

    // autoの場合はシステム設定を使用
    if (theme === 'auto') {
      effectiveTheme = this.prefersDark.matches ? 'dark' : 'light';
    }

    // ハイコントラスト
    if (theme === 'high-contrast' || this.prefersContrast.matches) {
      root.setAttribute('data-theme', 'high-contrast');
    } else if (effectiveTheme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
    }

    // モーション低減
    if (this.prefersReducedMotion.matches) {
      root.setAttribute('data-reduced-motion', 'true');
    }

    // メタテーマカラーを更新
    this.updateMetaThemeColor(effectiveTheme);
  }

  /**
   * テーマをトグル
   */
  toggleTheme() {
    const currentEffectiveTheme = this.getEffectiveTheme();
    const newTheme = currentEffectiveTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  /**
   * 現在の有効なテーマを取得
   */
  getEffectiveTheme() {
    if (this.currentTheme === 'auto') {
      return this.prefersDark.matches ? 'dark' : 'light';
    }
    return this.currentTheme;
  }

  /**
   * テーマを保存
   */
  saveTheme(theme) {
    try {
      localStorage.setItem('qui-theme', theme);
      localStorage.setItem('qui-theme-timestamp', Date.now().toString());
    } catch (e) {
      console.error('Failed to save theme:', e);
    }
  }

  /**
   * テーマを読み込み
   */
  loadTheme() {
    try {
      const saved = localStorage.getItem('qui-theme');
      if (saved && Object.values(this.themes).includes(saved)) {
        return saved;
      }
    } catch (e) {
      console.error('Failed to load theme:', e);
    }

    // デフォルトはauto
    return 'auto';
  }

  /**
   * メタテーマカラーを更新
   */
  updateMetaThemeColor(theme) {
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }

    const colors = {
      light: '#ffffff',
      dark: '#1d2125',
      'high-contrast': '#000000'
    };

    metaTheme.content = colors[theme] || colors.light;
  }

  /**
   * カスタムカラーを設定
   */
  setCustomColors(colors = {}) {
    const root = document.documentElement;

    Object.entries(colors).forEach(([key, value]) => {
      if (key.startsWith('--')) {
        root.style.setProperty(key, value);
      } else {
        root.style.setProperty(`--color-${key}`, value);
      }
    });

    // カスタムカラーを保存
    try {
      localStorage.setItem('qui-custom-colors', JSON.stringify(colors));
    } catch (e) {
      console.error('Failed to save custom colors:', e);
    }
  }

  /**
   * カスタムカラーを読み込み
   */
  loadCustomColors() {
    try {
      const saved = localStorage.getItem('qui-custom-colors');
      if (saved) {
        const colors = JSON.parse(saved);
        this.setCustomColors(colors);
        return colors;
      }
    } catch (e) {
      console.error('Failed to load custom colors:', e);
    }
    return null;
  }

  /**
   * フォントサイズを設定
   */
  setFontSize(size = 'medium') {
    const root = document.documentElement;
    const sizes = {
      small: '14px',
      medium: '16px',
      large: '18px',
      xlarge: '20px'
    };

    root.style.fontSize = sizes[size] || sizes.medium;

    try {
      localStorage.setItem('qui-font-size', size);
    } catch (e) {
      console.error('Failed to save font size:', e);
    }

    if (window.toast) {
      window.toast.info(`フォントサイズを${size}に変更しました`);
    }
  }

  /**
   * フォントサイズを読み込み
   */
  loadFontSize() {
    try {
      const saved = localStorage.getItem('qui-font-size');
      if (saved) {
        this.setFontSize(saved);
        return saved;
      }
    } catch (e) {
      console.error('Failed to load font size:', e);
    }
    return 'medium';
  }

  /**
   * テーマ設定UIを作成
   */
  createThemeControls() {
    const controls = document.createElement('div');
    controls.className = 'theme-controls';
    controls.innerHTML = `
      <div class="dropdown theme-dropdown">
        <button class="btn btn-icon btn-subtle" aria-label="テーマ設定" aria-expanded="false">
          <span class="theme-icon">${this.getThemeIcon()}</span>
        </button>
        <div class="dropdown-menu" role="menu">
          <button class="dropdown-item" role="menuitem" data-theme="light">
            ☀️ ライトモード
          </button>
          <button class="dropdown-item" role="menuitem" data-theme="dark">
            🌙 ダークモード
          </button>
          <button class="dropdown-item" role="menuitem" data-theme="auto">
            🔄 自動
          </button>
          <button class="dropdown-item" role="menuitem" data-theme="high-contrast">
            ◐ ハイコントラスト
          </button>
          <div class="dropdown-divider"></div>
          <div class="font-size-controls" style="padding: 8px 12px;">
            <div style="font-size: 12px; color: var(--color-text-subtle); margin-bottom: 8px;">
              フォントサイズ
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-sm btn-subtle" data-font-size="small" title="小">A-</button>
              <button class="btn btn-sm btn-subtle" data-font-size="medium" title="中">A</button>
              <button class="btn btn-sm btn-subtle" data-font-size="large" title="大">A+</button>
              <button class="btn btn-sm btn-subtle" data-font-size="xlarge" title="特大">A++</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // イベントリスナー
    const trigger = controls.querySelector('.btn-icon');
    const menu = controls.querySelector('.dropdown-menu');
    // UIComponents is globally available
    if (typeof UIComponents !== 'undefined') {
      new UIComponents.Dropdown(trigger, menu);
    }

    // テーマ選択
    controls.querySelectorAll('[data-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTheme(btn.dataset.theme);
        trigger.querySelector('.theme-icon').textContent = this.getThemeIcon();
      });
    });

    // フォントサイズ選択
    controls.querySelectorAll('[data-font-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setFontSize(btn.dataset.fontSize);
      });
    });

    return controls;
  }

  /**
   * 現在のテーマアイコンを取得
   */
  getThemeIcon() {
    const icons = {
      light: '☀️',
      dark: '🌙',
      'high-contrast': '◐',
      auto: '🔄'
    };
    return icons[this.currentTheme] || icons.auto;
  }

  /**
   * テーマ切り替えアニメーション
   */
  animateThemeTransition() {
    const root = document.documentElement;
    root.style.transition = 'background-color 0.3s ease, color 0.3s ease';

    setTimeout(() => {
      root.style.transition = '';
    }, 300);
  }

  /**
   * 設定をエクスポート
   */
  exportSettings() {
    return {
      theme: this.currentTheme,
      fontSize: localStorage.getItem('qui-font-size'),
      customColors: localStorage.getItem('qui-custom-colors')
    };
  }

  /**
   * 設定をインポート
   */
  importSettings(settings) {
    if (settings.theme) {
      this.setTheme(settings.theme);
    }
    if (settings.fontSize) {
      this.setFontSize(settings.fontSize);
    }
    if (settings.customColors) {
      const colors = JSON.parse(settings.customColors);
      this.setCustomColors(colors);
    }
  }

  /**
   * 設定をリセット
   */
  resetSettings() {
    localStorage.removeItem('qui-theme');
    localStorage.removeItem('qui-font-size');
    localStorage.removeItem('qui-custom-colors');

    this.currentTheme = 'auto';
    this.applyTheme('auto');
    this.setFontSize('medium');

    if (window.toast) {
      window.toast.success('設定をリセットしました');
    }
  }
}

// グローバルインスタンス
window.themeManager = new ThemeManager();

// 初期化時にカスタムカラーとフォントサイズを読み込み
document.addEventListener('DOMContentLoaded', () => {
  window.themeManager.loadCustomColors();
  window.themeManager.loadFontSize();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
