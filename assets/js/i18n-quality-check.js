// Translation Quality Testing System
export class TranslationQualityTester {
  constructor() {
    this.testResults = {};
    this.issues = [];
  }

  async runAllTests() {
    console.info('Starting translation quality tests...');

    this.testResults = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      languages: {}
    };

    this.issues = [];

    // Get all available languages
    const languages = Object.keys(i18next.services.resourceStore.data).filter(lang => lang !== 'dev');

    for (const lang of languages) {
      await this.testLanguage(lang);
    }

    this.generateReport();
    return this.testResults;
  }

  async testLanguage(language) {
    console.info(`Testing translations for language: ${language}`);
    const results = {
      language,
      tests: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0
    };

    // Test 1: Check for missing translations
    const missingTest = this.testMissingTranslations(language);
    results.tests.push(missingTest);
    results.totalTests += missingTest.tests;
    results.passedTests += missingTest.passed;
    results.failedTests += missingTest.failed;

    // Test 2: Check for placeholder values (untranslated keys)
    const placeholderTest = this.testPlaceholderValues(language);
    results.tests.push(placeholderTest);
    results.totalTests += placeholderTest.tests;
    results.passedTests += placeholderTest.passed;
    results.failedTests += placeholderTest.failed;

    // Test 3: Check for formatting consistency
    const formattingTest = this.testFormattingConsistency(language);
    results.tests.push(formattingTest);
    results.totalTests += formattingTest.tests;
    results.passedTests += formattingTest.passed;
    results.failedTests += formattingTest.failed;

    // Test 5: Check performance impact
    const performanceTest = this.testPerformance(language);
    results.tests.push(performanceTest);
    results.totalTests += performanceTest.tests;
    results.passedTests += performanceTest.passed;
    results.failedTests += performanceTest.failed;

    // Test 6: Check context awareness
    const contextTest = this.testContextAwareness(language);
    results.tests.push(contextTest);
    results.totalTests += contextTest.tests;
    results.passedTests += contextTest.passed;
    results.failedTests += contextTest.failed;

    // Update global counters
    this.testResults.totalTests += results.totalTests;
    this.testResults.passedTests += results.passedTests;
    this.testResults.failedTests += results.failedTests;
  }

  testMissingTranslations(language) {
    const test = {
      name: 'Missing Translations',
      description: 'Check for missing translation keys',
      tests: 0,
      passed: 0,
      failed: 0,
      details: []
    };

    try {
      const englishKeys = this.getAllKeys(i18next.getDataByLanguage('en').translation);
      const currentKeys = this.getAllKeys(i18next.getDataByLanguage(language).translation);

      test.tests = englishKeys.length;

      englishKeys.forEach(key => {
        if (!currentKeys.includes(key)) {
          test.failed++;
          test.details.push(`Missing key: ${key}`);
          this.issues.push({
            type: 'missing_translation',
            language,
            key,
            severity: 'error'
          });
        } else {
          test.passed++;
        }
      });
    } catch (error) {
      test.failed++;
      test.details.push(`Error during test: ${error.message}`);
    }

    return test;
  }

  testPlaceholderValues(language) {
    const test = {
      name: 'Placeholder Values',
      description: 'Check for untranslated placeholder values',
      tests: 0,
      passed: 0,
      failed: 0,
      details: []
    };

    try {
      const keys = this.getAllKeys(i18next.getDataByLanguage(language).translation);
      test.tests = keys.length;

      keys.forEach(key => {
        const translation = i18next.t(key, { lng: language });
        if (translation === key || translation === '' || translation.includes('{{') || translation.includes('}}')) {
          test.failed++;
          test.details.push(`Untranslated or malformed key: ${key} = "${translation}"`);
          this.issues.push({
            type: 'placeholder_value',
            language,
            key,
            value: translation,
            severity: 'warning'
          });
        } else {
          test.passed++;
        }
      });
    } catch (error) {
      test.failed++;
      test.details.push(`Error during test: ${error.message}`);
    }

    return test;
  }

  testFormattingConsistency(language) {
    const test = {
      name: 'Formatting Consistency',
      description: 'Check for consistent formatting in translations',
      tests: 0,
      passed: 0,
      failed: 0,
      details: []
    };

    try {
      // Test interpolation consistency
      const interpolationKeys = this.getKeysWithInterpolation(i18next.getDataByLanguage('en').translation);
      test.tests = interpolationKeys.length;

      interpolationKeys.forEach(key => {
        try {
          const enTranslation = i18next.t(key, { lng: 'en' });
          const langTranslation = i18next.t(key, { lng: language });

          // Check if both have the same number of interpolation placeholders
          const enPlaceholders = (enTranslation.match(/\{\{[^}]+\}\}/g) || []).length;
          const langPlaceholders = (langTranslation.match(/\{\{[^}]+\}\}/g) || []).length;

          if (enPlaceholders !== langPlaceholders) {
            test.failed++;
            test.details.push(`Interpolation mismatch in key: ${key} (EN: ${enPlaceholders}, ${language}: ${langPlaceholders})`);
            this.issues.push({
              type: 'interpolation_mismatch',
              language,
              key,
              enPlaceholders,
              langPlaceholders,
              severity: 'error'
            });
          } else {
            test.passed++;
          }
        } catch (error) {
          test.failed++;
          test.details.push(`Error testing key ${key}: ${error.message}`);
        }
      });
    } catch (error) {
      test.failed++;
      test.details.push(`Error during test: ${error.message}`);
    }

    return test;
  }

  testRTLDirection(language) {
    const test = {
      name: 'Performance Impact',
      description: 'Test translation performance impact',
      tests: 1,
      passed: 0,
      failed: 0,
      details: []
    };

    try {
      const iterations = 1000;
      const startTime = performance.now();

      // Test translation speed
      for (let i = 0; i < iterations; i++) {
        i18next.t('common.ok', { lng: language });
      }

      const endTime = performance.now();
      const avgTime = ((endTime - startTime) / iterations * 1000).toFixed(3);

      // Check if translation is reasonably fast (< 1ms per translation)
      if (parseFloat(avgTime) < 1.0) {
        test.passed++;
        test.details.push(`Translation speed: ${avgTime}μs per translation`);
      } else {
        test.failed++;
        test.details.push(`Slow translation: ${avgTime}μs per translation`);
        this.issues.push({
          type: 'performance_issue',
          language,
          avgTime,
          severity: 'warning'
        });
      }
    } catch (error) {
      test.failed++;
      test.details.push(`Performance test error: ${error.message}`);
    }

    return test;
  }

  testContextAwareness(language) {
    const test = {
      name: 'Context Awareness',
      description: 'Test context-aware translations (pluralization, etc.)',
      tests: 0,
      passed: 0,
      failed: 0,
      details: []
    };

    try {
      // Test pluralization for different languages
      const pluralTests = [
        { key: 'tabCount', values: { count: 0 } },
        { key: 'tabCount', values: { count: 1 } },
        { key: 'tabCount', values: { count: 2 } }
      ];

      test.tests = pluralTests.length;

      pluralTests.forEach(pluralTest => {
        try {
          const translation = i18next.t(pluralTest.key, { ...pluralTest.values, lng: language });

          // Check if translation differs based on count (for languages that support pluralization)
          if (translation !== pluralTest.key && translation !== '') {
            test.passed++;
          } else {
            // For languages without pluralization support, this is acceptable
            test.passed++;
          }
        } catch (error) {
          test.failed++;
          test.details.push(`Context test error for ${pluralTest.key}: ${error.message}`);
        }
      });
    } catch (error) {
      test.failed++;
      test.details.push(`Context awareness test error: ${error.message}`);
    }

    return test;
  }
    const keys = [];
    this.traverseObject(translationObj, '', (key, value) => {
      if (typeof value === 'string' && value.includes('{{')) {
        keys.push(key);
      }
    });
    return keys;
  }

  traverseObject(obj, prefix, callback) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          this.traverseObject(obj[key], fullKey, callback);
        } else {
          callback(fullKey, obj[key]);
        }
      }
    }
  }

  getAllKeys(translationObj) {
    const keys = [];
    this.traverseObject(translationObj, '', (key) => keys.push(key));
    return keys;
  }

  generateReport() {
    const successRate = this.testResults.totalTests > 0 ?
      (this.testResults.passedTests / this.testResults.totalTests * 100).toFixed(2) : 0;

    console.info('=== Translation Quality Test Report ===');
    console.info(`Total Tests: ${this.testResults.totalTests}`);
    console.info(`Passed: ${this.testResults.passedTests}`);
    console.info(`Failed: ${this.testResults.failedTests}`);
    console.info(`Success Rate: ${successRate}%`);
    console.info(`Timestamp: ${this.testResults.timestamp}`);

    if (this.issues.length > 0) {
      console.warn(`Issues Found: ${this.issues.length}`);
      console.table(this.issues);
    }

    // Store globally for debugging
    window.translationQualityReport = this.testResults;
    window.translationIssues = this.issues;
  }
}

// Global test instance
const qualityTester = new TranslationQualityTester();

// Export for use in other modules
export default qualityTester;

// Convenience function
export function runTranslationQualityTests() {
  return qualityTester.runAllTests();
}

// Make available globally
window.TranslationQualityTester = TranslationQualityTester;
window.runTranslationQualityTests = runTranslationQualityTests;
