/**
 * Qui Browser Advanced Components
 * Atlassian Design System準拠の高度なコンポーネント実装
 */

class AdvancedComponents {
  /**
   * Avatar コンポーネント
   */
  static Avatar = class {
    static create(options = {}) {
      const { src = null, name = '', size = 'md', status = null, alt = name } = options;

      const avatar = document.createElement('div');
      avatar.className = `avatar avatar-${size}`;

      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        avatar.appendChild(img);
      } else if (name) {
        const initials = name
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        avatar.textContent = initials;
        avatar.style.background = this.generateColor(name);
      }

      if (status) {
        const statusDot = document.createElement('span');
        statusDot.className = `avatar-status ${status}`;
        statusDot.setAttribute('aria-label', `Status: ${status}`);
        avatar.appendChild(statusDot);
      }

      return avatar;
    }

    static generateColor(name) {
      const colors = ['#0052CC', '#6554C0', '#00875A', '#FF991F', '#DE350B', '#36B37E', '#5243AA', '#FF5630'];
      const hash = name.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
      }, 0);
      return colors[Math.abs(hash) % colors.length];
    }

    static createGroup(avatars, maxVisible = 5) {
      const group = document.createElement('div');
      group.className = 'avatar-group';

      const visible = avatars.slice(0, maxVisible);
      const remaining = avatars.length - maxVisible;

      visible.forEach(avatarOptions => {
        group.appendChild(this.create(avatarOptions));
      });

      if (remaining > 0) {
        const more = document.createElement('div');
        more.className = 'avatar avatar-md';
        more.textContent = `+${remaining}`;
        more.style.background = 'var(--color-background-subtle)';
        more.style.color = 'var(--color-text-secondary)';
        group.appendChild(more);
      }

      return group;
    }
  };

  /**
   * Breadcrumbs コンポーネント
   */
  static Breadcrumbs = class {
    static create(items) {
      const nav = document.createElement('nav');
      nav.className = 'breadcrumbs';
      nav.setAttribute('aria-label', 'Breadcrumb');

      const ol = document.createElement('ol');
      ol.style.cssText = 'display: flex; list-style: none; margin: 0; padding: 0; gap: var(--space-8);';

      items.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'breadcrumb-item';

        if (index === items.length - 1) {
          const current = document.createElement('span');
          current.className = 'breadcrumb-current';
          current.setAttribute('aria-current', 'page');
          current.textContent = item.label;
          li.appendChild(current);
        } else {
          const link = document.createElement('a');
          link.className = 'breadcrumb-link';
          link.href = item.href;
          link.textContent = item.label;
          li.appendChild(link);

          const separator = document.createElement('span');
          separator.className = 'breadcrumb-separator';
          separator.textContent = '/';
          separator.setAttribute('aria-hidden', 'true');
          li.appendChild(separator);
        }

        ol.appendChild(li);
      });

      nav.appendChild(ol);
      return nav;
    }
  };

  /**
   * Table コンポーネント
   */
  static Table = class {
    constructor(container, options = {}) {
      this.container = container;
      this.options = {
        columns: [],
        data: [],
        sortable: true,
        striped: false,
        hoverable: true,
        ...options
      };
      this.sortColumn = null;
      this.sortDirection = 'asc';
      this.render();
    }

    render() {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-container';

      const table = document.createElement('table');
      table.className = this.options.sortable ? 'table table-sortable' : 'table';

      // ヘッダー
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');

      this.options.columns.forEach((column, index) => {
        const th = document.createElement('th');
        th.textContent = column.label;

        if (this.options.sortable && column.sortable !== false) {
          th.style.cursor = 'pointer';
          th.addEventListener('click', () => this.sort(column.key, index));
        }

        headerRow.appendChild(th);
      });

      thead.appendChild(headerRow);
      table.appendChild(thead);

      // ボディ
      const tbody = document.createElement('tbody');
      this.renderRows(tbody);
      table.appendChild(tbody);

      wrapper.appendChild(table);
      this.container.innerHTML = '';
      this.container.appendChild(wrapper);
    }

    renderRows(tbody) {
      const data = this.getSortedData();

      data.forEach(row => {
        const tr = document.createElement('tr');

        this.options.columns.forEach(column => {
          const td = document.createElement('td');

          if (column.render) {
            const content = column.render(row[column.key], row);
            if (typeof content === 'string') {
              td.innerHTML = content;
            } else {
              td.appendChild(content);
            }
          } else {
            td.textContent = row[column.key] || '';
          }

          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
    }

    getSortedData() {
      if (!this.sortColumn) {
        return this.options.data;
      }

      return [...this.options.data].sort((a, b) => {
        const aVal = a[this.sortColumn];
        const bVal = b[this.sortColumn];

        if (aVal === bVal) {
          return 0;
        }

        const comparison = aVal > bVal ? 1 : -1;
        return this.sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    sort(key, index) {
      if (this.sortColumn === key) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortColumn = key;
        this.sortDirection = 'asc';
      }

      // ヘッダーのスタイル更新
      const ths = this.container.querySelectorAll('th');
      ths.forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
      });

      ths[index].classList.add(`sorted-${this.sortDirection}`);

      // 行を再レンダリング
      const tbody = this.container.querySelector('tbody');
      tbody.innerHTML = '';
      this.renderRows(tbody);
    }

    updateData(data) {
      this.options.data = data;
      this.render();
    }
  };

  /**
   * Pagination コンポーネント
   */
  static Pagination = class {
    constructor(options = {}) {
      this.options = {
        total: 0,
        pageSize: 10,
        currentPage: 1,
        maxButtons: 7,
        onChange: null,
        ...options
      };
    }

    render() {
      const totalPages = Math.ceil(this.options.total / this.options.pageSize);
      const nav = document.createElement('nav');
      nav.className = 'pagination';
      nav.setAttribute('aria-label', 'Pagination');

      // 前へボタン
      const prevBtn = this.createButton('←', this.options.currentPage - 1);
      prevBtn.disabled = this.options.currentPage === 1;
      prevBtn.setAttribute('aria-label', 'Previous page');
      nav.appendChild(prevBtn);

      // ページ番号
      const pages = this.getPageNumbers(totalPages);
      pages.forEach(page => {
        if (page === '...') {
          const ellipsis = document.createElement('span');
          ellipsis.className = 'pagination-ellipsis';
          ellipsis.textContent = '...';
          nav.appendChild(ellipsis);
        } else {
          const btn = this.createButton(page, page);
          if (page === this.options.currentPage) {
            btn.classList.add('active');
            btn.setAttribute('aria-current', 'page');
          }
          nav.appendChild(btn);
        }
      });

      // 次へボタン
      const nextBtn = this.createButton('→', this.options.currentPage + 1);
      nextBtn.disabled = this.options.currentPage === totalPages;
      nextBtn.setAttribute('aria-label', 'Next page');
      nav.appendChild(nextBtn);

      return nav;
    }

    createButton(label, page) {
      const btn = document.createElement('button');
      btn.className = 'pagination-button';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (typeof this.options.onChange === 'function') {
          this.options.onChange(page);
        }
      });
      return btn;
    }

    getPageNumbers(totalPages) {
      const current = this.options.currentPage;
      const max = this.options.maxButtons;

      if (totalPages <= max) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }

      const pages = [];
      const leftSide = Math.floor((max - 3) / 2);
      const rightSide = Math.ceil((max - 3) / 2);

      pages.push(1);

      if (current > leftSide + 2) {
        pages.push('...');
      }

      const start = Math.max(2, current - leftSide);
      const end = Math.min(totalPages - 1, current + rightSide);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < totalPages - rightSide - 1) {
        pages.push('...');
      }

      pages.push(totalPages);

      return pages;
    }
  };

  /**
   * Form Validation
   */
  static FormValidator = class {
    static validate(form) {
      const errors = [];
      const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');

      inputs.forEach(input => {
        this.clearError(input);

        // Required check
        if (!input.value.trim()) {
          this.showError(input, `${this.getFieldLabel(input)}は必須です`);
          errors.push(input);
          return;
        }

        // Email validation
        if (input.type === 'email' && !this.isValidEmail(input.value)) {
          this.showError(input, '有効なメールアドレスを入力してください');
          errors.push(input);
          return;
        }

        // URL validation
        if (input.type === 'url' && !this.isValidUrl(input.value)) {
          this.showError(input, '有効なURLを入力してください');
          errors.push(input);
          return;
        }

        // Min length
        if (input.minLength && input.value.length < input.minLength) {
          this.showError(input, `${input.minLength}文字以上で入力してください`);
          errors.push(input);
          return;
        }

        // Max length
        if (input.maxLength && input.value.length > input.maxLength) {
          this.showError(input, `${input.maxLength}文字以内で入力してください`);
          errors.push(input);
          return;
        }

        // Pattern matching
        if (input.pattern) {
          const regex = new RegExp(input.pattern);
          if (!regex.test(input.value)) {
            this.showError(input, '入力形式が正しくありません');
            errors.push(input);
            return;
          }
        }
      });

      return errors.length === 0;
    }

    static showError(input, message) {
      input.classList.add('input-error');

      let errorMsg = input.parentElement.querySelector('.input-error-message');
      if (!errorMsg) {
        errorMsg = document.createElement('div');
        errorMsg.className = 'input-error-message';
        input.parentElement.appendChild(errorMsg);
      }
      errorMsg.textContent = message;
    }

    static clearError(input) {
      input.classList.remove('input-error');
      const errorMsg = input.parentElement.querySelector('.input-error-message');
      if (errorMsg) {
        errorMsg.remove();
      }
    }

    static getFieldLabel(input) {
      const label = input.parentElement.querySelector('label');
      return label ? label.textContent : input.getAttribute('aria-label') || 'この項目';
    }

    static isValidEmail(email) {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    }

    static isValidUrl(url) {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }
  };

  /**
   * Inline Edit
   */
  static InlineEdit = class {
    constructor(element, options = {}) {
      this.element = element;
      this.options = {
        onSave: null,
        onCancel: null,
        placeholder: 'クリックして編集',
        ...options
      };
      this.isEditing = false;
      this.originalValue = element.textContent;
      this.init();
    }

    init() {
      this.element.style.cursor = 'pointer';
      this.element.setAttribute('tabindex', '0');
      this.element.setAttribute('role', 'button');
      this.element.setAttribute('aria-label', '編集可能なテキスト');

      this.element.addEventListener('click', () => this.startEdit());
      this.element.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.startEdit();
        }
      });
    }

    startEdit() {
      if (this.isEditing) {
        return;
      }

      this.isEditing = true;
      this.originalValue = this.element.textContent;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'input';
      input.value = this.originalValue;
      input.style.width = '100%';

      const container = document.createElement('div');
      container.style.cssText = 'display: flex; gap: 8px; align-items: center;';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-sm btn-success';
      saveBtn.textContent = '✓';
      saveBtn.setAttribute('aria-label', '保存');

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-sm btn-secondary';
      cancelBtn.textContent = '×';
      cancelBtn.setAttribute('aria-label', 'キャンセル');

      container.appendChild(input);
      container.appendChild(saveBtn);
      container.appendChild(cancelBtn);

      this.element.innerHTML = '';
      this.element.appendChild(container);

      input.focus();
      input.select();

      saveBtn.addEventListener('click', () => this.save(input.value));
      cancelBtn.addEventListener('click', () => this.cancel());

      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.save(input.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.cancel();
        }
      });
    }

    save(value) {
      this.element.textContent = value;
      this.isEditing = false;

      if (typeof this.options.onSave === 'function') {
        this.options.onSave(value, this.originalValue);
      }
    }

    cancel() {
      this.element.textContent = this.originalValue;
      this.isEditing = false;

      if (typeof this.options.onCancel === 'function') {
        this.options.onCancel();
      }
    }
  };

  /**
   * Empty State Helper
   */
  static createEmptyState(options = {}) {
    const { icon = '📭', title = 'データがありません', description = '', actions = [] } = options;

    const container = document.createElement('div');
    container.className = 'empty-state';

    const iconEl = document.createElement('div');
    iconEl.className = 'empty-state-icon';
    iconEl.textContent = icon;
    container.appendChild(iconEl);

    const titleEl = document.createElement('h3');
    titleEl.className = 'empty-state-title';
    titleEl.textContent = title;
    container.appendChild(titleEl);

    if (description) {
      const descEl = document.createElement('p');
      descEl.className = 'empty-state-description';
      descEl.textContent = description;
      container.appendChild(descEl);
    }

    if (actions.length > 0) {
      const actionsEl = document.createElement('div');
      actionsEl.className = 'empty-state-actions';

      actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = action.className || 'btn btn-primary';
        btn.textContent = action.label;
        btn.addEventListener('click', action.onClick);
        actionsEl.appendChild(btn);
      });

      container.appendChild(actionsEl);
    }

    return container;
  }
}

// グローバルに公開
window.AdvancedComponents = AdvancedComponents;

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdvancedComponents;
}
