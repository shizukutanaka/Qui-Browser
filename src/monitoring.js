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
    thresholds: {
      fcp: 1800,    // First Contentful Paint (ms)
      lcp: 2500,    // Largest Contentful Paint (ms)
      inp: 200,     // Interaction to Next Paint (ms) — replaced FID in web-vitals v3+
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
async function initSentry() {
  if (!MONITORING_CONFIG.enabled || !MONITORING_CONFIG.sentry.dsn) {
    console.debug('Sentry: Disabled (no DSN or not in production)');
    return null;
  }

  try {
    // Dynamic import to avoid loading in development
    const Sentry = await import(/* @vite-ignore */ '@sentry/browser');
    const { BrowserTracing } = await import(/* @vite-ignore */ '@sentry/tracing');
    const { Replay } = await import(/* @vite-ignore */ '@sentry/replay');

    Sentry.init({
      dsn: MONITORING_CONFIG.sentry.dsn,
      environment: MONITORING_CONFIG.sentry.environment,

      // Performance monitoring
      integrations: [
        new BrowserTracing({
          tracePropagationTargets: [location.origin, /^\/api\//]
        }),
        new Replay({
          maskAllText: true,
          blockAllMedia: true
        })
      ],

      // Sampling rates
      tracesSampleRate: MONITORING_CONFIG.sentry.tracesSampleRate,
      replaysSessionSampleRate: MONITORING_CONFIG.sentry.replaysSessionSampleRate,
      replaysOnErrorSampleRate: MONITORING_CONFIG.sentry.replaysOnErrorSampleRate,

      // Before send hook (sanitize sensitive data)
      beforeSend(event, _hint) {
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

    console.debug('Sentry: Initialized');
    return Sentry;
  } catch (error) {
    console.error('Sentry: Failed to initialize', error);
    return null;
  }
}

/**
 * Capture custom message
 */
export function captureMessage(message, level = 'info', context = {}) {
  if (!MONITORING_CONFIG.enabled) {
    return;
  }

  import(/* @vite-ignore */ '@sentry/browser')
    .then(({ captureMessage: sentryCapture }) => {
      sentryCapture(message, {
        level,
        contexts: { custom: context }
      });
    })
    .catch((err) => {
      console.error('Failed to capture message:', err);
    });
}

// ============================================================================
// Google Analytics Integration
// ============================================================================

/**
 * Initialize Google Analytics 4
 */
function initGoogleAnalytics() {
  if (!MONITORING_CONFIG.enabled || !MONITORING_CONFIG.analytics.measurementId) {
    console.debug('GA4: Disabled (no measurement ID or not in production)');
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
    // Function expression (not a declaration) to satisfy no-inner-declarations;
    // gtag relies on `arguments`, so it stays a regular function.
    const gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', MONITORING_CONFIG.analytics.measurementId, {
      send_page_view: true,
      anonymize_ip: true, // GDPR compliance
      allow_google_signals: false,
      cookie_flags: 'SameSite=None;Secure'
    });

    console.debug('GA4: Initialized');
  } catch (error) {
    console.error('GA4: Failed to initialize', error);
  }
}

/**
 * Track custom event
 */
export function trackEvent(eventName, parameters = {}) {
  if (!MONITORING_CONFIG.enabled || !window.gtag) {
    return;
  }

  try {
    window.gtag('event', eventName, {
      ...parameters,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('GA4: Failed to track event', error);
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
    console.debug('Web Vitals: Disabled');
    return;
  }

  try {
    // web-vitals v3+ API: get* was renamed to on*, and FID was replaced by
    // INP. Bundled normally (it is a real dependency, not externalized).
    const { onCLS, onINP, onFCP, onLCP, onTTFB } = await import('web-vitals');

    // Report all vitals
    onCLS(onVitalReport);
    onINP(onVitalReport);
    onFCP(onVitalReport);
    onLCP(onVitalReport);
    onTTFB(onVitalReport);

    console.debug('Web Vitals: Initialized');
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
    console.debug(`Web Vital - ${name}:`, {
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
// Initialization
// ============================================================================

// Module-level listener handles so initializeMonitoring() is idempotent and
// disposeMonitoring() can clean up everything.
let _listeners = null;

/**
 * Initialize all monitoring systems
 */
export async function initializeMonitoring() {
  console.debug('Monitoring: Initializing...');

  // Tear down any previous registration first (idempotent re-init).
  disposeMonitoring();

  // Initialize error tracking
  await initSentry();

  // Initialize analytics
  initGoogleAnalytics();

  // Initialize performance monitoring
  await initWebVitals();

  const onVisibility = () => {
    if (document.hidden) {
      trackEvent('session_backgrounded');
    } else {
      trackEvent('session_resumed');
    }
  };

  const onUnload = () => {
    trackEvent('session_ended');
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('beforeunload', onUnload);
  _listeners = { onVisibility, onUnload };

  console.debug('Monitoring: Initialized successfully');
}

/**
 * Tear down all monitoring side-effects (interval + event listeners).
 */
export function disposeMonitoring() {
  if (_listeners) {
    document.removeEventListener('visibilitychange', _listeners.onVisibility);
    window.removeEventListener('beforeunload', _listeners.onUnload);
    _listeners = null;
  }
}

