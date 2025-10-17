const EventEmitter = require('events');
const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require('./i18n');

/**
 * Locale Data
 */
class LocaleData {
  constructor(locale, data = {}) {
    this.locale = locale;
    this.messages = data.messages || {};
    this.pluralRules = data.pluralRules || this.getDefaultPluralRules(locale);
    this.dateTimeFormats = data.dateTimeFormats || {};
    this.numberFormats = data.numberFormats || {};
    this.currencyFormats = data.currencyFormats || {};
  }

  /**
   * Get default plural rules for locale
   */
  getDefaultPluralRules(locale) {
    const lang = locale.split('-')[0];

    // No plural forms (Chinese, Japanese, Korean, etc.)
    if (['ja', 'zh', 'ko', 'vi', 'th', 'id', 'ms'].includes(lang)) {
      return { other: () => true };
    }

    // Arabic (complex plural rules)
    if (lang === 'ar') {
      return {
        zero: (n) => n === 0,
        one: (n) => n === 1,
        two: (n) => n === 2,
        few: (n) => n % 100 >= 3 && n % 100 <= 10,
        many: (n) => n % 100 >= 11 && n % 100 <= 99,
        other: () => true
      };
    }

    // Slavic languages (Russian, Polish, etc.)
    if (['ru', 'pl', 'cs', 'sk'].includes(lang)) {
      return {
        one: (n) => n % 10 === 1 && n % 100 !== 11,
        few: (n) => n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20),
        many: (n) => n % 10 === 0 || (n % 10 >= 5 && n % 10 <= 9) || (n % 100 >= 11 && n % 100 <= 14),
        other: () => true
      };
    }

    // Romanian
    if (lang === 'ro') {
      return {
        one: (n) => n === 1,
        few: (n) => n === 0 || (n % 100 >= 1 && n % 100 <= 19),
        other: () => true
      };
    }

    // Default English-like rules
    return {
      one: (n) => n === 1,
      other: () => true
    };
  }

  getMessage(key) {
    return this.messages[key];
  }

  setMessage(key, value) {
    this.messages[key] = value;
  }

  getPluralForm(count) {
    for (const [form, rule] of Object.entries(this.pluralRules)) {
      if (rule(count)) {
        return form;
      }
    }
    return 'other';
  }
}

/**
 * Message Formatter
 */
class MessageFormatter {
  constructor() {
    this.interpolationRegex = /\{([^}]+)\}/g;
  }

  format(message, values = {}) {
    if (!message) return '';

    return message.replace(this.interpolationRegex, (match, key) => {
      const trimmedKey = key.trim();

      // Plural syntax: {count, plural, one{} other{}}
      if (trimmedKey.includes('plural')) {
        return this.formatPlural(trimmedKey, values);
      }

      // Select syntax: {gender, select, male{} female{} other{}}
      if (trimmedKey.includes('select')) {
        return this.formatSelect(trimmedKey, values);
      }

      // Number format: {amount, number}
      if (trimmedKey.includes('number')) {
        const varName = trimmedKey.split(',')[0].trim();
        return values[varName] !== undefined ? values[varName].toLocaleString() : match;
      }

      // Date format: {date, date, short}
      if (trimmedKey.includes('date')) {
        const parts = trimmedKey.split(',').map(s => s.trim());
        const varName = parts[0];
        const style = parts[2] || 'medium';
        const date = values[varName];
        if (date) {
          return new Date(date).toLocaleDateString(undefined, { dateStyle: style });
        }
        return match;
      }

      // Simple interpolation
      return values[trimmedKey] !== undefined ? values[trimmedKey] : match;
    });
  }

  formatPlural(syntax, values) {
    const parts = syntax.split(',').map(s => s.trim());
    const varName = parts[0];
    const count = values[varName];

    if (count === undefined) return '';

    const formsMatch = syntax.match(/\b(zero|one|two|few|many|other)\{([^}]*)\}/g);
    if (!formsMatch) return '';

    const forms = {};
    formsMatch.forEach(formStr => {
      const match = formStr.match(/(\w+)\{([^}]*)\}/);
      if (match) {
        forms[match[1]] = match[2];
      }
    });

    let form = 'other';
    if (count === 0 && forms.zero) form = 'zero';
    else if (count === 1 && forms.one) form = 'one';
    else if (count === 2 && forms.two) form = 'two';

    return (forms[form] || forms.other || '').replace('#', count);
  }

  formatSelect(syntax, values) {
    const parts = syntax.split(',').map(s => s.trim());
    const varName = parts[0];
    const value = values[varName];

    if (value === undefined) return '';

    const optionsMatch = syntax.match(/\b(\w+)\{([^}]*)\}/g);
    if (!optionsMatch) return '';

    const options = {};
    optionsMatch.forEach(optStr => {
      const match = optStr.match(/(\w+)\{([^}]*)\}/);
      if (match) {
        options[match[1]] = match[2];
      }
    });

    return options[value] || options.other || '';
  }
}

/**
 * Date Time Formatter
 */
class DateTimeFormatter {
  constructor(locale, options = {}) {
    this.locale = locale;
    this.options = {
      dateStyle: 'medium',
      timeStyle: 'medium',
      ...options
    };
  }

  format(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }

    try {
      return new Intl.DateTimeFormat(this.locale, this.options).format(date);
    } catch (err) {
      return date.toISOString();
    }
  }

  formatRange(startDate, endDate) {
    if (!(startDate instanceof Date)) startDate = new Date(startDate);
    if (!(endDate instanceof Date)) endDate = new Date(endDate);

    try {
      return new Intl.DateTimeFormat(this.locale, this.options).formatRange(startDate, endDate);
    } catch (err) {
      return `${startDate.toISOString()} - ${endDate.toISOString()}`;
    }
  }

  formatRelative(date, baseDate = new Date()) {
    if (!(date instanceof Date)) date = new Date(date);
    if (!(baseDate instanceof Date)) baseDate = new Date(baseDate);

    const diff = date.getTime() - baseDate.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    try {
      const rtf = new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' });

      if (Math.abs(days) > 0) return rtf.format(days, 'day');
      if (Math.abs(hours) > 0) return rtf.format(hours, 'hour');
      if (Math.abs(minutes) > 0) return rtf.format(minutes, 'minute');
      return rtf.format(seconds, 'second');
    } catch (err) {
      return date.toISOString();
    }
  }
}

/**
 * Number Formatter
 */
class NumberFormatter {
  constructor(locale, options = {}) {
    this.locale = locale;
    this.options = options;
  }

  format(number) {
    try {
      return new Intl.NumberFormat(this.locale, this.options).format(number);
    } catch (err) {
      return number.toString();
    }
  }

  formatCurrency(amount, currency = 'USD') {
    try {
      return new Intl.NumberFormat(this.locale, {
        style: 'currency',
        currency,
        ...this.options
      }).format(amount);
    } catch (err) {
      return `${currency} ${amount}`;
    }
  }

  formatPercent(value) {
    try {
      return new Intl.NumberFormat(this.locale, {
        style: 'percent',
        ...this.options
      }).format(value);
    } catch (err) {
      return `${value * 100}%`;
    }
  }

  formatCompact(number) {
    try {
      return new Intl.NumberFormat(this.locale, {
        notation: 'compact',
        ...this.options
      }).format(number);
    } catch (err) {
      return number.toString();
    }
  }
}

/**
 * I18n Manager
 */
class I18nManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      defaultLocale: DEFAULT_LANGUAGE,
      fallbackLocale: 'en',
      supportedLocales: Object.keys(SUPPORTED_LANGUAGES),
      ...options
    };

    this.currentLocale = this.config.defaultLocale;
    this.locales = new Map();
    this.messageFormatter = new MessageFormatter();

    this.addLocale(this.config.defaultLocale, {});
  }

  addLocale(locale, data) {
    const localeData = new LocaleData(locale, data);
    this.locales.set(locale, localeData);
    this.emit('locale-added', locale);
    return localeData;
  }

  setLocale(locale) {
    if (!this.locales.has(locale)) {
      throw new Error(`Locale not found: ${locale}`);
    }

    const previousLocale = this.currentLocale;
    this.currentLocale = locale;

    this.emit('locale-changed', {
      previous: previousLocale,
      current: locale
    });

    return this.currentLocale;
  }

  getLocale() {
    return this.currentLocale;
  }

  getLocaleData(locale = this.currentLocale) {
    return this.locales.get(locale);
  }

  t(key, values = {}, locale = this.currentLocale) {
    const localeData = this.locales.get(locale);
    if (!localeData) {
      return key;
    }

    let message = localeData.getMessage(key);

    if (!message && locale !== this.config.fallbackLocale) {
      const fallbackData = this.locales.get(this.config.fallbackLocale);
      if (fallbackData) {
        message = fallbackData.getMessage(key);
      }
    }

    if (!message) {
      this.emit('missing-translation', { key, locale });
      return key;
    }

    return this.messageFormatter.format(message, values);
  }

  tn(key, count, values = {}, locale = this.currentLocale) {
    const localeData = this.locales.get(locale);
    if (!localeData) {
      return key;
    }

    const pluralForm = localeData.getPluralForm(count);
    const pluralKey = `${key}.${pluralForm}`;

    values.count = count;

    return this.t(pluralKey, values, locale);
  }

  formatDate(date, options = {}, locale = this.currentLocale) {
    const formatter = new DateTimeFormatter(locale, options);
    return formatter.format(date);
  }

  formatRelativeTime(date, baseDate, locale = this.currentLocale) {
    const formatter = new DateTimeFormatter(locale);
    return formatter.formatRelative(date, baseDate);
  }

  formatNumber(number, options = {}, locale = this.currentLocale) {
    const formatter = new NumberFormatter(locale, options);
    return formatter.format(number);
  }

  formatCurrency(amount, currency = 'USD', options = {}, locale = this.currentLocale) {
    const formatter = new NumberFormatter(locale, options);
    return formatter.formatCurrency(amount, currency);
  }

  formatPercent(value, options = {}, locale = this.currentLocale) {
    const formatter = new NumberFormatter(locale, options);
    return formatter.formatPercent(value);
  }

  formatCompact(number, options = {}, locale = this.currentLocale) {
    const formatter = new NumberFormatter(locale, options);
    return formatter.formatCompact(number);
  }

  detectLocale() {
    if (typeof navigator !== 'undefined') {
      return navigator.language || navigator.userLanguage || this.config.defaultLocale;
    }

    if (typeof process !== 'undefined') {
      return process.env.LANG?.split('.')[0]?.replace('_', '-') || this.config.defaultLocale;
    }

    return this.config.defaultLocale;
  }

  getSupportedLocales() {
    return this.config.supportedLocales;
  }

  isLocaleSupported(locale) {
    return this.config.supportedLocales.includes(locale);
  }

  getStats() {
    const stats = {
      currentLocale: this.currentLocale,
      totalLocales: this.locales.size,
      supportedLocales: this.config.supportedLocales.length,
      locales: {}
    };

    for (const [locale, data] of this.locales) {
      stats.locales[locale] = {
        messageCount: Object.keys(data.messages).length
      };
    }

    return stats;
  }

  clear() {
    this.locales.clear();
    this.addLocale(this.config.defaultLocale, {});
    this.currentLocale = this.config.defaultLocale;
  }

  destroy() {
    this.clear();
    this.removeAllListeners();
  }
}

module.exports = {
  LocaleData,
  MessageFormatter,
  DateTimeFormatter,
  NumberFormatter,
  I18nManager
};
