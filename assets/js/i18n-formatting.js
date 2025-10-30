// Language-specific formatting utilities
export class LocaleFormatter {
  constructor(language) {
    this.language = language;
    this.locale = this.getLocaleFromLanguage(language);
  }

  getLocaleFromLanguage(lang) {
    const localeMap = {
      'en': 'en-US',
      'ja': 'ja-JP',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'pt': 'pt-PT',
      'ru': 'ru-RU',
      'ko': 'ko-KR',
      'ar': 'ar-SA',
      'zh': 'zh-CN',
      'hi': 'hi-IN',
      'it': 'it-IT'
    };
    return localeMap[lang] || 'en-US';
  }

  formatDate(date, options = {}) {
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Intl.DateTimeFormat(this.locale, { ...defaultOptions, ...options }).format(date);
  }

  formatTime(date, options = {}) {
    const defaultOptions = {
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Intl.DateTimeFormat(this.locale, { ...defaultOptions, ...options }).format(date);
  }

  formatDateTime(date, options = {}) {
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Intl.DateTimeFormat(this.locale, { ...defaultOptions, ...options }).format(date);
  }

  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  formatNumber(number, options = {}) {
    return new Intl.NumberFormat(this.locale, options).format(number);
  }

  formatRelativeTime(date) {
    const now = new Date();
    const diffInMs = date.getTime() - now.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    let unit, value;
    if (Math.abs(diffInMinutes) < 60) {
      unit = 'minute';
      value = diffInMinutes;
    } else if (Math.abs(diffInHours) < 24) {
      unit = 'hour';
      value = diffInHours;
    } else {
      unit = 'day';
      value = diffInDays;
    }

    return new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' }).format(value, unit);
  }

  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${this.formatNumber(size, { maximumFractionDigits: 2 })} ${units[unitIndex]}`;
  }

  formatPercentage(value, options = {}) {
    return new Intl.NumberFormat(this.locale, {
      style: 'percent',
      ...options
    }).format(value / 100);
  }
}

// Global formatter instance
let currentFormatter = null;

export function getCurrentFormatter() {
  if (!currentFormatter) {
    currentFormatter = new LocaleFormatter('en');
  }
  return currentFormatter;
}

export function updateFormatter(language) {
  currentFormatter = new LocaleFormatter(language);
  return currentFormatter;
}

// Convenience functions for global use
export function formatDate(date, options) {
  return getCurrentFormatter().formatDate(date, options);
}

export function formatTime(date, options) {
  return getCurrentFormatter().formatTime(date, options);
}

export function formatDateTime(date, options) {
  return getCurrentFormatter().formatDateTime(date, options);
}

export function formatCurrency(amount, currency) {
  return getCurrentFormatter().formatCurrency(amount, currency);
}

export function formatNumber(number, options) {
  return getCurrentFormatter().formatNumber(number, options);
}

export function formatRelativeTime(date) {
  return getCurrentFormatter().formatRelativeTime(date);
}

export function formatFileSize(bytes) {
  return getCurrentFormatter().formatFileSize(bytes);
}

export function formatPercentage(value, options) {
  return getCurrentFormatter().formatPercentage(value, options);
}

// Make available globally
window.LocaleFormatter = LocaleFormatter;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.formatDateTime = formatDateTime;
window.formatCurrency = formatCurrency;
window.formatNumber = formatNumber;
window.formatRelativeTime = formatRelativeTime;
window.formatFileSize = formatFileSize;
window.formatPercentage = formatPercentage;
