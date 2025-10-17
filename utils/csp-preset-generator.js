/**
 * CSP Preset Generator
 * Automated Content Security Policy preset generation with environment separation
 * Priority: H001 from improvement backlog
 *
 * @module utils/csp-preset-generator
 */

const fs = require('fs').promises;
const path = require('path');

class CSPPresetGenerator {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || './config/csp-presets',
      environments: options.environments || ['development', 'staging', 'production'],
      enableReporting: options.enableReporting !== false,
      reportUri: options.reportUri || '/api/csp-report',
      ...options
    };

    this.presets = {
      base: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'"],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"]
      },

      development: {
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'http://localhost:*', 'ws://localhost:*'],
        'style-src': ["'self'", "'unsafe-inline'", 'http://localhost:*'],
        'connect-src': ["'self'", 'http://localhost:*', 'ws://localhost:*', 'wss://localhost:*'],
        'img-src': ["'self'", 'data:', 'http:', 'https:']
      },

      staging: {
        'script-src': ["'self'", "'nonce-{NONCE}'"],
        'style-src': ["'self'", "'nonce-{NONCE}'"],
        'connect-src': ["'self'", 'https://*.staging-domain.com'],
        'report-uri': ['/api/csp-report']
      },

      production: {
        'script-src': ["'self'", "'nonce-{NONCE}'"],
        'style-src': ["'self'", "'nonce-{NONCE}'"],
        'connect-src': ["'self'"],
        'upgrade-insecure-requests': [],
        'report-uri': ['/api/csp-report']
      },

      strict: {
        'default-src': ["'none'"],
        'script-src': ["'self'", "'nonce-{NONCE}'"],
        'style-src': ["'self'", "'nonce-{NONCE}'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'"],
        'connect-src': ["'self'"],
        'frame-src': ["'none'"],
        'object-src': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': [],
        'block-all-mixed-content': []
      },

      analytics: {
        'script-src': ['https://www.googletagmanager.com', 'https://www.google-analytics.com'],
        'connect-src': ['https://www.google-analytics.com', 'https://analytics.google.com'],
        'img-src': ['https://www.google-analytics.com']
      },

      cdn: {
        'script-src': ['https://cdn.jsdelivr.net', 'https://unpkg.com', 'https://cdnjs.cloudflare.com'],
        'style-src': ['https://cdn.jsdelivr.net', 'https://unpkg.com', 'https://cdnjs.cloudflare.com'],
        'font-src': ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']
      },

      webxr: {
        'script-src': ["'self'", "'wasm-unsafe-eval'"],
        'worker-src': ["'self'", 'blob:'],
        'connect-src': ["'self'", 'wss:', 'https:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:']
      }
    };
  }

  /**
   * Generate CSP string from directives
   * @param {Object} directives - CSP directives
   * @returns {string} CSP policy string
   */
  generateCSPString(directives) {
    return Object.entries(directives)
      .map(([directive, values]) => {
        if (values.length === 0) {
          return directive;
        }
        return `${directive} ${values.join(' ')}`;
      })
      .join('; ');
  }

  /**
   * Merge multiple CSP presets
   * @param {...Object} presets - CSP preset objects to merge
   * @returns {Object} Merged CSP directives
   */
  mergePresets(...presets) {
    const merged = {};

    for (const preset of presets) {
      for (const [directive, values] of Object.entries(preset)) {
        if (!merged[directive]) {
          merged[directive] = [];
        }

        // Merge unique values
        for (const value of values) {
          if (!merged[directive].includes(value)) {
            merged[directive].push(value);
          }
        }
      }
    }

    return merged;
  }

  /**
   * Generate CSP for specific environment
   * @param {string} environment - Environment name (development, staging, production)
   * @param {Object} options - Additional options
   * @returns {Object} CSP configuration
   */
  generate(environment, options = {}) {
    const {
      includeAnalytics = false,
      includeCDN = false,
      includeWebXR = false,
      customDirectives = {},
      nonce = null
    } = options;

    // Start with base preset
    let directives = { ...this.presets.base };

    // Merge environment-specific preset
    if (this.presets[environment]) {
      directives = this.mergePresets(directives, this.presets[environment]);
    }

    // Merge optional presets
    if (includeAnalytics) {
      directives = this.mergePresets(directives, this.presets.analytics);
    }

    if (includeCDN) {
      directives = this.mergePresets(directives, this.presets.cdn);
    }

    if (includeWebXR) {
      directives = this.mergePresets(directives, this.presets.webxr);
    }

    // Merge custom directives
    if (Object.keys(customDirectives).length > 0) {
      directives = this.mergePresets(directives, customDirectives);
    }

    // Replace nonce placeholder
    if (nonce) {
      directives = this.replaceNoncePlaceholder(directives, nonce);
    }

    return {
      environment,
      directives,
      header: this.generateCSPString(directives),
      meta: `<meta http-equiv="Content-Security-Policy" content="${this.generateCSPString(directives)}">`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Replace {NONCE} placeholder with actual nonce value
   * @param {Object} directives - CSP directives
   * @param {string} nonce - Nonce value
   * @returns {Object} Directives with replaced nonce
   */
  replaceNoncePlaceholder(directives, nonce) {
    const replaced = {};

    for (const [directive, values] of Object.entries(directives)) {
      replaced[directive] = values.map(value =>
        value.replace('{NONCE}', nonce)
      );
    }

    return replaced;
  }

  /**
   * Generate all environment presets
   * @returns {Object} All environment CSP configurations
   */
  generateAll() {
    const configs = {};

    for (const env of this.options.environments) {
      configs[env] = this.generate(env, {
        includeWebXR: true,
        nonce: '{NONCE}' // Keep placeholder for runtime replacement
      });
    }

    return configs;
  }

  /**
   * Save generated presets to files
   * @returns {Promise<void>}
   */
  async saveToFiles() {
    try {
      // Create output directory
      await fs.mkdir(this.options.outputDir, { recursive: true });

      const configs = this.generateAll();

      // Save each environment config
      for (const [env, config] of Object.entries(configs)) {
        const filePath = path.join(this.options.outputDir, `${env}.json`);
        await fs.writeFile(
          filePath,
          JSON.stringify(config, null, 2),
          'utf8'
        );
        console.log(`[CSPPresetGenerator] Generated: ${filePath}`);
      }

      // Save combined config
      const combinedPath = path.join(this.options.outputDir, 'all.json');
      await fs.writeFile(
        combinedPath,
        JSON.stringify(configs, null, 2),
        'utf8'
      );
      console.log(`[CSPPresetGenerator] Generated: ${combinedPath}`);

      // Generate Node.js module
      await this.generateNodeModule(configs);

      return {
        success: true,
        configs,
        outputDir: this.options.outputDir
      };
    } catch (error) {
      console.error('[CSPPresetGenerator] Error:', error);
      throw error;
    }
  }

  /**
   * Generate Node.js module for runtime use
   * @param {Object} configs - Generated configurations
   * @returns {Promise<void>}
   */
  async generateNodeModule(configs) {
    const modulePath = path.join(this.options.outputDir, 'index.js');

    const moduleContent = `/**
 * Auto-generated CSP Presets
 * Generated: ${new Date().toISOString()}
 * DO NOT EDIT MANUALLY
 */

const presets = ${JSON.stringify(configs, null, 2)};

/**
 * Get CSP configuration for environment
 * @param {string} environment - Environment name
 * @param {string} nonce - Optional nonce value
 * @returns {Object} CSP configuration
 */
function getCSP(environment = 'production', nonce = null) {
  const config = presets[environment];

  if (!config) {
    throw new Error(\`Unknown environment: \${environment}\`);
  }

  if (nonce) {
    const directives = {};
    for (const [key, values] of Object.entries(config.directives)) {
      directives[key] = values.map(v => v.replace('{NONCE}', nonce));
    }
    return {
      ...config,
      directives,
      header: generateCSPString(directives)
    };
  }

  return config;
}

/**
 * Generate CSP string from directives
 * @param {Object} directives - CSP directives
 * @returns {string} CSP policy string
 */
function generateCSPString(directives) {
  return Object.entries(directives)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive;
      }
      return \`\${directive} \${values.join(' ')}\`;
    })
    .join('; ');
}

/**
 * Generate random nonce
 * @returns {string} Base64-encoded nonce
 */
function generateNonce() {
  return require('crypto').randomBytes(16).toString('base64');
}

module.exports = {
  presets,
  getCSP,
  generateCSPString,
  generateNonce
};
`;

    await fs.writeFile(modulePath, moduleContent, 'utf8');
    console.log(`[CSPPresetGenerator] Generated module: ${modulePath}`);
  }

  /**
   * Validate CSP configuration
   * @param {Object} config - CSP configuration to validate
   * @returns {Object} Validation result
   */
  validate(config) {
    const errors = [];
    const warnings = [];

    // Check for common security issues
    if (config.directives['script-src']?.includes("'unsafe-inline'")) {
      warnings.push("'unsafe-inline' in script-src reduces security");
    }

    if (config.directives['script-src']?.includes("'unsafe-eval'")) {
      warnings.push("'unsafe-eval' in script-src reduces security");
    }

    if (!config.directives['default-src']) {
      warnings.push("'default-src' is recommended as fallback");
    }

    if (config.environment === 'production' && config.directives['script-src']?.includes('*')) {
      errors.push("Wildcard (*) in script-src is not secure for production");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate CSP report handler middleware
   * @returns {Function} Express middleware
   */
  createReportHandler() {
    return async (req, res) => {
      try {
        const report = req.body;

        console.warn('[CSP Violation]', {
          documentUri: report['document-uri'],
          violatedDirective: report['violated-directive'],
          blockedUri: report['blocked-uri'],
          sourceFile: report['source-file'],
          lineNumber: report['line-number'],
          timestamp: new Date().toISOString()
        });

        // Store report (implement your storage logic)
        // await storeCSPReport(report);

        res.status(204).end();
      } catch (error) {
        console.error('[CSP Report Handler] Error:', error);
        res.status(500).end();
      }
    };
  }
}

// CLI usage
if (require.main === module) {
  const generator = new CSPPresetGenerator({
    outputDir: './config/csp-presets',
    environments: ['development', 'staging', 'production']
  });

  generator.saveToFiles()
    .then(result => {
      console.log('\n✓ CSP presets generated successfully');
      console.log(`Output directory: ${result.outputDir}`);
      console.log(`Environments: ${Object.keys(result.configs).join(', ')}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Failed to generate CSP presets');
      console.error(error);
      process.exit(1);
    });
}

module.exports = CSPPresetGenerator;
