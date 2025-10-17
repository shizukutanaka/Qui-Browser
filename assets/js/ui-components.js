/**
 * Qui Browser UI Component Library
 * JavaScript implementations for interactive components
 */

class UIComponents {
  /**
   * トースト通知システム
   */
  static Toast = class {
    constructor() {
      this.container = this.createContainer();
      this.toasts = new Map();
    }

    createContainer() {
      let container = document.querySelector('.toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'false');
        document.body.appendChild(container);
      }
      return container;
    }

    show(options = {}) {
      const { type = 'info', title = '', message = '', duration = 5000, closable = true } = options;

      const id = Date.now() + Math.random();
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.setAttribute('role', 'status');
      toast.setAttribute('data-toast-id', id);

      const iconMap = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
      };

      toast.innerHTML = `
        <div class="toast-icon">${iconMap[type] || 'ℹ'}</div>
        <div class="toast-content">
          ${title ? `<div class="toast-title">${this.escapeHtml(title)}</div>` : ''}
          <div class="toast-message">${this.escapeHtml(message)}</div>
        </div>
        ${closable ? '<button class="toast-close" aria-label="閉じる">×</button>' : ''}
      `;

      if (closable) {
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.remove(id));
      }

      this.container.appendChild(toast);
      this.toasts.set(id, toast);

      if (duration > 0) {
        setTimeout(() => this.remove(id), duration);
      }

      return id;
    }

    remove(id) {
      const toast = this.toasts.get(id);
      if (toast) {
        toast.style.animation = 'slideOut 0.2s ease-in forwards';
        setTimeout(() => {
          toast.remove();
          this.toasts.delete(id);
        }, 200);
      }
    }

    success(message, title = '成功') {
      return this.show({ type: 'success', title, message });
    }

    error(message, title = 'エラー') {
      return this.show({ type: 'error', title, message });
    }

    warning(message, title = '警告') {
      return this.show({ type: 'warning', title, message });
    }

    info(message, title = '情報') {
      return this.show({ type: 'info', title, message });
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  };

  /**
   * モーダルダイアログシステム
   */
  static Modal = class {
    constructor(options = {}) {
      this.options = {
        title: '',
        content: '',
        footer: '',
        closable: true,
        onClose: null,
        ...options
      };
      this.isOpen = false;
      this.backdrop = null;
      this.modal = null;
    }

    open() {
      if (this.isOpen) {
        return;
      }

      this.backdrop = document.createElement('div');
      this.backdrop.className = 'modal-backdrop';
      this.backdrop.setAttribute('role', 'dialog');
      this.backdrop.setAttribute('aria-modal', 'true');
      this.backdrop.setAttribute('aria-labelledby', 'modal-title');

      this.modal = document.createElement('div');
      this.modal.className = 'modal';

      this.modal.innerHTML = `
        <div class="modal-header">
          <h2 class="modal-title" id="modal-title">${this.escapeHtml(this.options.title)}</h2>
          ${this.options.closable ? '<button class="btn btn-icon btn-subtle modal-close" aria-label="閉じる">×</button>' : ''}
        </div>
        <div class="modal-body">${this.options.content}</div>
        ${this.options.footer ? `<div class="modal-footer">${this.options.footer}</div>` : ''}
      `;

      this.backdrop.appendChild(this.modal);
      document.body.appendChild(this.backdrop);

      // Close on backdrop click
      this.backdrop.addEventListener('click', e => {
        if (e.target === this.backdrop && this.options.closable) {
          this.close();
        }
      });

      // Close button
      if (this.options.closable) {
        const closeBtn = this.modal.querySelector('.modal-close');
        closeBtn?.addEventListener('click', () => this.close());
      }

      // Escape key
      this.escapeHandler = e => {
        if (e.key === 'Escape' && this.options.closable) {
          this.close();
        }
      };
      document.addEventListener('keydown', this.escapeHandler);

      // Focus trap
      this.trapFocus();

      this.isOpen = true;
      document.body.style.overflow = 'hidden';
    }

    close() {
      if (!this.isOpen) {
        return;
      }

      this.backdrop.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => {
        this.backdrop?.remove();
        document.removeEventListener('keydown', this.escapeHandler);
        document.body.style.overflow = '';
        this.isOpen = false;

        if (typeof this.options.onClose === 'function') {
          this.options.onClose();
        }
      }, 200);
    }

    trapFocus() {
      const focusableElements = this.modal.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      this.modal.addEventListener('keydown', e => {
        if (e.key !== 'Tab') {
          return;
        }

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
      });

      firstElement?.focus();
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    static confirm(message, title = '確認') {
      return new Promise(resolve => {
        const modal = new UIComponents.Modal({
          title,
          content: `<p>${message}</p>`,
          footer: `
            <button class="btn btn-secondary modal-cancel">キャンセル</button>
            <button class="btn btn-primary modal-confirm">OK</button>
          `,
          closable: true,
          onClose: () => resolve(false)
        });

        modal.open();

        setTimeout(() => {
          const confirmBtn = modal.modal.querySelector('.modal-confirm');
          const cancelBtn = modal.modal.querySelector('.modal-cancel');

          confirmBtn?.addEventListener('click', () => {
            modal.close();
            resolve(true);
          });

          cancelBtn?.addEventListener('click', () => {
            modal.close();
            resolve(false);
          });
        }, 0);
      });
    }
  };

  /**
   * ドロップダウンメニューシステム
   */
  static Dropdown = class {
    constructor(trigger, menu) {
      this.trigger = trigger;
      this.menu = menu;
      this.isOpen = false;
      this.init();
    }

    init() {
      this.trigger.addEventListener('click', e => {
        e.stopPropagation();
        this.toggle();
      });

      document.addEventListener('click', e => {
        if (!this.menu.contains(e.target) && !this.trigger.contains(e.target)) {
          this.close();
        }
      });

      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
          this.trigger.focus();
        }
      });
    }

    open() {
      this.isOpen = true;
      this.trigger.closest('.dropdown').classList.add('active');
      this.trigger.setAttribute('aria-expanded', 'true');
      this.menu.querySelector('.dropdown-item')?.focus();
    }

    close() {
      this.isOpen = false;
      this.trigger.closest('.dropdown').classList.remove('active');
      this.trigger.setAttribute('aria-expanded', 'false');
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }
  };

  /**
   * タブシステム
   */
  static Tabs = class {
    constructor(container) {
      this.container = container;
      this.tabButtons = container.querySelectorAll('.tab-button');
      this.tabPanels = container.querySelectorAll('.tab-panel');
      this.init();
    }

    init() {
      this.tabButtons.forEach((button, index) => {
        button.addEventListener('click', () => this.selectTab(index));

        button.addEventListener('keydown', e => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.selectTab(index - 1);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.selectTab(index + 1);
          }
        });
      });
    }

    selectTab(index) {
      if (index < 0) {
        index = this.tabButtons.length - 1;
      }
      if (index >= this.tabButtons.length) {
        index = 0;
      }

      this.tabButtons.forEach((btn, i) => {
        const isSelected = i === index;
        btn.setAttribute('aria-selected', isSelected);
        btn.setAttribute('tabindex', isSelected ? '0' : '-1');
      });

      this.tabPanels.forEach((panel, i) => {
        panel.hidden = i !== index;
      });

      this.tabButtons[index].focus();
    }
  };

  /**
   * ローディングスピナー
   */
  static showLoading(element) {
    element.classList.add('btn-loading');
    element.disabled = true;
  }

  static hideLoading(element) {
    element.classList.remove('btn-loading');
    element.disabled = false;
  }

  /**
   * フォームバリデーション
   */
  static validateForm(form) {
    const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
    let isValid = true;

    inputs.forEach(input => {
      if (!input.value.trim()) {
        input.classList.add('input-error');
        isValid = false;

        // エラーメッセージを表示
        let errorMsg = input.parentElement.querySelector('.input-error-message');
        if (!errorMsg) {
          errorMsg = document.createElement('div');
          errorMsg.className = 'input-error-message';
          errorMsg.textContent = `${input.getAttribute('aria-label') || 'この項目'}は必須です`;
          input.parentElement.appendChild(errorMsg);
        }
      } else {
        input.classList.remove('input-error');
        const errorMsg = input.parentElement.querySelector('.input-error-message');
        errorMsg?.remove();
      }
    });

    return isValid;
  }

  /**
   * スムーズスクロール
   */
  static smoothScrollTo(element, offset = 0) {
    const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({
      top: targetPosition,
      behavior: 'smooth'
    });
  }

  /**
   * クリップボードにコピー
   */
  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  }

  /**
   * デバウンス関数
   */
  static debounce(func, wait) {
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

  /**
   * スロットル関数
   */
  static throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }
}

// グローバルインスタンス
window.toast = new UIComponents.Toast();

// CSS for slideOut animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOut {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIComponents;
}

// Export globally for browser usage
if (typeof window !== 'undefined') {
  window.UIComponents = UIComponents;
}
