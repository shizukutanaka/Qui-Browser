/**
 * Production Monitoring Setup
 * Error tracking, performance monitoring, and analytics
 *
 * Integrations:
 * - Google Analytics 4 (user analytics)
 * - Web Vitals (performance)
 *
 * John Carmack principle: "You can't fix what you can't measure"
 */

// ============================================================================
// Configuration
// ============================================================================

const MONITORING_CONFIG = {
  // Enable in production only
  enabled: import.meta.env.PROD,

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

  // Threshold breach is already reported to analytics via trackEvent above.
  const threshold = MONITORING_CONFIG.performance.thresholds[name.toLowerCase()];
  if (threshold && value > threshold) {
    console.warn(`Performance issue: ${name} = ${Math.round(value)}ms (threshold: ${threshold}ms)`);
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

