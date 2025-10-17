/**
 * Qui Browser Extended Components
 * Atlassian Design System完全準拠の拡張コンポーネントJavaScript実装
 */

class ExtendedComponents {
  /**
   * Banner コンポーネント
   */
  static Banner = class {
    static create(options = {}) {
      const {
        type = 'announcement', // announcement, warning, error
        title = '',
        message = '',
        icon = null,
        closable = true,
        actions = [],
        position = 'default', // default, top
        onClose = null
      } = options;

      const banner = document.createElement('div');
      banner.className = `banner banner-${type}`;

      if (position === 'top') {
        banner.classList.add('banner-top');
      }

      // アイコン
      const defaultIcons = {
        announcement: 'ℹ️',
        warning: '⚠️',
        error: '❌'
      };

      const iconEl = document.createElement('div');
      iconEl.className = 'banner-icon';
      iconEl.textContent = icon || defaultIcons[type] || 'ℹ️';
      iconEl.setAttribute('aria-hidden', 'true');
      banner.appendChild(iconEl);

      // コンテンツ
      const content = document.createElement('div');
      content.className = 'banner-content';

      if (title) {
        const titleEl = document.createElement('div');
        titleEl.className = 'banner-title';
        titleEl.textContent = title;
        content.appendChild(titleEl);
      }

      if (message) {
        const messageEl = document.createElement('div');
        messageEl.className = 'banner-message';
        messageEl.textContent = message;
        content.appendChild(messageEl);
      }

      banner.appendChild(content);

      // アクション
      if (actions.length > 0) {
        const actionsEl = document.createElement('div');
        actionsEl.className = 'banner-actions';

        actions.forEach(action => {
          const btn = document.createElement('button');
          btn.className = action.className || 'btn btn-sm btn-primary';
          btn.textContent = action.label;
          btn.addEventListener('click', action.onClick);
          actionsEl.appendChild(btn);
        });

        banner.appendChild(actionsEl);
      }

      // 閉じるボタン
      if (closable) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'banner-close';
        closeBtn.setAttribute('aria-label', '閉じる');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => {
          banner.style.animation = 'slideOutUp 0.3s ease-in';
          setTimeout(() => {
            banner.remove();
            if (typeof onClose === 'function') {
              onClose();
            }
          }, 300);
        });
        banner.appendChild(closeBtn);
      }

      banner.setAttribute('role', type === 'error' ? 'alert' : 'status');
      banner.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

      return banner;
    }

    static show(options) {
      const banner = this.create(options);

      if (options.position === 'top') {
        document.body.insertBefore(banner, document.body.firstChild);
      } else {
        const container = document.querySelector('.banner-container') || this.createContainer();
        container.appendChild(banner);
      }

      return banner;
    }

    static createContainer() {
      const container = document.createElement('div');
      container.className = 'banner-container';
      container.style.cssText = `
        position: fixed;
        top: var(--space-16);
        left: 50%;
        transform: translateX(-50%);
        z-index: var(--z-index-toast);
        width: calc(100% - 32px);
        max-width: 800px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
      return container;
    }
  };

  /**
   * Spinner コンポーネント
   */
  static Spinner = class {
    static create(options = {}) {
      const {
        size = 'md', // sm, md, lg, xl
        inverse = false,
        label = null
      } = options;

      if (label) {
        const container = document.createElement('div');
        container.className = 'spinner-container';

        const spinner = document.createElement('div');
        spinner.className = `spinner spinner-${size}`;
        if (inverse) {
          spinner.classList.add('spinner-inverse');
        }
        spinner.setAttribute('role', 'status');
        spinner.setAttribute('aria-label', 'Loading');

        const labelEl = document.createElement('span');
        labelEl.className = 'spinner-label';
        labelEl.textContent = label;

        container.appendChild(spinner);
        container.appendChild(labelEl);

        return container;
      }

      const spinner = document.createElement('div');
      spinner.className = `spinner spinner-${size}`;
      if (inverse) {
        spinner.classList.add('spinner-inverse');
      }
      spinner.setAttribute('role', 'status');
      spinner.setAttribute('aria-label', 'Loading');

      return spinner;
    }

    static showOverlay(options = {}) {
      const { dark = false, label = '読み込み中...' } = options;

      const overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      if (dark) {
        overlay.classList.add('loading-overlay-dark');
      }

      const container = document.createElement('div');
      container.className = 'spinner-container';

      const spinner = this.create({ size: 'xl', inverse: dark });
      container.appendChild(spinner);

      if (label) {
        const labelEl = document.createElement('div');
        labelEl.className = 'spinner-label';
        labelEl.style.fontSize = 'var(--font-size-16)';
        labelEl.style.fontWeight = 'var(--font-weight-semibold)';
        labelEl.textContent = label;
        container.appendChild(labelEl);
      }

      overlay.appendChild(container);
      document.body.appendChild(overlay);

      return {
        hide: () => {
          overlay.style.animation = 'fadeOut 0.2s ease-out';
          setTimeout(() => overlay.remove(), 200);
        }
      };
    }
  };

  /**
   * Flag コンポーネント (Atlassian風の通知)
   */
  static Flag = class {
    static create(options = {}) {
      const {
        type = 'info', // success, error, warning, info
        title = '',
        description = '',
        actions = [],
        autoDismiss = true,
        dismissDelay = 5000
      } = options;

      const flag = document.createElement('div');
      flag.className = 'flag';

      // アイコン
      const icon = document.createElement('div');
      icon.className = `flag-icon flag-icon-${type}`;
      const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
      };
      icon.textContent = icons[type] || icons.info;
      flag.appendChild(icon);

      // コンテンツ
      const content = document.createElement('div');
      content.className = 'flag-content';

      if (title) {
        const titleEl = document.createElement('div');
        titleEl.className = 'flag-title';
        titleEl.textContent = title;
        content.appendChild(titleEl);
      }

      if (description) {
        const descEl = document.createElement('div');
        descEl.className = 'flag-description';
        descEl.textContent = description;
        content.appendChild(descEl);
      }

      if (actions.length > 0) {
        const actionsEl = document.createElement('div');
        actionsEl.className = 'flag-actions';

        actions.forEach(action => {
          const btn = document.createElement('button');
          btn.className = action.className || 'btn btn-sm btn-subtle';
          btn.textContent = action.label;
          btn.addEventListener('click', () => {
            action.onClick();
            this.dismiss(flag);
          });
          actionsEl.appendChild(btn);
        });

        content.appendChild(actionsEl);
      }

      flag.appendChild(content);

      // 閉じるボタン
      const closeBtn = document.createElement('button');
      closeBtn.className = 'flag-close';
      closeBtn.setAttribute('aria-label', '閉じる');
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => this.dismiss(flag));
      flag.appendChild(closeBtn);

      flag.setAttribute('role', 'status');
      flag.setAttribute('aria-live', 'polite');

      // 自動消去
      if (autoDismiss) {
        setTimeout(() => this.dismiss(flag), dismissDelay);
      }

      return flag;
    }

    static show(options) {
      const flag = this.create(options);
      const container = document.querySelector('.flag-container') || this.createContainer();
      container.appendChild(flag);
      return flag;
    }

    static dismiss(flag) {
      flag.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => flag.remove(), 300);
    }

    static createContainer() {
      const container = document.createElement('div');
      container.className = 'flag-container';
      container.style.cssText = `
        position: fixed;
        bottom: var(--space-24);
        right: var(--space-24);
        z-index: var(--z-index-toast);
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        max-width: 400px;
      `;
      document.body.appendChild(container);
      return container;
    }
  };

  /**
   * Popup/Popover コンポーネント
   */
  static Popup = class {
    constructor(trigger, options = {}) {
      this.trigger = trigger;
      this.options = {
        title: '',
        content: '',
        footer: null,
        placement: 'bottom', // top, bottom, left, right
        width: 'auto',
        ...options
      };
      this.popup = null;
      this.isOpen = false;
      this.init();
    }

    init() {
      this.trigger.addEventListener('click', e => {
        e.stopPropagation();
        this.toggle();
      });

      document.addEventListener('click', e => {
        if (this.isOpen && this.popup && !this.popup.contains(e.target) && !this.trigger.contains(e.target)) {
          this.close();
        }
      });
    }

    open() {
      if (this.isOpen) {
        return;
      }

      this.popup = this.createPopup();
      document.body.appendChild(this.popup);
      this.position();
      this.isOpen = true;

      // アニメーション後にフォーカス
      setTimeout(() => {
        const firstFocusable = this.popup.querySelector('button, a, input, [tabindex]:not([tabindex="-1"])');
        firstFocusable?.focus();
      }, 100);
    }

    close() {
      if (!this.isOpen || !this.popup) {
        return;
      }

      this.popup.style.animation = 'zoomOut 0.15s ease-in';
      setTimeout(() => {
        this.popup?.remove();
        this.popup = null;
        this.isOpen = false;
      }, 150);
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    createPopup() {
      const popup = document.createElement('div');
      popup.className = `popup popup-${this.options.placement}`;
      if (this.options.width !== 'auto') {
        popup.style.width = this.options.width;
      }

      if (this.options.title) {
        const header = document.createElement('div');
        header.className = 'popup-header';

        const title = document.createElement('div');
        title.className = 'popup-title';
        title.textContent = this.options.title;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'popup-close';
        closeBtn.setAttribute('aria-label', '閉じる');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => this.close());

        header.appendChild(title);
        header.appendChild(closeBtn);
        popup.appendChild(header);
      }

      const body = document.createElement('div');
      body.className = 'popup-body';

      if (typeof this.options.content === 'string') {
        body.innerHTML = this.options.content;
      } else {
        body.appendChild(this.options.content);
      }

      popup.appendChild(body);

      if (this.options.footer) {
        const footer = document.createElement('div');
        footer.className = 'popup-footer';
        footer.innerHTML = this.options.footer;
        popup.appendChild(footer);
      }

      return popup;
    }

    position() {
      if (!this.popup) {
        return;
      }

      const triggerRect = this.trigger.getBoundingClientRect();
      const popupRect = this.popup.getBoundingClientRect();
      const spacing = 8;

      let top, left;

      switch (this.options.placement) {
        case 'top':
          top = triggerRect.top - popupRect.height - spacing;
          left = triggerRect.left + (triggerRect.width - popupRect.width) / 2;
          break;
        case 'bottom':
          top = triggerRect.bottom + spacing;
          left = triggerRect.left + (triggerRect.width - popupRect.width) / 2;
          break;
        case 'left':
          top = triggerRect.top + (triggerRect.height - popupRect.height) / 2;
          left = triggerRect.left - popupRect.width - spacing;
          break;
        case 'right':
          top = triggerRect.top + (triggerRect.height - popupRect.height) / 2;
          left = triggerRect.right + spacing;
          break;
      }

      // ビューポート内に収める
      top = Math.max(spacing, Math.min(top, window.innerHeight - popupRect.height - spacing));
      left = Math.max(spacing, Math.min(left, window.innerWidth - popupRect.width - spacing));

      this.popup.style.top = `${top}px`;
      this.popup.style.left = `${left}px`;
    }
  };

  /**
   * Progress Tracker コンポーネント
   */
  static ProgressTracker = class {
    static create(steps, currentStep = 0) {
      const tracker = document.createElement('div');
      tracker.className = 'progress-tracker';
      tracker.setAttribute('role', 'progressbar');
      tracker.setAttribute('aria-valuenow', currentStep);
      tracker.setAttribute('aria-valuemin', '0');
      tracker.setAttribute('aria-valuemax', steps.length - 1);

      steps.forEach((step, index) => {
        const stepEl = document.createElement('div');
        stepEl.className = 'progress-step';

        if (index < currentStep) {
          stepEl.classList.add('completed');
        } else if (index === currentStep) {
          stepEl.classList.add('active');
        }

        const marker = document.createElement('div');
        marker.className = 'progress-step-marker';

        if (index < currentStep) {
          marker.textContent = '✓';
        } else {
          marker.textContent = index + 1;
        }

        const label = document.createElement('div');
        label.className = 'progress-step-label';
        label.textContent = step;

        stepEl.appendChild(marker);
        stepEl.appendChild(label);
        tracker.appendChild(stepEl);
      });

      return tracker;
    }

    static update(tracker, currentStep) {
      const steps = tracker.querySelectorAll('.progress-step');

      steps.forEach((step, index) => {
        step.classList.remove('completed', 'active');
        const marker = step.querySelector('.progress-step-marker');

        if (index < currentStep) {
          step.classList.add('completed');
          marker.textContent = '✓';
        } else if (index === currentStep) {
          step.classList.add('active');
          marker.textContent = index + 1;
        } else {
          marker.textContent = index + 1;
        }
      });

      tracker.setAttribute('aria-valuenow', currentStep);
    }
  };

  /**
   * Tag コンポーネント
   */
  static Tag = class {
    static create(options = {}) {
      const { label = '', color = null, removable = false, onRemove = null } = options;

      const tag = document.createElement('div');
      tag.className = 'tag';
      if (color) {
        tag.classList.add(`tag-color-${color}`);
      }
      if (removable) {
        tag.classList.add('tag-removable');
      }

      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      tag.appendChild(labelEl);

      if (removable) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'tag-remove';
        removeBtn.setAttribute('aria-label', `${label}を削除`);
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
          tag.style.animation = 'zoomOut 0.15s ease-in';
          setTimeout(() => {
            tag.remove();
            if (typeof onRemove === 'function') {
              onRemove();
            }
          }, 150);
        });
        tag.appendChild(removeBtn);
      }

      return tag;
    }
  };

  /**
   * Menu コンポーネント
   */
  static Menu = class {
    static create(items) {
      const menu = document.createElement('div');
      menu.className = 'menu';
      menu.setAttribute('role', 'menu');

      items.forEach(section => {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'menu-section';

        if (section.title) {
          const titleEl = document.createElement('div');
          titleEl.className = 'menu-section-title';
          titleEl.textContent = section.title;
          sectionEl.appendChild(titleEl);
        }

        section.items.forEach(item => {
          const itemEl = document.createElement('a');
          itemEl.className = 'menu-item';
          if (item.danger) {
            itemEl.classList.add('menu-item-danger');
          }
          if (item.disabled) {
            itemEl.classList.add('disabled');
          }
          itemEl.setAttribute('role', 'menuitem');
          itemEl.href = item.href || '#';

          if (item.icon) {
            const icon = document.createElement('span');
            icon.className = 'menu-item-icon';
            icon.textContent = item.icon;
            itemEl.appendChild(icon);
          }

          const label = document.createElement('span');
          label.className = 'menu-item-label';
          label.textContent = item.label;
          itemEl.appendChild(label);

          if (item.shortcut) {
            const shortcut = document.createElement('span');
            shortcut.className = 'menu-item-shortcut';
            shortcut.textContent = item.shortcut;
            itemEl.appendChild(shortcut);
          }

          if (item.onClick) {
            itemEl.addEventListener('click', e => {
              if (!item.disabled) {
                e.preventDefault();
                item.onClick();
              }
            });
          }

          sectionEl.appendChild(itemEl);
        });

        menu.appendChild(sectionEl);
      });

      return menu;
    }
  };
}

// グローバルに公開
window.ExtendedComponents = ExtendedComponents;

// アニメーションの追加
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOutUp {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }
`;
document.head.appendChild(style);

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtendedComponents;
}
