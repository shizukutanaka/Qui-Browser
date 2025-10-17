const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  AnalyticsEvent,
  UserSession,
  AnalyticsFunnel,
  ABTest,
  AnalyticsTracker
} = require('../utils/analytics');
const {
  PerformanceMonitor,
  NetworkInspector,
  ConsoleManager,
  MemoryProfiler,
  DevTools
} = require('../utils/devtools');
const {
  ARIAValidator,
  AccessibilityChecker,
  ScreenReaderAnnouncer,
  KeyboardNavigationManager,
  AccessibilityManager
} = require('../utils/accessibility');

describe('Advanced Analytics', () => {
  it('should create analytics event', () => {
    const event = new AnalyticsEvent('page_view', { url: '/test' });

    assert.ok(event.id);
    assert.strictEqual(event.name, 'page_view');
    assert.strictEqual(event.properties.url, '/test');
    assert.ok(event.timestamp);
  });

  it('should convert event to JSON', () => {
    const event = new AnalyticsEvent('click', { button: 'submit' });
    const json = event.toJSON();

    assert.strictEqual(json.name, 'click');
    assert.strictEqual(json.properties.button, 'submit');
  });

  it('should create user session', () => {
    const session = new UserSession('session-123', { userId: 'user-1' });

    assert.strictEqual(session.sessionId, 'session-123');
    assert.strictEqual(session.userId, 'user-1');
    assert.ok(session.active);
  });

  it('should add event to session', () => {
    const session = new UserSession('session-1');
    const event = new AnalyticsEvent('click', {});

    session.addEvent(event);

    assert.strictEqual(session.events.length, 1);
    assert.strictEqual(session.events[0], event);
  });

  it('should track page views in session', () => {
    const session = new UserSession('session-1');

    session.addPageView('/home', 'Home Page');
    session.addPageView('/about', 'About Page', '/home');

    assert.strictEqual(session.pageViews.length, 2);
    assert.strictEqual(session.pageViews[0].url, '/home');
    assert.strictEqual(session.pageViews[1].referrer, '/home');
  });

  it('should calculate session duration', () => {
    const startTime = Date.now() - 5000;
    const session = new UserSession('session-1', { startTime });

    // Update last activity time to simulate activity
    session.lastActivityTime = Date.now();

    const duration = session.getDuration();

    assert.ok(duration >= 4900); // Allow for small timing variance
  });

  it('should detect expired session', () => {
    const session = new UserSession('session-1', { startTime: Date.now() - 2000000 });

    assert.ok(session.isExpired(1800000)); // 30 minutes timeout
  });

  it('should create analytics funnel', () => {
    const funnel = new AnalyticsFunnel('signup', ['landing', 'form', 'verify', 'complete']);

    assert.strictEqual(funnel.name, 'signup');
    assert.strictEqual(funnel.steps.length, 4);
  });

  it('should track funnel steps', () => {
    const funnel = new AnalyticsFunnel('checkout', ['cart', 'shipping', 'payment', 'confirm']);

    funnel.trackStep('session-1', 'cart');
    funnel.trackStep('session-1', 'shipping');

    const progress = funnel.data.get('session-1');
    assert.strictEqual(progress.steps.length, 2);
  });

  it('should calculate conversion rate', () => {
    const funnel = new AnalyticsFunnel('conversion', ['step1', 'step2', 'step3']);

    funnel.trackStep('session-1', 'step1');
    funnel.trackStep('session-1', 'step2');
    funnel.trackStep('session-1', 'step3'); // Complete

    funnel.trackStep('session-2', 'step1');
    funnel.trackStep('session-2', 'step2'); // Incomplete

    const rate = funnel.getConversionRate();
    assert.strictEqual(rate, 0.5); // 1 out of 2 completed
  });

  it('should create A/B test', () => {
    const test = new ABTest('button-color', ['red', 'blue', 'green']);

    assert.strictEqual(test.name, 'button-color');
    assert.strictEqual(test.variants.length, 3);
  });

  it('should assign variant to user', () => {
    const test = new ABTest('test-1', ['A', 'B']);

    const variant1 = test.assignVariant('user-1');
    const variant2 = test.assignVariant('user-1'); // Same user

    assert.ok(['A', 'B'].includes(variant1));
    assert.strictEqual(variant1, variant2); // Consistent assignment
  });

  it('should track A/B test conversion', () => {
    const test = new ABTest('test-1', ['A', 'B']);

    const variant = test.assignVariant('user-1');
    test.trackConversion('user-1', 100);

    const stats = test.getVariantStats(variant);
    assert.strictEqual(stats.conversions, 1);
    assert.strictEqual(stats.revenue, 100);
  });

  it('should create analytics tracker', () => {
    const tracker = new AnalyticsTracker();

    assert.ok(tracker);
    assert.strictEqual(tracker.events.length, 0);

    tracker.destroy();
  });

  it('should track event with tracker', () => {
    const tracker = new AnalyticsTracker({ flushInterval: 0 });

    const event = tracker.track('test-event', { foo: 'bar' });

    assert.strictEqual(event.name, 'test-event');
    assert.strictEqual(tracker.events.length, 1);

    tracker.destroy();
  });

  it('should track page view with tracker', () => {
    const tracker = new AnalyticsTracker({ flushInterval: 0 });

    tracker.trackPageView('/test', 'Test Page', { sessionId: 'session-1' });

    assert.strictEqual(tracker.metrics.pageViews, 1);
    assert.strictEqual(tracker.events.length, 1);

    tracker.destroy();
  });

  it('should create and manage sessions', () => {
    const tracker = new AnalyticsTracker({ flushInterval: 0 });

    const session = tracker.getSession('session-1', { userId: 'user-1' });

    assert.strictEqual(session.sessionId, 'session-1');
    assert.ok(tracker.sessions.has('session-1'));

    tracker.destroy();
  });

  it('should flush events in batches', () => {
    const tracker = new AnalyticsTracker({ batchSize: 2, flushInterval: 0 });

    tracker.track('event-1');
    tracker.track('event-2');

    assert.strictEqual(tracker.events.length, 0); // Auto-flushed

    tracker.destroy();
  });
});

describe('Developer Tools', () => {
  it('should create performance monitor', () => {
    const monitor = new PerformanceMonitor({ enableUserTiming: true });

    assert.ok(monitor);
    assert.strictEqual(monitor.measurements.length, 0);

    monitor.destroy();
  });

  it('should mark performance point', () => {
    const monitor = new PerformanceMonitor();

    monitor.mark('start');

    assert.ok(monitor.marks.has('start'));

    monitor.destroy();
  });

  it('should measure between marks', () => {
    const monitor = new PerformanceMonitor();

    monitor.mark('start');
    monitor.mark('end');

    const measurement = monitor.measure('test', 'start', 'end');

    assert.ok(measurement);
    assert.strictEqual(measurement.name, 'test');
    assert.ok(measurement.duration >= 0);

    monitor.destroy();
  });

  it('should track async function', async () => {
    const monitor = new PerformanceMonitor();

    const asyncFn = async () => {
      return new Promise((resolve) => setTimeout(() => resolve('done'), 10));
    };

    const result = await monitor.trackAsync('async-test', asyncFn);

    assert.strictEqual(result, 'done');

    monitor.destroy();
  });

  it('should track sync function', () => {
    const monitor = new PerformanceMonitor();

    const syncFn = () => 'result';

    const result = monitor.track('sync-test', syncFn);

    assert.strictEqual(result, 'result');

    monitor.destroy();
  });

  it('should create network inspector', () => {
    const inspector = new NetworkInspector();

    assert.ok(inspector);
    assert.strictEqual(inspector.requests.length, 0);
  });

  it('should track network request', () => {
    const inspector = new NetworkInspector();

    const request = inspector.startRequest('req-1', {
      method: 'GET',
      url: '/api/test'
    });

    assert.strictEqual(request.method, 'GET');
    assert.strictEqual(request.url, '/api/test');
    assert.strictEqual(request.status, 'pending');
  });

  it('should complete network request', () => {
    const inspector = new NetworkInspector();

    inspector.startRequest('req-1', { method: 'GET', url: '/api/test' });

    const completed = inspector.endRequest('req-1', {
      statusCode: 200,
      size: 1024
    });

    assert.strictEqual(completed.statusCode, 200);
    assert.ok(completed.duration >= 0);
  });

  it('should create console manager', () => {
    const consoleManager = new ConsoleManager({ captureStackTraces: false });

    assert.ok(consoleManager);
    assert.strictEqual(consoleManager.logs.length, 0);

    consoleManager.restore();
  });

  it('should track console count', () => {
    const consoleManager = new ConsoleManager();

    const count1 = consoleManager.count('test');
    const count2 = consoleManager.count('test');

    assert.strictEqual(count1, 1);
    assert.strictEqual(count2, 2);

    consoleManager.restore();
  });

  it('should track console timer', () => {
    const consoleManager = new ConsoleManager();

    consoleManager.time('test');

    setTimeout(() => {
      const duration = consoleManager.timeEnd('test');
      assert.ok(duration >= 0);
    }, 10);

    consoleManager.restore();
  });

  it('should create memory profiler', () => {
    const profiler = new MemoryProfiler();

    assert.ok(profiler);
    assert.strictEqual(profiler.samples.length, 0);

    profiler.destroy();
  });

  it('should take memory snapshot', () => {
    const profiler = new MemoryProfiler();

    const snapshot = profiler.snapshot();

    assert.ok(snapshot.heapUsed > 0);
    assert.ok(snapshot.heapTotal > 0);
    assert.strictEqual(profiler.samples.length, 1);

    profiler.destroy();
  });

  it('should detect memory trend', () => {
    const profiler = new MemoryProfiler();

    // Take multiple snapshots
    for (let i = 0; i < 5; i++) {
      profiler.snapshot();
    }

    const trend = profiler.getTrend();

    assert.ok(['stable', 'increasing', 'decreasing'].includes(trend));

    profiler.destroy();
  });

  it('should create DevTools', () => {
    const devtools = new DevTools();

    assert.ok(devtools.performance);
    assert.ok(devtools.network);
    assert.ok(devtools.console);
    assert.ok(devtools.memory);

    devtools.destroy();
  });

  it('should get all DevTools stats', () => {
    const devtools = new DevTools();

    const stats = devtools.getAllStats();

    assert.ok(stats.performance);
    assert.ok(stats.network);
    assert.ok(stats.console);
    assert.ok(stats.memory);

    devtools.destroy();
  });
});

describe('Accessibility', () => {
  it('should create ARIA validator', () => {
    const validator = new ARIAValidator();

    assert.ok(validator);
    assert.ok(validator.validRoles.size > 0);
  });

  it('should validate valid ARIA role', () => {
    const validator = new ARIAValidator();

    const result = validator.validateRole('button');

    assert.strictEqual(result.valid, true);
  });

  it('should invalidate invalid ARIA role', () => {
    const validator = new ARIAValidator();

    const result = validator.validateRole('invalid-role');

    assert.strictEqual(result.valid, false);
    assert.ok(result.invalidRoles.includes('invalid-role'));
  });

  it('should validate ARIA attribute', () => {
    const validator = new ARIAValidator();

    assert.strictEqual(validator.validateAttribute('aria-label'), true);
    assert.strictEqual(validator.validateAttribute('aria-invalid-attr'), false);
  });

  it('should validate element with valid ARIA', () => {
    const validator = new ARIAValidator();

    const result = validator.validateElement({
      role: 'button',
      'aria-label': 'Click me'
    });

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.issues.length, 0);
  });

  it('should create accessibility checker', () => {
    const checker = new AccessibilityChecker({ level: 'AA' });

    assert.ok(checker);
    assert.strictEqual(checker.config.level, 'AA');
  });

  it('should check color contrast', () => {
    const checker = new AccessibilityChecker({ level: 'AA' });

    // Black on white
    const result = checker.checkContrast([0, 0, 0], [255, 255, 255]);

    assert.ok(result.ratio > 20); // Very high contrast
    assert.strictEqual(result.passNormal, true);
    assert.strictEqual(result.passLarge, true);
  });

  it('should check element label', () => {
    const checker = new AccessibilityChecker();

    const hasLabel = checker.checkLabel({ 'aria-label': 'Test' });
    const noLabel = checker.checkLabel({});

    assert.strictEqual(hasLabel, true);
    assert.strictEqual(noLabel, false);
  });

  it('should get accessibility report', () => {
    const checker = new AccessibilityChecker();

    checker.checkLabel({}); // Should add issue

    const report = checker.getReport();

    assert.ok(report.totalIssues > 0);
    assert.strictEqual(report.level, 'AA');
  });

  it('should create screen reader announcer', () => {
    const announcer = new ScreenReaderAnnouncer();

    assert.ok(announcer);
    assert.strictEqual(announcer.announcements.length, 0);
  });

  it('should announce message', () => {
    const announcer = new ScreenReaderAnnouncer();

    const announcement = announcer.announce('Test message', 'polite');

    assert.strictEqual(announcement.message, 'Test message');
    assert.strictEqual(announcement.priority, 'polite');
    assert.strictEqual(announcer.announcements.length, 1);
  });

  it('should create keyboard navigation manager', () => {
    const keyboard = new KeyboardNavigationManager();

    assert.ok(keyboard);
    assert.strictEqual(keyboard.focusHistory.length, 0);
  });

  it('should track focus changes', () => {
    const keyboard = new KeyboardNavigationManager();

    keyboard.trackFocus('button-1');
    keyboard.trackFocus('button-2');

    assert.strictEqual(keyboard.focusHistory.length, 2);
  });

  it('should register keyboard shortcut', () => {
    const keyboard = new KeyboardNavigationManager();

    keyboard.registerShortcut('Ctrl+S', () => {}, 'Save');

    const shortcuts = keyboard.getShortcuts();
    assert.strictEqual(shortcuts.length, 1);
    assert.strictEqual(shortcuts[0].key, 'Ctrl+S');
  });

  it('should unregister keyboard shortcut', () => {
    const keyboard = new KeyboardNavigationManager();

    keyboard.registerShortcut('Ctrl+S', () => {}, 'Save');
    const removed = keyboard.unregisterShortcut('Ctrl+S');

    assert.strictEqual(removed, true);
    assert.strictEqual(keyboard.getShortcuts().length, 0);
  });

  it('should create accessibility manager', () => {
    const manager = new AccessibilityManager({ wcagLevel: 'AAA' });

    assert.ok(manager);
    assert.ok(manager.checker);
    assert.ok(manager.announcer);
    assert.ok(manager.keyboard);

    manager.destroy();
  });

  it('should get accessibility report from manager', () => {
    const manager = new AccessibilityManager();

    const report = manager.getReport();

    assert.ok(report.checker);
    assert.strictEqual(report.wcagLevel, 'AA');

    manager.destroy();
  });
});

console.log('All Phase 10 tests completed!');
