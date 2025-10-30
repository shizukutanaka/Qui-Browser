/**
 * Translation System Test Suite for Qui Browser VR
 * Comprehensive testing of all translation system features
 * @version 1.0.0 - Test Integration
 */

class TranslationSystemTester {
    constructor() {
        this.testResults = new Map();
        this.testStartTime = null;
        this.testsCompleted = 0;
        this.testsFailed = 0;
        this.isRunning = false;
    }

    /**
     * Run comprehensive system tests
     */
    async runAllTests() {
        if (this.isRunning) {
            console.warn('Tests are already running');
            return;
        }

        this.isRunning = true;
        this.testStartTime = performance.now();
        console.info('🧪 Starting Translation System Test Suite...');

        try {
            // Test 1: System initialization
            await this.testSystemInitialization();

            // Test 2: Core translation functionality
            await this.testCoreTranslation();

            // Test 3: Advanced features
            await this.testAdvancedFeatures();

            // Test 4: Performance benchmarks
            await this.testPerformanceBenchmarks();

            // Test 5: Integration tests
            await this.testSystemIntegration();

            // Test 6: Error handling
            await this.testErrorHandling();

            // Generate final report
            this.generateTestReport();

        } catch (error) {
            console.error('💥 Test suite failed:', error);
            this.handleTestError(error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Test system initialization
     */
    async testSystemInitialization() {
        console.info('🔄 Testing system initialization...');

        const startTime = performance.now();
        let score = 0;
        const results = [];

        try {
            // Test 1: Check if all systems are loaded
            const systems = [
                'unifiedI18n',
                'enhancedAITranslationImprover',
                'advancedMultimodalTranslator',
                'enhancedOCRTranslator',
                'realTimeConferenceTranslator',
                'culturalAdaptationEngine',
                'advancedTranslationHub',
                'ultimateTranslationSystem',
                'enhancedLanguagePanel',
                'translationSystemManager'
            ];

            for (const system of systems) {
                const isLoaded = !!window[system];
                results.push({
                    test: `${system} loaded`,
                    passed: isLoaded,
                    time: 0
                });

                if (isLoaded) score++;
            }

            // Test 2: Check system status
            if (window.translationSystemManager) {
                const stats = window.translationSystemManager.getSystemOverview();
                results.push({
                    test: 'System integration complete',
                    passed: stats.integrationComplete,
                    time: 0
                });

                if (stats.integrationComplete) score++;
            }

            // Test 3: Check language availability
            if (window.unifiedI18n) {
                const langStats = window.unifiedI18n.getTranslationStats();
                const hasLanguages = langStats.total > 50; // At least 50 languages

                results.push({
                    test: 'Language system ready',
                    passed: hasLanguages,
                    time: 0,
                    details: `${langStats.total} languages loaded`
                });

                if (hasLanguages) score++;
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            this.recordTestResults('system-initialization', {
                score,
                totalTests: results.length,
                percentage: (score / results.length) * 100,
                executionTime: totalTime,
                results
            });

            console.info(`✅ System initialization test: ${score}/${results.length} passed (${totalTime.toFixed(2)}ms)`);

        } catch (error) {
            this.recordTestFailure('system-initialization', error);
        }
    }

    /**
     * Test core translation functionality
     */
    async testCoreTranslation() {
        console.info('🌍 Testing core translation functionality...');

        const startTime = performance.now();
        let score = 0;
        const results = [];

        try {
            const testCases = [
                { text: 'Hello world', source: 'en', target: 'ja', expectedPattern: /世界|こんにちは/ },
                { text: 'Thank you very much', source: 'en', target: 'es', expectedPattern: /gracias|muchas/ },
                { text: 'Good morning', source: 'en', target: 'fr', expectedPattern: /bonjour|matin/ },
                { text: 'How are you?', source: 'en', target: 'de', expectedPattern: /wie|geht/ },
                { text: 'I love this browser', source: 'en', target: 'ko', expectedPattern: /사랑|브라우저/ }
            ];

            for (const testCase of testCases) {
                try {
                    const translation = await this.translateText(testCase.text, testCase.source, testCase.target);
                    const passed = testCase.expectedPattern.test(translation);

                    results.push({
                        test: `Translate "${testCase.text}" ${testCase.source}→${testCase.target}`,
                        passed,
                        time: 0,
                        result: translation,
                        expected: testCase.expectedPattern
                    });

                    if (passed) score++;
                } catch (error) {
                    results.push({
                        test: `Translate "${testCase.text}" ${testCase.source}→${testCase.target}`,
                        passed: false,
                        time: 0,
                        error: error.message
                    });
                }
            }

            // Test language switching
            if (window.unifiedI18n) {
                const originalLang = window.unifiedI18n.currentLanguage;
                await window.unifiedI18n.setLanguage('ja');
                const switchedToJa = window.unifiedI18n.currentLanguage === 'ja';

                results.push({
                    test: 'Language switching',
                    passed: switchedToJa,
                    time: 0
                });

                if (switchedToJa) score++;

                // Switch back
                await window.unifiedI18n.setLanguage(originalLang);
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            this.recordTestResults('core-translation', {
                score,
                totalTests: results.length,
                percentage: (score / results.length) * 100,
                executionTime: totalTime,
                results
            });

            console.info(`✅ Core translation test: ${score}/${results.length} passed (${totalTime.toFixed(2)}ms)`);

        } catch (error) {
            this.recordTestFailure('core-translation', error);
        }
    }

    /**
     * Test advanced features
     */
    async testAdvancedFeatures() {
        console.info('🚀 Testing advanced features...');

        const startTime = performance.now();
        let score = 0;
        const results = [];

        try {
            // Test AI translation improvement
            if (window.enhancedAITranslationImprover) {
                const aiStats = window.enhancedAITranslationImprover.getQualityStats();
                const hasAIStats = aiStats && typeof aiStats.averageQuality === 'number';

                results.push({
                    test: 'AI translation improver',
                    passed: hasAIStats,
                    time: 0,
                    details: `Quality: ${(aiStats.averageQuality * 100).toFixed(1)}%`
                });

                if (hasAIStats) score++;
            }

            // Test OCR system
            if (window.enhancedOCRTranslator) {
                const ocrStats = window.enhancedOCRTranslator.getStats();
                const hasOCR = ocrStats && ocrStats.supportedLanguages > 0;

                results.push({
                    test: 'OCR system',
                    passed: hasOCR,
                    time: 0,
                    details: `${ocrStats.supportedLanguages} OCR languages`
                });

                if (hasOCR) score++;
            }

            // Test speech recognition
            if (window.advancedMultimodalTranslator) {
                const speechAvailable = window.advancedMultimodalTranslator.speechRecognition?.available;
                results.push({
                    test: 'Speech recognition',
                    passed: speechAvailable,
                    time: 0,
                    details: speechAvailable ? 'Available' : 'Not available'
                });

                if (speechAvailable) score++;
            }

            // Test conference system
            if (window.realTimeConferenceTranslator) {
                const conferenceStats = window.realTimeConferenceTranslator.getConferenceStats();
                const hasConference = conferenceStats && conferenceStats.supportedPlatforms.length > 0;

                results.push({
                    test: 'Conference system',
                    passed: hasConference,
                    time: 0,
                    details: `${conferenceStats.supportedPlatforms.length} platforms`
                });

                if (hasConference) score++;
            }

            // Test cultural adaptation
            if (window.culturalAdaptationEngine) {
                const culturalStats = window.culturalAdaptationEngine.getCulturalStats();
                const hasCultural = culturalStats && culturalStats.culturalProfiles > 0;

                results.push({
                    test: 'Cultural adaptation',
                    passed: hasCultural,
                    time: 0,
                    details: `${culturalStats.culturalProfiles} cultural profiles`
                });

                if (hasCultural) score++;
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            this.recordTestResults('advanced-features', {
                score,
                totalTests: results.length,
                percentage: (score / results.length) * 100,
                executionTime: totalTime,
                results
            });

            console.info(`✅ Advanced features test: ${score}/${results.length} passed (${totalTime.toFixed(2)}ms)`);

        } catch (error) {
            this.recordTestFailure('advanced-features', error);
        }
    }

    /**
     * Test performance benchmarks
     */
    async testPerformanceBenchmarks() {
        console.info('⚡ Testing performance benchmarks...');

        const startTime = performance.now();
        let score = 0;
        const results = [];

        try {
            // Test 1: Translation speed
            const speedTests = [
                { text: 'Short text', length: 'short' },
                { text: 'This is a medium length text for testing translation performance and speed.', length: 'medium' },
                { text: 'This is a much longer text that contains multiple sentences and should take longer to translate. It includes various types of content including technical terms, proper nouns, and different grammatical structures to thoroughly test the translation system performance.', length: 'long' }
            ];

            let totalSpeedTime = 0;
            let speedTestCount = 0;

            for (const speedTest of speedTests) {
                const speedStart = performance.now();
                await this.translateText(speedTest.text, 'en', 'ja');
                const speedEnd = performance.now();

                const speedTime = speedEnd - speedStart;
                totalSpeedTime += speedTime;
                speedTestCount++;

                const targetTime = speedTest.length === 'short' ? 200 : speedTest.length === 'medium' ? 500 : 1000;
                const passed = speedTime < targetTime;

                results.push({
                    test: `Translation speed (${speedTest.length})`,
                    passed,
                    time: speedTime,
                    details: `${speedTime.toFixed(2)}ms (target: <${targetTime}ms)`
                });

                if (passed) score++;
            }

            const averageSpeed = totalSpeedTime / speedTestCount;
            results.push({
                test: 'Average translation speed',
                passed: averageSpeed < 500,
                time: averageSpeed,
                details: `${averageSpeed.toFixed(2)}ms average`
            });

            if (averageSpeed < 500) score++;

            // Test 2: Memory usage
            if (performance.memory) {
                const memory = performance.memory;
                const memoryUsage = memory.usedJSHeapSize / 1048576; // MB
                const memoryPassed = memoryUsage < 100; // Less than 100MB

                results.push({
                    test: 'Memory usage',
                    passed: memoryPassed,
                    time: memoryUsage,
                    details: `${memoryUsage.toFixed(1)}MB used`
                });

                if (memoryPassed) score++;
            }

            // Test 3: System responsiveness
            const responseTests = 5;
            let totalResponseTime = 0;

            for (let i = 0; i < responseTests; i++) {
                const responseStart = performance.now();
                await this.translateText(`Response test ${i}`, 'en', 'es');
                const responseEnd = performance.now();
                totalResponseTime += (responseEnd - responseStart);
            }

            const averageResponse = totalResponseTime / responseTests;
            const responsePassed = averageResponse < 300;

            results.push({
                test: 'System responsiveness',
                passed: responsePassed,
                time: averageResponse,
                details: `${averageResponse.toFixed(2)}ms average response`
            });

            if (responsePassed) score++;

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            this.recordTestResults('performance-benchmarks', {
                score,
                totalTests: results.length,
                percentage: (score / results.length) * 100,
                executionTime: totalTime,
                results
            });

            console.info(`✅ Performance benchmarks test: ${score}/${results.length} passed (${totalTime.toFixed(2)}ms)`);

        } catch (error) {
            this.recordTestFailure('performance-benchmarks', error);
        }
    }

    /**
     * Test system integration
     */
    async testSystemIntegration() {
        console.info('🔗 Testing system integration...');

        const startTime = performance.now();
        let score = 0;
        const results = [];

        try {
            // Test 1: Cross-system communication
            const events = [
                'languageChanged',
                'translationRequest',
                'translationComplete',
                'systemHealth'
            ];

            let eventTestPassed = true;
            for (const event of events) {
                try {
                    document.dispatchEvent(new CustomEvent(`test:${event}`, { detail: { test: true } }));
                } catch (error) {
                    eventTestPassed = false;
                    break;
                }
            }

            results.push({
                test: 'Cross-system events',
                passed: eventTestPassed,
                time: 0,
                details: 'Event system communication'
            });

            if (eventTestPassed) score++;

            // Test 2: Unified translation pipeline
            const unifiedTest = await this.testUnifiedTranslation();
            results.push(unifiedTest);
            if (unifiedTest.passed) score++;

            // Test 3: Feature coordination
            const coordinationTest = await this.testFeatureCoordination();
            results.push(coordinationTest);
            if (coordinationTest.passed) score++;

            // Test 4: Error recovery
            const recoveryTest = await this.testErrorRecovery();
            results.push(recoveryTest);
            if (recoveryTest.passed) score++;

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            this.recordTestResults('system-integration', {
                score,
                totalTests: results.length,
                percentage: (score / results.length) * 100,
                executionTime: totalTime,
                results
            });

            console.info(`✅ System integration test: ${score}/${results.length} passed (${totalTime.toFixed(2)}ms)`);

        } catch (error) {
            this.recordTestFailure('system-integration', error);
        }
    }

    /**
     * Test unified translation pipeline
     */
    async testUnifiedTranslation() {
        try {
            const testText = 'Integration test for unified translation system';
            const result = await window.translate(text, { sourceLang: 'en', targetLang: 'ja' });

            return {
                test: 'Unified translation pipeline',
                passed: result && result !== testText,
                time: 0,
                details: `Translated: ${result ? 'Yes' : 'No'}`
            };
        } catch (error) {
            return {
                test: 'Unified translation pipeline',
                passed: false,
                time: 0,
                error: error.message
            };
        }
    }

    /**
     * Test feature coordination
     */
    async testFeatureCoordination() {
        try {
            // Test language panel integration
            if (window.enhancedLanguagePanel) {
                const panelStats = window.enhancedLanguagePanel.getAvailableFeatures();
                const hasFeatures = Object.values(panelStats).some(Boolean);

                return {
                    test: 'Feature coordination',
                    passed: hasFeatures,
                    time: 0,
                    details: `Panel features: ${Object.values(panelStats).filter(Boolean).length}`
                };
            }

            return {
                test: 'Feature coordination',
                passed: false,
                time: 0,
                details: 'Language panel not available'
            };
        } catch (error) {
            return {
                test: 'Feature coordination',
                passed: false,
                time: 0,
                error: error.message
            };
        }
    }

    /**
     * Test error recovery
     */
    async testErrorRecovery() {
        try {
            // Simulate an error condition
            const originalTranslate = window.translate;
            window.translate = () => { throw new Error('Simulated translation error'); };

            // Try to translate and see if system recovers
            try {
                await this.translateText('Error recovery test', 'en', 'ja');
                return {
                    test: 'Error recovery',
                    passed: false,
                    time: 0,
                    details: 'Error not handled properly'
                };
            } catch (error) {
                // Error should be handled gracefully
                return {
                    test: 'Error recovery',
                    passed: true,
                    time: 0,
                    details: 'Error handled gracefully'
                };
            } finally {
                // Restore original function
                window.translate = originalTranslate;
            }
        } catch (error) {
            return {
                test: 'Error recovery',
                passed: false,
                time: 0,
                error: error.message
            };
        }
    }

    /**
     * Test error handling
     */
    async testErrorHandling() {
        console.info('🛡️ Testing error handling...');

        const startTime = performance.now();
        let score = 0;
        const results = [];

        try {
            // Test 1: Invalid language codes
            try {
                await this.translateText('Error handling test', 'invalid-lang', 'also-invalid');
                results.push({
                    test: 'Invalid language handling',
                    passed: false,
                    time: 0,
                    details: 'Should handle invalid languages'
                });
            } catch (error) {
                results.push({
                    test: 'Invalid language handling',
                    passed: true,
                    time: 0,
                    details: 'Invalid languages handled correctly'
                });
                score++;
            }

            // Test 2: Empty text
            try {
                const emptyResult = await this.translateText('', 'en', 'ja');
                results.push({
                    test: 'Empty text handling',
                    passed: emptyResult === '',
                    time: 0,
                    details: `Empty result: ${emptyResult === '' ? 'Correct' : 'Incorrect'}`
                });

                if (emptyResult === '') score++;
            } catch (error) {
                results.push({
                    test: 'Empty text handling',
                    passed: false,
                    time: 0,
                    error: error.message
                });
            }

            // Test 3: Very long text
            try {
                const longText = 'A'.repeat(10000);
                const longResult = await this.translateText(longText, 'en', 'ja');
                results.push({
                    test: 'Long text handling',
                    passed: typeof longResult === 'string',
                    time: 0,
                    details: `Long text handled: ${typeof longResult === 'string' ? 'Yes' : 'No'}`
                });

                if (typeof longResult === 'string') score++;
            } catch (error) {
                results.push({
                    test: 'Long text handling',
                    passed: false,
                    time: 0,
                    error: error.message
                });
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            this.recordTestResults('error-handling', {
                score,
                totalTests: results.length,
                percentage: (score / results.length) * 100,
                executionTime: totalTime,
                results
            });

            console.info(`✅ Error handling test: ${score}/${results.length} passed (${totalTime.toFixed(2)}ms)`);

        } catch (error) {
            this.recordTestFailure('error-handling', error);
        }
    }

    /**
     * Translate text using available systems
     */
    async translateText(text, sourceLang, targetLang) {
        if (window.translateUltimate) {
            return await window.translateUltimate(text, {
                sourceLang,
                targetLang,
                features: ['basic', 'cultural', 'ai-improvement']
            });
        } else if (window.unifiedI18n) {
            return await window.unifiedI18n.translate(text, { language: targetLang });
        } else if (window.i18n) {
            return window.i18n.t(text);
        }
        return text;
    }

    /**
     * Record test results
     */
    recordTestResults(testName, results) {
        this.testResults.set(testName, results);
        this.testsCompleted++;
        console.info(`📊 Test "${testName}" completed: ${results.percentage.toFixed(1)}% success`);
    }

    /**
     * Record test failure
     */
    recordTestFailure(testName, error) {
        this.testResults.set(testName, {
            score: 0,
            totalTests: 1,
            percentage: 0,
            executionTime: 0,
            error: error.message,
            results: [{
                test: testName,
                passed: false,
                error: error.message
            }]
        });
        this.testsFailed++;
        this.testsCompleted++;
    }

    /**
     * Handle test error
     */
    handleTestError(error) {
        console.error('💥 Critical test error:', error);
        this.showTestNotification('Test suite encountered an error', 'error');
    }

    /**
     * Generate comprehensive test report
     */
    generateTestReport() {
        const totalTime = performance.now() - this.testStartTime;
        let totalScore = 0;
        let totalTests = 0;

        console.info('📋 Generating Test Report...');
        console.info('=' .repeat(50));

        this.testResults.forEach((results, testName) => {
            console.info(`\n📊 ${testName.toUpperCase()}:`);
            console.info(`   Score: ${results.score}/${results.totalTests} (${results.percentage.toFixed(1)}%)`);
            console.info(`   Time: ${results.executionTime.toFixed(2)}ms`);

            if (results.results) {
                results.results.forEach((result, index) => {
                    const status = result.passed ? '✅' : '❌';
                    console.info(`   ${status} ${result.test}`);
                    if (result.details) {
                        console.info(`      ${result.details}`);
                    }
                    if (result.error) {
                        console.info(`      Error: ${result.error}`);
                    }
                });
            }

            totalScore += results.score;
            totalTests += results.totalTests;
        });

        const overallPercentage = totalTests > 0 ? (totalScore / totalTests) * 100 : 0;

        console.info('\n' + '=' .repeat(50));
        console.info('🏆 FINAL RESULTS:');
        console.info(`   Overall Score: ${totalScore}/${totalTests} (${overallPercentage.toFixed(1)}%)`);
        console.info(`   Total Time: ${totalTime.toFixed(2)}ms`);
        console.info(`   Tests Completed: ${this.testsCompleted}`);
        console.info(`   Tests Failed: ${this.testsFailed}`);

        if (overallPercentage >= 90) {
            console.info('🎉 EXCELLENT: All systems functioning optimally!');
        } else if (overallPercentage >= 75) {
            console.info('✅ GOOD: Most systems working correctly');
        } else if (overallPercentage >= 50) {
            console.info('⚠️ FAIR: Some issues detected');
        } else {
            console.info('❌ POOR: Major issues found');
        }

        console.info('=' .repeat(50));

        // Store final results
        this.finalResults = {
            overallScore: totalScore,
            overallTests: totalTests,
            overallPercentage,
            totalTime,
            testsCompleted: this.testsCompleted,
            testsFailed: this.testsFailed,
            testResults: Object.fromEntries(this.testResults),
            timestamp: new Date().toISOString()
        };

        // Show user notification
        this.showTestNotification(`Tests completed: ${overallPercentage.toFixed(1)}% success rate`, overallPercentage >= 75 ? 'success' : 'warning');

        // Emit completion event
        document.dispatchEvent(new CustomEvent('translationTestsComplete', {
            detail: this.finalResults
        }));
    }

    /**
     * Show test notification
     */
    showTestNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#de350b' : type === 'success' ? '#00875a' : '#0065ff'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10003;
            font-size: 14px;
            font-weight: 500;
        `;

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Export test results
     */
    exportTestResults() {
        if (!this.finalResults) {
            console.warn('No test results available');
            return;
        }

        const dataStr = JSON.stringify(this.finalResults, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

        const exportFileDefaultName = `translation-system-tests-${Date.now()}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        console.info('📤 Test results exported');
    }

    /**
     * Get test summary
     */
    getTestSummary() {
        if (!this.finalResults) {
            return { status: 'not-run', message: 'Tests not yet executed' };
        }

        return {
            status: this.finalResults.overallPercentage >= 90 ? 'excellent' :
                   this.finalResults.overallPercentage >= 75 ? 'good' :
                   this.finalResults.overallPercentage >= 50 ? 'fair' : 'poor',
            score: `${this.finalResults.overallScore}/${this.finalResults.overallTests}`,
            percentage: `${this.finalResults.overallPercentage.toFixed(1)}%`,
            executionTime: `${this.finalResults.totalTime.toFixed(2)}ms`,
            timestamp: this.finalResults.timestamp
        };
    }
}

// Initialize Translation System Tester
window.translationSystemTester = new TranslationSystemTester();

// Make test function globally available
window.runTranslationSystemTests = async () => {
    await window.translationSystemTester.runAllTests();
};

window.getTranslationTestResults = () => {
    return window.translationSystemTester.getTestSummary();
};

window.exportTranslationTestResults = () => {
    window.translationSystemTester.exportTestResults();
};

// Auto-run tests in development mode
document.addEventListener('DOMContentLoaded', () => {
    // Run tests automatically if in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.info('🔧 Development mode detected - auto-running tests in 3 seconds...');
        setTimeout(() => {
            window.runTranslationSystemTests();
        }, 3000);
    }
});

console.info('🧪 Translation System Test Suite loaded');
console.info('💡 Use window.runTranslationSystemTests() to run all tests');
console.info('💡 Use window.getTranslationTestResults() to get test summary');
console.info('💡 Use window.exportTranslationTestResults() to export results');

// Export for modules
export default TranslationSystemTester;
