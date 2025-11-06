/**
 * Production Monitoring Setup
 * Error tracking, performance monitoring, and analytics
 *
 * Integrations:
 * - Sentry (error tracking)
 * - Google Analytics 4 (user analytics)
 * - Web Vitals (performance)
 * - Custom metrics
 *
 * John Carmack principle: "You can't fix what you can't measure"
 */

// ============================================================================
// Configuration
// ============================================================================

const MONITORING_CONFIG = {
  // Enable in production only
  enabled: import.meta.env.PROD,

  // Sentry configuration
  sentry: {
    dsn: import.meta.env.VITE_SENTRY_DSN || '',
    environment: import.meta.env.MODE || 'production',
    tracesSampleRate: 0.1, // 10% of transactions
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0  // 100% when errors occur
  },

  // Google Analytics
  analytics: {
    measurementId: import.meta.env.VITE_GA_MEASUREMENT_ID || '',
    enabled: true
  },

  // Performance monitoring
  performance: {
    enabled: true,
    reportInterval: 60000, // Report every 60 seconds
    thresholds: {
      fcp: 1800,    // First Contentful Paint (ms)
      lcp: 2500,    // Largest Contentful Paint (ms)
      fid: 100,     // First Input Delay (ms)
      cls: 0.1,     // Cumulative Layout Shift
      ttfb: 600     // Time to First Byte (ms)
    }
  }
};

// ============================================================================
// Sentry Integration
// ============================================================================

/**
 * Initialize Sentry error tracking
 */
export async function initSentry() {
  if (!MONITORING_CONFIG.enabled || !MONITORING_CONFIG.sentry.dsn) {
    console.log('Sentry: Disabled (no DSN or not in production)');
    return null;
  }

  try {
    // Dynamic import to avoid loading in development
    const Sentry = await import('@sentry/browser');
    const { BrowserTracing } = await import('@sentry/tracing');
    const { Replay } = await import('@sentry/replay');

    Sentry.init({
      dsn: MONITORING_CONFIG.sentry.dsn,
      environment: MONITORING_CONFIG.sentry.environment,

      // Performance monitoring
      integrations: [
        new BrowserTracing({
          tracePropagationTargets: [location.origin, /^\/api\//],
        }),
        new Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],

      // Sampling rates
      tracesSampleRate: MONITORING_CONFIG.sentry.tracesSampleRate,
      replaysSessionSampleRate: MONITORING_CONFIG.sentry.replaysSessionSampleRate,
      replaysOnErrorSampleRate: MONITORING_CONFIG.sentry.replaysOnErrorSampleRate,

      // Before send hook (sanitize sensitive data)
      beforeSend(event, hint) {
        // Remove sensitive data
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers;
        }

        // Ignore specific errors
        const ignoredErrors = [
          'ResizeObserver loop limit exceeded',
          'Non-Error promise rejection captured',
          'ChunkLoadError'
        ];

        const errorMessage = event.exception?.values?.[0]?.value || '';
        if (ignoredErrors.some(msg => errorMessage.includes(msg))) {
          return null;
        }

        return event;
      },

      // Custom tags
      initialScope: {
        tags: {
          'app.version': import.meta.env.VITE_APP_VERSION || '2.0.0',
          'app.buildTime': import.meta.env.VITE_BUILD_TIME || Date.now()
        }
      }
    });

    console.log('Sentry: Initialized');
    return Sentry;
  } catch (error) {
    console.error('Sentry: Failed to initialize', error);
    return null;
  }
}

/**
 * Capture custom error
 */
export function captureError(error, context = {}) {
  if (!MONITORING_CONFIG.enabled) return;

  try {
    import('@sentry/browser').then(({ captureException }) => {
      captureException(error, {
        contexts: { custom: context }
      });
    });
  } catch (err) {
    console.error('Failed to capture error:', err);
  }
}

/**
 * Capture custom message
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!MONITORING_CONFIG.enabled) return;

  try {
    import('@sentry/browser').then(({ captureMessage: sentryCapture }) => {
      sentryCapture(message, {
        level,
        contexts: { custom: context }
      });
    });
  } catch (err) {
    console.error('Failed to capture message:', err);
  }
}

// ============================================================================
// Google Analytics Integration
// ============================================================================

/**
 * Initialize Google Analytics 4
 */
export function initGoogleAnalytics() {
  if (!MONITORING_CONFIG.enabled || !MONITORING_CONFIG.analytics.measurementId) {
    console.log('GA4: Disabled (no measurement ID or not in production)');
    return;
  }

  try {
    // Load gtag.js
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MONITORING_CONFIG.analytics.measurementId}`;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', MONITORING_CONFIG.analytics.measurementId, {
      send_page_view: true,
      anonymize_ip: true, // GDPR compliance
      allow_google_signals: false,
      cookie_flags: 'SameSite=None;Secure'
    });

    console.log('GA4: Initialized');
  } catch (error) {
    console.error('GA4: Failed to initialize', error);
  }
}

/**
 * Track custom event
 */
export function trackEvent(eventName, parameters = {}) {
  if (!MONITORING_CONFIG.enabled || !window.gtag) return;

  try {
    window.gtag('event', eventName, {
      ...parameters,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('GA4: Failed to track event', error);
  }
}

/**
 * Track page view
 */
export function trackPageView(path, title) {
  if (!MONITORING_CONFIG.enabled || !window.gtag) return;

  try {
    window.gtag('config', MONITORING_CONFIG.analytics.measurementId, {
      page_path: path,
      page_title: title
    });
  } catch (error) {
    console.error('GA4: Failed to track page view', error);
  }
}

// ============================================================================
// Web Vitals Monitoring
// ============================================================================

/**
 * Initialize Web Vitals monitoring
 */
export async function initWebVitals() {
  if (!MONITORING_CONFIG.performance.enabled) {
    console.log('Web Vitals: Disabled');
    return;
  }

  try {
    // Dynamic import web-vitals library
    const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');

    // Report all vitals
    getCLS(onVitalReport);
    getFID(onVitalReport);
    getFCP(onVitalReport);
    getLCP(onVitalReport);
    getTTFB(onVitalReport);

    console.log('Web Vitals: Initialized');
  } catch (error) {
    console.error('Web Vitals: Failed to initialize', error);
  }
}

/**
 * Handle vital report
 */
function onVitalReport(metric) {
  const { name, value, rating } = metric;

  // Log to console in development
  if (!MONITORING_CONFIG.enabled) {
    console.log(`Web Vital - ${name}:`, {
      value: Math.round(value),
      rating,
      threshold: MONITORING_CONFIG.performance.thresholds[name.toLowerCase()]
    });
    return;
  }

  // Send to analytics
  trackEvent('web_vitals', {
    metric_name: name,
    metric_value: Math.round(value),
    metric_rating: rating,
    metric_delta: Math.round(metric.delta)
  });

  // Send to Sentry if threshold exceeded
  const threshold = MONITORING_CONFIG.performance.thresholds[name.toLowerCase()];
  if (threshold && value > threshold) {
    captureMessage(`Performance issue: ${name} = ${Math.round(value)}ms (threshold: ${threshold}ms)`, 'warning', {
      metric: name,
      value: Math.round(value),
      threshold,
      rating
    });
  }
}

// ============================================================================
// Custom Performance Monitoring
// ============================================================================

const performanceMetrics = {
  fps: [],
  memory: [],
  loadTime: null,
  interactions: []
};

/**
 * Track FPS
 */
export function trackFPS(fps) {
  performanceMetrics.fps.push({
    value: fps,
    timestamp: Date.now()
  });

  // Keep only recent data (last 100 samples)
  if (performanceMetrics.fps.length > 100) {
    performanceMetrics.fps.shift();
  }

  // Report if FPS drops below threshold
  if (fps < 60) {
    trackEvent('performance_fps_drop', {
      fps: Math.round(fps),
      severity: fps < 30 ? 'critical' : fps < 45 ? 'high' : 'medium'
    });
  }
}

/**
 * Track memory usage
 */
export function trackMemory(memoryMB) {
  performanceMetrics.memory.push({
    value: memoryMB,
    timestamp: Date.now()
  });

  // Keep only recent data
  if (performanceMetrics.memory.length > 100) {
    performanceMetrics.memory.shift();
  }

  // Report if memory exceeds threshold (500MB)
  if (memoryMB > 500) {
    trackEvent('performance_high_memory', {
      memory_mb: Math.round(memoryMB),
      severity: memoryMB > 1000 ? 'critical' : memoryMB > 750 ? 'high' : 'medium'
    });
  }
}

/**
 * Track user interaction
 */
export function trackInteraction(type, details = {}) {
  const interaction = {
    type,
    timestamp: Date.now(),
    ...details
  };

  performanceMetrics.interactions.push(interaction);

  // Keep only recent interactions (last 50)
  if (performanceMetrics.interactions.length > 50) {
    performanceMetrics.interactions.shift();
  }

  // Track in analytics
  trackEvent('user_interaction', {
    interaction_type: type,
    ...details
  });
}

/**
 * Report performance summary
 */
export function reportPerformanceSummary() {
  if (!MONITORING_CONFIG.enabled) return;

  const summary = {
    avgFPS: calculateAverage(performanceMetrics.fps.map(m => m.value)),
    minFPS: Math.min(...performanceMetrics.fps.map(m => m.value)),
    maxFPS: Math.max(...performanceMetrics.fps.map(m => m.value)),
    avgMemory: calculateAverage(performanceMetrics.memory.map(m => m.value)),
    maxMemory: Math.max(...performanceMetrics.memory.map(m => m.value)),
    interactionCount: performanceMetrics.interactions.length,
    sessionDuration: Date.now() - (performanceMetrics.fps[0]?.timestamp || Date.now())
  };

  trackEvent('performance_summary', summary);

  return summary;
}

/**
 * Calculate average
 */
function calculateAverage(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

// ============================================================================
// VR-Specific Monitoring
// ============================================================================

/**
 * Track VR session
 */
export function trackVRSession(action, details = {}) {
  trackEvent(`vr_${action}`, {
    device: details.device || 'unknown',
    mode: details.mode || 'immersive-vr',
    ...details
  });
}

/**
 * Track VR error
 */
export function trackVRError(error, context = {}) {
  captureError(error, {
    category: 'vr',
    ...context
  });

  trackEvent('vr_error', {
    error_message: error.message,
    error_type: error.name,
    ...context
  });
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize all monitoring systems
 */
export async function initializeMonitoring() {
  console.log('Monitoring: Initializing...');

  // Initialize error tracking
  await initSentry();

  // Initialize analytics
  initGoogleAnalytics();

  // Initialize performance monitoring
  await initWebVitals();

  // Setup periodic performance reporting
  if (MONITORING_CONFIG.performance.enabled) {
    setInterval(() => {
      reportPerformanceSummary();
    }, MONITORING_CONFIG.performance.reportInterval);
  }

  // Setup visibility change handler
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      trackEvent('session_backgrounded');
    } else {
      trackEvent('session_resumed');
    }
  });

  // Setup unload handler
  window.addEventListener('beforeunload', () => {
    reportPerformanceSummary();
    trackEvent('session_ended');
  });

  console.log('Monitoring: Initialized successfully');
}

// ============================================================================
// Export Utilities
// ============================================================================

export default {
  init: initializeMonitoring,
  captureError,
  captureMessage,
  trackEvent,
  trackPageView,
  trackFPS,
  trackMemory,
  trackInteraction,
  trackVRSession,
  trackVRError,
  reportPerformanceSummary
};

/**
 * Usage Example:
 *
 * // In app.js:
 * import monitoring from './monitoring.js';
 *
 * // Initialize
 * await monitoring.init();
 *
 * // Track events
 * monitoring.trackEvent('button_clicked', { button_id: 'vr-toggle' });
 *
 * // Track errors
 * try {
 *   // ... code ...
 * } catch (error) {
 *   monitoring.captureError(error, { context: 'initialization' });
 * }
 *
 * // Track VR
 * monitoring.trackVRSession('started', { device: 'Quest 3' });
 *
 * // Track performance
 * monitoring.trackFPS(90);
 * monitoring.trackMemory(450);
 */
