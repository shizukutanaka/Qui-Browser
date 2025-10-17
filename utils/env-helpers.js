/**
 * Environment variable parsing utilities
 */

/**
 * Parse number from environment variable with validation
 * @param {string} key - Environment variable key
 * @param {Object} options - Validation options
 * @returns {number} Parsed number or default value
 */
function numberFromEnv(key, options = {}) {
  const raw = process.env[key];
  if (raw === undefined) {
    if (options.required) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return options.default ?? Number.NaN;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    if (options.default !== undefined) {
      console.warn(`[config] Invalid number for ${key}: "${raw}", using default: ${options.default}`);
      return options.default;
    }
    throw new Error(`Invalid number for ${key}: "${raw}"`);
  }

  if (options.min !== undefined && parsed < options.min) {
    console.warn(`[config] ${key} is below minimum ${options.min}, using minimum`);
    return options.min;
  }

  if (options.max !== undefined && parsed > options.max) {
    console.warn(`[config] ${key} is above maximum ${options.max}, using maximum`);
    return options.max;
  }

  return parsed;
}

/**
 * Parse boolean from environment variable
 * @param {string} key - Environment variable key
 * @param {boolean} defaultValue - Default value
 * @returns {boolean} Parsed boolean
 */
function parseBooleanEnv(key, defaultValue = false) {
  const raw = process.env[key];
  if (raw === undefined) {
    return defaultValue;
  }
  return /^(true|1|yes|on)$/iu.test(raw.trim());
}

/**
 * Parse string list from environment variable
 * @param {string} key - Environment variable key
 * @returns {string[]} Array of trimmed strings
 */
function parseStringListEnv(key) {
  const raw = process.env[key];
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map(token => token.trim())
    .filter(Boolean);
}

/**
 * Parse percent from environment variable (0-1 range)
 * @param {string} key - Environment variable key
 * @param {Object} options - Options
 * @returns {number} Percentage as decimal (0-1)
 */
function percentFromEnv(key, options = {}) {
  const defaultOptions = {
    min: 0,
    max: 1,
    ...options
  };
  return numberFromEnv(key, defaultOptions);
}

module.exports = {
  numberFromEnv,
  parseBooleanEnv,
  parseStringListEnv,
  percentFromEnv
};
