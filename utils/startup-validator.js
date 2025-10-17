/**
 * Startup Validator - Security and Configuration Validation
 *
 * Validates critical security settings before server startup
 * to prevent running with insecure defaults.
 */

const crypto = require('crypto');

/**
 * Insecure default keys that should never be used in production
 */
const INSECURE_DEFAULTS = [
  'change-this-to-a-secure-random-key-minimum-32-characters',
  'change-this-to-a-secure-random-admin-token-minimum-32-characters',
  'your_secret_key_here',
  'secret',
  'password',
  'test',
  '12345',
  'admin'
];

/**
 * Minimum key lengths for security
 */
const MIN_KEY_LENGTHS = {
  AUDIT_SIGNATURE_KEY: 32,
  BILLING_ADMIN_TOKEN: 32,
  SESSION_SECRET: 32
};

/**
 * Validation result class
 */
class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = true;
  }

  addError(message) {
    this.errors.push(message);
    this.passed = false;
  }

  addWarning(message) {
    this.warnings.push(message);
  }

  hasIssues() {
    return this.errors.length > 0 || this.warnings.length > 0;
  }
}

/**
 * Validates security keys
 */
function validateSecurityKeys(env = process.env) {
  const result = new ValidationResult();
  const isProduction = env.NODE_ENV === 'production';

  // Check AUDIT_SIGNATURE_KEY
  const auditKey = env.AUDIT_SIGNATURE_KEY;
  if (!auditKey) {
    if (env.ENABLE_AUDIT_LOG === 'true') {
      result.addError('AUDIT_SIGNATURE_KEY is required when ENABLE_AUDIT_LOG is enabled');
    }
  } else {
    if (INSECURE_DEFAULTS.includes(auditKey)) {
      result.addError('AUDIT_SIGNATURE_KEY is set to an insecure default value. Generate a secure key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
    if (auditKey.length < MIN_KEY_LENGTHS.AUDIT_SIGNATURE_KEY) {
      result.addError(`AUDIT_SIGNATURE_KEY must be at least ${MIN_KEY_LENGTHS.AUDIT_SIGNATURE_KEY} characters long`);
    }
    if (isSimplePattern(auditKey)) {
      result.addWarning('AUDIT_SIGNATURE_KEY appears to be a simple pattern. Consider using a cryptographically random key');
    }
  }

  // Check BILLING_ADMIN_TOKEN if billing is enabled
  const billingToken = env.BILLING_ADMIN_TOKEN;
  if (env.ENABLE_BILLING === 'true') {
    if (!billingToken) {
      result.addError('BILLING_ADMIN_TOKEN is required when ENABLE_BILLING is enabled');
    } else {
      if (INSECURE_DEFAULTS.includes(billingToken)) {
        result.addError('BILLING_ADMIN_TOKEN is set to an insecure default value');
      }
      if (billingToken.length < MIN_KEY_LENGTHS.BILLING_ADMIN_TOKEN) {
        result.addError(`BILLING_ADMIN_TOKEN must be at least ${MIN_KEY_LENGTHS.BILLING_ADMIN_TOKEN} characters long`);
      }
    }
  }

  // Production-specific checks
  if (isProduction) {
    // HTTPS should be enabled in production
    if (env.ENABLE_HTTPS !== 'true') {
      result.addWarning('ENABLE_HTTPS is not enabled in production environment. This is strongly discouraged');
    }

    // CORS should not allow all origins in production
    const allowedOrigins = env.ALLOWED_ORIGINS || env.CORS_ALLOWED_ORIGINS;
    if (!allowedOrigins || allowedOrigins.includes('*')) {
      result.addWarning('CORS allows all origins (*) in production. This may expose your application to CSRF attacks');
    }

    // Stripe keys should be production keys
    if (env.ENABLE_BILLING === 'true') {
      const stripeKey = env.STRIPE_SECRET_KEY;
      if (stripeKey && stripeKey.startsWith('sk_test_')) {
        result.addWarning('Using Stripe test key (sk_test_*) in production environment');
      }
    }
  }

  return result;
}

/**
 * Checks if a string is a simple pattern (e.g., "aaaa", "1234", "abcd")
 */
function isSimplePattern(str) {
  if (!str || str.length < 4) return false;

  // Check for repeated characters
  if (/^(.)\1+$/.test(str)) return true;

  // Check for sequential patterns
  if (str.length >= 4) {
    const codes = str.split('').map(c => c.charCodeAt(0));
    let sequential = true;
    for (let i = 1; i < Math.min(codes.length, 10); i++) {
      if (codes[i] !== codes[i - 1] + 1) {
        sequential = false;
        break;
      }
    }
    if (sequential) return true;
  }

  return false;
}

/**
 * Validates environment configuration
 */
function validateEnvironment(env = process.env) {
  const result = new ValidationResult();

  // Check for required environment file
  if (env.NODE_ENV === 'production' && !process.env.DOTENV_LOADED) {
    result.addWarning('Running in production mode without a .env file');
  }

  // Validate port
  const port = parseInt(env.PORT || '8000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    result.addError(`Invalid PORT value: ${env.PORT}. Must be between 1 and 65535`);
  }

  // Validate numeric values
  const numericEnvs = [
    'SESSION_TIMEOUT',
    'CACHE_MAX_SIZE',
    'CACHE_TTL',
    'REQUEST_TIMEOUT',
    'SHUTDOWN_TIMEOUT'
  ];

  for (const envKey of numericEnvs) {
    const value = env[envKey];
    if (value !== undefined) {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) {
        result.addError(`Invalid ${envKey} value: ${value}. Must be a positive number`);
      }
    }
  }

  return result;
}

/**
 * Validates TLS/SSL configuration
 */
function validateTLS(env = process.env) {
  const result = new ValidationResult();
  const fs = require('fs');

  if (env.ENABLE_HTTPS === 'true') {
    const certPath = env.TLS_CERT_PATH;
    const keyPath = env.TLS_KEY_PATH;

    if (!certPath || !keyPath) {
      result.addError('ENABLE_HTTPS is true but TLS_CERT_PATH or TLS_KEY_PATH is not set');
    } else {
      // Check if certificate files exist
      try {
        if (!fs.existsSync(certPath)) {
          result.addError(`TLS certificate file not found: ${certPath}`);
        }
      } catch (e) {
        result.addWarning(`Unable to verify TLS certificate file: ${e.message}`);
      }

      try {
        if (!fs.existsSync(keyPath)) {
          result.addError(`TLS key file not found: ${keyPath}`);
        }
      } catch (e) {
        result.addWarning(`Unable to verify TLS key file: ${e.message}`);
      }
    }
  }

  return result;
}

/**
 * Main validation function
 */
function validateStartupConfiguration(options = {}) {
  const env = options.env || process.env;
  const results = {
    security: validateSecurityKeys(env),
    environment: validateEnvironment(env),
    tls: validateTLS(env)
  };

  const combined = new ValidationResult();

  for (const category of Object.values(results)) {
    combined.errors.push(...category.errors);
    combined.warnings.push(...category.warnings);
    if (!category.passed) {
      combined.passed = false;
    }
  }

  return {
    passed: combined.passed,
    errors: combined.errors,
    warnings: combined.warnings,
    results
  };
}

/**
 * Generates a secure random key
 */
function generateSecureKey(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Prints validation results
 */
function printValidationResults(validation, options = {}) {
  const { exitOnError = true } = options;

  if (validation.errors.length > 0) {
    console.error('\n🚨 CRITICAL CONFIGURATION ERRORS:\n');
    validation.errors.forEach((error, i) => {
      console.error(`  ${i + 1}. ${error}`);
    });
  }

  if (validation.warnings.length > 0) {
    console.warn('\n⚠️  CONFIGURATION WARNINGS:\n');
    validation.warnings.forEach((warning, i) => {
      console.warn(`  ${i + 1}. ${warning}`);
    });
  }

  if (validation.passed && validation.warnings.length === 0) {
    console.log('\n✅ All startup validations passed\n');
  } else if (validation.passed) {
    console.log('\n✅ Startup validations passed with warnings\n');
  } else {
    console.error('\n❌ Startup validation FAILED\n');
    console.error('Please fix the errors above before starting the server.\n');
    console.error('To generate secure keys, run:');
    console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n');

    if (exitOnError) {
      process.exit(1);
    }
  }

  return validation.passed;
}

module.exports = {
  validateStartupConfiguration,
  validateSecurityKeys,
  validateEnvironment,
  validateTLS,
  generateSecureKey,
  printValidationResults,
  ValidationResult,
  INSECURE_DEFAULTS,
  MIN_KEY_LENGTHS
};
