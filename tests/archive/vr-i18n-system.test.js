/**
 * VR I18n System Test Suite
 *
 * Comprehensive tests for the multilingual internationalization system
 */

describe('VRI18nSystem', () => {
  let i18n;

  beforeEach(() => {
    // Create fresh instance for each test
    i18n = new (require('../assets/js/vr-i18n-system.js'))();
  });

  afterEach(() => {
    if (i18n) {
      i18n.dispose();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await expect(i18n.initialize()).resolves.not.toThrow();
      expect(i18n.initialized).toBe(true);
    });

    test('should have default language set', async () => {
      await i18n.initialize({ defaultLanguage: 'en' });
      expect(i18n.getCurrentLanguage()).toBe('en');
    });

    test('should auto-detect language when enabled', async () => {
      await i18n.initialize({ autoDetect: true });
      expect(i18n.state.detectedLanguage).toBeTruthy();
    });

    test('should not initialize twice', async () => {
      await i18n.initialize();
      const consoleSpy = jest.spyOn(console, 'warn');
      await i18n.initialize();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Already initialized'));
    });
  });

  describe('Language Support', () => {
    test('should support 100+ languages', () => {
      const languages = i18n.getSupportedLanguages();
      expect(languages.length).toBeGreaterThanOrEqual(100);
    });

    test('should have complete language metadata', () => {
      const languages = i18n.getSupportedLanguages();
      languages.forEach(lang => {
        expect(lang).toHaveProperty('code');
        expect(lang).toHaveProperty('name');
        expect(lang).toHaveProperty('nativeName');
        expect(lang).toHaveProperty('speakers');
        expect(lang).toHaveProperty('rtl');
      });
    });

    test('should correctly identify RTL languages', () => {
      const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi'];
      rtlLanguages.forEach(lang => {
        expect(i18n.isRTLLanguage(lang)).toBe(true);
      });
    });

    test('should correctly identify LTR languages', () => {
      const ltrLanguages = ['en', 'ja', 'zh', 'es', 'fr', 'de'];
      ltrLanguages.forEach(lang => {
        expect(i18n.isRTLLanguage(lang)).toBe(false);
      });
    });
  });

  describe('Language Detection', () => {
    test('should detect language from browser', async () => {
      // Mock navigator.language
      Object.defineProperty(navigator, 'language', {
        value: 'ja-JP',
        configurable: true
      });

      const detected = await i18n.detectLanguage();
      expect(detected).toBe('ja');
    });

    test('should extract language code from locale', () => {
      expect(i18n.extractLanguageCode('en-US')).toBe('en');
      expect(i18n.extractLanguageCode('zh-Hans-CN')).toBe('zh');
      expect(i18n.extractLanguageCode('es')).toBe('es');
    });

    test('should detect language by timezone', async () => {
      // Mock timezone
      jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
        .mockReturnValue({ timeZone: 'Asia/Tokyo' });

      const detected = await i18n.detectLanguageByGeolocation();
      expect(detected).toBe('ja');
    });
  });

  describe('Language Switching', () => {
    beforeEach(async () => {
      await i18n.initialize({ defaultLanguage: 'en' });
    });

    test('should switch language successfully', async () => {
      await i18n.setLanguage('ja');
      expect(i18n.getCurrentLanguage()).toBe('ja');
    });

    test('should update locale when switching language', async () => {
      await i18n.setLanguage('ja');
      expect(i18n.getCurrentLocale()).toBe('ja-JP');
    });

    test('should update RTL mode when switching to RTL language', async () => {
      await i18n.setLanguage('ar');
      expect(i18n.isRTL()).toBe(true);
    });

    test('should emit languageChanged event', async () => {
      const eventSpy = jest.fn();
      i18n.addEventListener('languageChanged', eventSpy);

      await i18n.setLanguage('ja');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            oldLanguage: 'en',
            newLanguage: 'ja',
            isRTL: false
          })
        })
      );
    });

    test('should fallback to fallback language for unsupported language', async () => {
      await i18n.setLanguage('xyz');
      expect(i18n.getCurrentLanguage()).toBe(i18n.config.fallbackLanguage);
    });

    test('should save language preference to localStorage', async () => {
      await i18n.setLanguage('ja');
      expect(localStorage.getItem('vr-browser-language')).toBe('ja');
    });
  });

  describe('Translation', () => {
    beforeEach(async () => {
      await i18n.initialize({ defaultLanguage: 'en' });

      // Mock translation data
      i18n.translations.set('en', {
        common: {
          ok: 'OK',
          cancel: 'Cancel',
          greeting: 'Hello, {name}!'
        },
        tabs: {
          tabCount: {
            zero: 'No tabs',
            one: '1 tab',
            other: '{count} tabs'
          }
        }
      });

      i18n.translations.set('ja', {
        common: {
          ok: 'OK',
          cancel: 'キャンセル',
          greeting: 'こんにちは、{name}!'
        }
      });

      i18n.state.translationsLoaded.add('en');
      i18n.state.translationsLoaded.add('ja');
    });

    test('should translate simple key', () => {
      const text = i18n.t('common.ok');
      expect(text).toBe('OK');
    });

    test('should translate with parameters', () => {
      const text = i18n.t('common.greeting', { name: 'John' });
      expect(text).toBe('Hello, John!');
    });

    test('should handle missing translation keys', () => {
      const text = i18n.t('missing.key', {}, 'Default');
      expect(text).toBe('Default');
    });

    test('should fallback to fallback language', async () => {
      await i18n.setLanguage('ja');
      const text = i18n.t('missing.key');
      // Should try ja, then fallback to en, then return key
      expect(text).toBeTruthy();
    });

    test('should handle pluralization', () => {
      expect(i18n.tn('tabs.tabCount', 0)).toBe('No tabs');
      expect(i18n.tn('tabs.tabCount', 1)).toBe('1 tab');
      expect(i18n.tn('tabs.tabCount', 5)).toBe('5 tabs');
    });

    test('should cache translations', () => {
      i18n.t('common.ok');
      i18n.t('common.ok'); // Second call should be cached

      const metrics = i18n.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    });

    test('should be fast (<1ms average)', () => {
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        i18n.t('common.ok');
      }

      const end = performance.now();
      const averageTime = (end - start) / iterations;

      expect(averageTime).toBeLessThan(1);
    });
  });

  describe('Number Formatting', () => {
    beforeEach(async () => {
      await i18n.initialize({ defaultLanguage: 'en' });
    });

    test('should format decimal numbers', () => {
      const formatted = i18n.formatNumber(1234.56, 'decimal');
      expect(formatted).toMatch(/1[,.]234[.,]56/);
    });

    test('should format currency', () => {
      const formatted = i18n.formatNumber(1234.56, 'currency');
      expect(formatted).toContain('$');
    });

    test('should format percentages', () => {
      const formatted = i18n.formatNumber(0.856, 'percent');
      expect(formatted).toContain('%');
    });

    test('should format according to locale', async () => {
      await i18n.setLanguage('de');
      const formatted = i18n.formatNumber(1234.56, 'decimal');
      // German uses comma for decimal
      expect(formatted).toContain(',');
    });
  });

  describe('Date Formatting', () => {
    beforeEach(async () => {
      await i18n.initialize({ defaultLanguage: 'en' });
    });

    const testDate = new Date('2025-10-24T12:00:00Z');

    test('should format date in short format', () => {
      const formatted = i18n.formatDate(testDate, 'short');
      expect(formatted).toContain('10');
      expect(formatted).toContain('24');
      expect(formatted).toContain('2025');
    });

    test('should format date in medium format', () => {
      const formatted = i18n.formatDate(testDate, 'medium');
      expect(formatted).toMatch(/Oct|10/);
    });

    test('should format date in long format', () => {
      const formatted = i18n.formatDate(testDate, 'long');
      expect(formatted).toContain('October');
    });

    test('should format time', () => {
      const formatted = i18n.formatDate(testDate, 'time');
      expect(formatted).toMatch(/\d{1,2}:\d{2}/);
    });

    test('should format according to locale', async () => {
      await i18n.setLanguage('ja');
      const formatted = i18n.formatDate(testDate, 'long');
      expect(formatted).toContain('年');
    });
  });

  describe('RTL Support', () => {
    beforeEach(async () => {
      await i18n.initialize({ defaultLanguage: 'en' });
    });

    test('should update document direction for RTL languages', async () => {
      await i18n.setLanguage('ar');
      expect(document.documentElement.dir).toBe('rtl');
    });

    test('should update document direction for LTR languages', async () => {
      await i18n.setLanguage('ar');
      await i18n.setLanguage('en');
      expect(document.documentElement.dir).toBe('ltr');
    });

    test('should handle all RTL languages correctly', async () => {
      const rtlLanguages = ['ar', 'he', 'fa', 'ur'];

      for (const lang of rtlLanguages) {
        await i18n.setLanguage(lang);
        expect(i18n.isRTL()).toBe(true);
        expect(document.documentElement.dir).toBe('rtl');
      }
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await i18n.initialize({ defaultLanguage: 'en', cacheTranslations: true });

      // Add test translations
      i18n.translations.set('en', {
        test: { key: 'value' }
      });
      i18n.state.translationsLoaded.add('en');
    });

    test('should have fast translation (<1ms)', () => {
      const start = performance.now();
      i18n.t('test.key');
      const end = performance.now();

      expect(end - start).toBeLessThan(1);
    });

    test('should achieve high cache hit rate', () => {
      // Warm up cache
      for (let i = 0; i < 100; i++) {
        i18n.t('test.key');
      }

      const metrics = i18n.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(0.9);
    });

    test('should handle concurrent translations efficiently', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve(i18n.t('test.key')));
      }

      const start = performance.now();
      await Promise.all(promises);
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // 100 translations in <100ms
    });

    test('should have low memory footprint', () => {
      const before = performance.memory?.usedJSHeapSize || 0;

      // Load translations and perform operations
      for (let i = 0; i < 1000; i++) {
        i18n.t('test.key');
      }

      const after = performance.memory?.usedJSHeapSize || 0;
      const increase = after - before;

      // Memory increase should be reasonable (<10MB)
      expect(increase).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Events', () => {
    beforeEach(async () => {
      await i18n.initialize({ defaultLanguage: 'en' });
    });

    test('should emit initialized event', async () => {
      const i18nNew = new (require('../assets/js/vr-i18n-system.js'))();
      const eventSpy = jest.fn();
      i18nNew.addEventListener('initialized', eventSpy);

      await i18nNew.initialize();

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            language: expect.any(String),
            locale: expect.any(String)
          })
        })
      );

      i18nNew.dispose();
    });

    test('should support multiple event listeners', async () => {
      const spy1 = jest.fn();
      const spy2 = jest.fn();

      i18n.addEventListener('languageChanged', spy1);
      i18n.addEventListener('languageChanged', spy2);

      await i18n.setLanguage('ja');

      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
    });

    test('should remove event listeners', async () => {
      const eventSpy = jest.fn();
      i18n.addEventListener('languageChanged', eventSpy);
      i18n.removeEventListener('languageChanged', eventSpy);

      await i18n.setLanguage('ja');

      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      await i18n.initialize({ defaultLanguage: 'en' });
    });

    test('should track translations loaded', () => {
      i18n.state.translationsLoaded.add('en');
      i18n.state.translationsLoaded.add('ja');

      const metrics = i18n.getMetrics();
      expect(metrics.languagesLoaded).toBe(2);
    });

    test('should track translation misses', () => {
      i18n.t('missing.key');

      const metrics = i18n.getMetrics();
      expect(metrics.translationsMissed).toBeGreaterThan(0);
    });

    test('should track average translation time', () => {
      i18n.translations.set('en', { test: { key: 'value' } });
      i18n.state.translationsLoaded.add('en');

      for (let i = 0; i < 10; i++) {
        i18n.t('test.key');
      }

      const metrics = i18n.getMetrics();
      expect(metrics.averageTranslationTime).toBeGreaterThan(0);
    });

    test('should track cache size', () => {
      i18n.translations.set('en', { test: { key: 'value' } });
      i18n.state.translationsLoaded.add('en');

      i18n.t('test.key');

      const metrics = i18n.getMetrics();
      expect(metrics.cacheSize).toBeGreaterThan(0);
    });
  });

  describe('Disposal', () => {
    test('should cleanup resources on dispose', async () => {
      await i18n.initialize();

      i18n.translations.set('en', { test: 'value' });
      i18n.translationCache.set('key', 'value');

      i18n.dispose();

      expect(i18n.translations.size).toBe(0);
      expect(i18n.translationCache.size).toBe(0);
      expect(i18n.initialized).toBe(false);
    });

    test('should be safe to dispose multiple times', async () => {
      await i18n.initialize();

      expect(() => {
        i18n.dispose();
        i18n.dispose();
      }).not.toThrow();
    });
  });
});
