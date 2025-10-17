'use strict';

const DEFAULT_NONCE_PLACEHOLDER = '${NONCE}';

/**
 * @typedef {Record<string, string | string[]>} CspDirectiveConfig
 */

const PRESETS = {
  strict: {
    description: 'Baseline hardened CSP suitable for production environments.',
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'", 'https:'],
      'frame-src': ["'self'", 'https:'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': [],
      'block-all-mixed-content': []
    }
  },
  analytics: {
    description: 'Extends strict preset to permit analytics endpoints.',
    extends: 'strict',
    directives: {
      'script-src': ['https://www.googletagmanager.com', 'https://www.google-analytics.com'],
      'connect-src': ['https://www.google-analytics.com']
    }
  },
  development: {
    description: 'Relaxed directives for local development and debugging.',
    extends: 'analytics',
    directives: {
      'script-src': ["'unsafe-inline'", "'unsafe-eval'", 'http://localhost:*'],
      'style-src': ["'unsafe-inline'", 'http://localhost:*'],
      'connect-src': ['http://localhost:*', 'ws://localhost:*', 'wss://localhost:*'],
      'img-src': ['data:']
    }
  }
};

function resolvePresetName(name) {
  return typeof name === 'string' ? name.trim().toLowerCase() : 'strict';
}

function resolvePresetConfig(presetName, visited = new Set()) {
  const name = resolvePresetName(presetName);
  const preset = PRESETS[name];
  if (!preset) {
    throw new Error(`Unknown CSP preset: ${presetName}`);
  }
  if (preset.extends) {
    if (visited.has(name)) {
      throw new Error(`Circular CSP preset reference detected at: ${presetName}`);
    }
    visited.add(name);
    const parent = resolvePresetConfig(preset.extends, visited);
    return mergeDirectiveConfigs(parent.directives, preset.directives);
  }
  return normalizeDirectiveConfig(preset.directives);
}

function normalizeDirectiveConfig(directives) {
  /** @type {Record<string, string[]>} */
  const normalized = {};
  for (const [directive, value] of Object.entries(directives || {})) {
    normalized[directive] = normalizeDirectiveValue(value);
  }
  return normalized;
}

function normalizeDirectiveValue(value) {
  if (Array.isArray(value)) {
    return value
      .map(String)
      .map(entry => entry.trim())
      .filter(Boolean);
  }
  if (value === undefined || value === null) {
    return [];
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return [];
  }
  return trimmed.split(/\s+/u);
}

function mergeDirectiveConfigs(base = {}, overrides = {}) {
  const normalizedBase = normalizeDirectiveConfig(base);
  const normalizedOverrides = normalizeDirectiveConfig(overrides);

  /** @type {Record<string, Set<string>>} */
  const merged = {};
  const keys = new Set([...Object.keys(normalizedBase), ...Object.keys(normalizedOverrides)]);

  for (const key of keys) {
    merged[key] = new Set();
    for (const value of normalizedBase[key] || []) {
      merged[key].add(value);
    }
    for (const value of normalizedOverrides[key] || []) {
      merged[key].add(value);
    }
  }

  /** @type {Record<string, string[]>} */
  const result = {};
  for (const [directive, values] of Object.entries(merged)) {
    result[directive] = Array.from(values);
  }
  return result;
}

function applyOptionsToDirectives(directives, options = {}) {
  const output = normalizeDirectiveConfig(directives);
  const {
    allowInlineScripts = false,
    allowInlineStyles = false,
    allowEval = false,
    allowedScriptHosts = [],
    allowedStyleHosts = [],
    allowedConnectHosts = [],
    allowedImageHosts = [],
    allowedFrameAncestors = [],
    reportUri,
    enableTrustedTypes,
    noncePlaceholder,
    extraDirectives = {}
  } = options;

  if (allowInlineScripts) {
    output['script-src'] = output['script-src'] || [];
    output['script-src'].push("'unsafe-inline'");
  }
  if (allowEval) {
    output['script-src'] = output['script-src'] || [];
    output['script-src'].push("'unsafe-eval'");
  }
  if (allowInlineStyles) {
    output['style-src'] = output['style-src'] || [];
    output['style-src'].push("'unsafe-inline'");
  }

  const addList = (directive, hosts) => {
    if (!hosts || hosts.length === 0) {
      return;
    }
    output[directive] = output[directive] || [];
    hosts.forEach(host => {
      const trimmed = typeof host === 'string' ? host.trim() : '';
      if (trimmed) {
        output[directive].push(trimmed);
      }
    });
  };

  addList('script-src', allowedScriptHosts);
  addList('style-src', allowedStyleHosts);
  addList('connect-src', allowedConnectHosts);
  addList('img-src', allowedImageHosts);
  addList('frame-ancestors', allowedFrameAncestors);

  if (noncePlaceholder) {
    const value = `'nonce-${noncePlaceholder}'`;
    output['script-src'] = output['script-src'] || [];
    output['script-src'].push(value);
    output['style-src'] = output['style-src'] || [];
    output['style-src'].push(value);
  }

  if (enableTrustedTypes) {
    output['require-trusted-types-for'] = output['require-trusted-types-for'] || [];
    if (!output['require-trusted-types-for'].includes("'script'")) {
      output['require-trusted-types-for'].push("'script'");
    }
    output['trusted-types'] = output['trusted-types'] || [];
    if (!options.trustedTypesPolicies || options.trustedTypesPolicies.length === 0) {
      output['trusted-types'].push("'none'");
    } else {
      for (const policy of options.trustedTypesPolicies) {
        const trimmed = typeof policy === 'string' ? policy.trim() : '';
        if (trimmed) {
          output['trusted-types'].push(trimmed);
        }
      }
    }
  }

  if (reportUri) {
    output['report-uri'] = normalizeDirectiveValue(reportUri);
  }

  const merged = mergeDirectiveConfigs(output, extraDirectives);
  return merged;
}

function stringifyDirectives(directives) {
  return Object.entries(directives)
    .map(([directive, values]) => {
      if (!values || values.length === 0) {
        return directive;
      }
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

function generateCspHeader(options = {}) {
  const presetName = options.preset || 'strict';
  const baseDirectives = resolvePresetConfig(presetName);
  const directivesWithOptions = applyOptionsToDirectives(baseDirectives, options);
  const normalized = normalizeDirectiveConfig(directivesWithOptions);
  return {
    directives: normalized,
    header: stringifyDirectives(normalized)
  };
}

module.exports = {
  PRESETS,
  DEFAULT_NONCE_PLACEHOLDER,
  generateCspHeader,
  resolvePresetConfig
};
