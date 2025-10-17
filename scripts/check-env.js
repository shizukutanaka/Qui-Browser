#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { LOCALE_OVERRIDES } = require('../config/pricing');

const PROJECT_ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const ICONS = {
  ok: '[OK]',
  warning: '[WARN]',
  error: '[ERR]'
};

const WARNING_SEVERITY = /** @type {'warning'} */ ('warning');

const SUPPORTED_BILLING_LOCALES = new Set(Object.keys(LOCALE_OVERRIDES || {}));
if (!SUPPORTED_BILLING_LOCALES.has('default')) {
  SUPPORTED_BILLING_LOCALES.add('default');
}

/**
 * @typedef {Object} CheckResult
 * @property {'ok' | 'warning' | 'error'} status
 * @property {string} titleEn
 * @property {string} titleJa
 * @property {string} detailEn
 * @property {string} detailJa
 */

/** @returns {Record<string, string>} */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return dotenv.parse(content);
}

/**
 * @param {string | undefined} value
 * @returns {boolean}
 */
function isPlaceholder(value) {
  if (!value) {
    return true;
  }
  const lower = value.toLowerCase();
  return lower.includes('changeme') || lower.includes('your_') || lower.includes('example');
}

/**
 * @param {Record<string, string>} env
 * @param {string} key
 * @returns {string}
 */
function getEnvValue(env, key) {
  const value = env[key];
  if (typeof value === 'string') {
    return value.trim();
  }
  const fallback = process.env[key];
  return typeof fallback === 'string' ? fallback.trim() : '';
}

/**
 * @param {CheckResult[]} results
 * @param {CheckResult} result
 */
function pushResult(results, result) {
  results.push(result);
}

function parseCommaSeparatedList(value) {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

/**
 * @param {CheckResult[]} results
 * @param {Record<string, string>} env
 * @param {Object} options
 * @param {string} options.key
 * @param {string} options.labelEn
 * @param {string} options.labelJa
 * @param {'warning' | 'error'} [options.missingSeverity]
 * @param {string} [options.missingDetailEn]
 * @param {string} [options.missingDetailJa]
 * @param {RegExp} [options.pattern]
 * @param {string} [options.patternDetailEn]
 * @param {string} [options.patternDetailJa]
 * @param {(value: string) => string} [options.normalize]
 * @returns {string | undefined}
 */
function validateStringField(results, env, options) {
  const rawValue = getEnvValue(env, options.key);
  const normalized = rawValue && options.normalize ? options.normalize(rawValue) : rawValue;
  const titleEn = `${options.labelEn} validation`;
  const titleJa = `${options.labelJa} の検証`;

  if (!normalized) {
    if (options.missingSeverity) {
      pushResult(results, {
        status: options.missingSeverity,
        titleEn,
        titleJa,
        detailEn:
          options.missingDetailEn || `${options.key} is not set. Provide a valid value to enable related features.`,
        detailJa:
          options.missingDetailJa || `${options.key} が未設定です。関連機能を有効にするため有効な値を設定してください。`
      });
    }
    return undefined;
  }

  if (options.pattern && !options.pattern.test(normalized)) {
    pushResult(results, {
      status: 'error',
      titleEn,
      titleJa,
      detailEn:
        options.patternDetailEn ||
        `${options.key} must match ${options.pattern.toString()} (received "${normalized}").`,
      detailJa:
        options.patternDetailJa ||
        `${options.key} は ${options.pattern.toString()} に一致する必要があります（現在の値: "${normalized}"）。`
    });
    return undefined;
  }

  pushResult(results, {
    status: 'ok',
    titleEn,
    titleJa,
    detailEn: `${options.key}=${normalized} is valid.`,
    detailJa: `${options.key}=${normalized} は有効です。`
  });

  return normalized;
}

/**
 * @param {CheckResult[]} results
 * @returns {number}
 */
function countByStatus(results, status) {
  return results.filter(item => item.status === status).length;
}

/**
 * @param {CheckResult[]} results
 * @param {Record<string, string>} env
 * @param {Object} options
 * @param {string} options.key
 * @param {string} options.labelEn
 * @param {string} options.labelJa
 * @param {number} [options.min]
 * @param {number} [options.max]
 * @param {'warning' | 'error'} [options.missingSeverity]
 * @param {string} [options.missingDetailEn]
 * @param {string} [options.missingDetailJa]
 * @returns {number | undefined}
 */
function validateNumericField(results, env, options) {
  const raw = getEnvValue(env, options.key);
  const titleEn = `${options.labelEn} numeric validation`;
  const titleJa = `${options.labelJa} の数値検証`;

  if (!raw) {
    if (options.missingSeverity) {
      pushResult(results, {
        status: options.missingSeverity,
        titleEn,
        titleJa,
        detailEn: options.missingDetailEn || `${options.key} is not set. Configure it to ensure consistent behaviour.`,
        detailJa: options.missingDetailJa || `${options.key} が未設定です。安定した動作のため値を設定してください。`
      });
    }
    return undefined;
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value)) {
    pushResult(results, {
      status: 'error',
      titleEn,
      titleJa,
      detailEn: `${options.key} must be an integer (received "${raw}").`,
      detailJa: `${options.key} は整数である必要があります（現在の値: "${raw}"）。`
    });
    return undefined;
  }

  if (options.min !== undefined && value < options.min) {
    pushResult(results, {
      status: 'error',
      titleEn,
      titleJa,
      detailEn: `${options.key} must be >= ${options.min} (received ${value}).`,
      detailJa: `${options.key} は ${options.min} 以上である必要があります（現在の値: ${value}）。`
    });
    return undefined;
  }

  if (options.max !== undefined && value > options.max) {
    pushResult(results, {
      status: 'error',
      titleEn,
      titleJa,
      detailEn: `${options.key} must be <= ${options.max} (received ${value}).`,
      detailJa: `${options.key} は ${options.max} 以下である必要があります（現在の値: ${value}）。`
    });
    return undefined;
  }

  pushResult(results, {
    status: 'ok',
    titleEn,
    titleJa,
    detailEn: `${options.key}=${value} satisfies numeric constraints.`,
    detailJa: `${options.key}=${value} は設定要件を満たしています。`
  });

  return value;
}

/**
 * @param {CheckResult[]} results
 * @param {Record<string, string>} env
 * @param {Object} options
 * @param {string} options.key
 * @param {string} options.labelEn
 * @param {string} options.labelJa
 * @param {number} [options.min]
 * @param {number} [options.max]
 * @param {'warning' | 'error'} [options.missingSeverity]
 * @param {string} [options.missingDetailEn]
 * @param {string} [options.missingDetailJa]
 * @returns {number | undefined}
 */
function validateFloatField(results, env, options) {
  const raw = getEnvValue(env, options.key);
  const titleEn = `${options.labelEn} numeric validation`;
  const titleJa = `${options.labelJa} の数値検証`;

  if (!raw) {
    if (options.missingSeverity) {
      pushResult(results, {
        status: options.missingSeverity,
        titleEn,
        titleJa,
        detailEn:
          options.missingDetailEn || `${options.key} is not set. Configure it to ensure consistent behaviour.`,
        detailJa:
          options.missingDetailJa || `${options.key} が未設定です。安定した動作のため値を設定してください。`
      });
    }
    return undefined;
  }

  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) {
    pushResult(results, {
      status: 'error',
      titleEn,
      titleJa,
      detailEn: `${options.key} must be a finite number (received "${raw}").`,
      detailJa: `${options.key} は有限の数値である必要があります（現在の値: "${raw}"）。`
    });
    return undefined;
  }

  if (options.min !== undefined && value < options.min) {
    pushResult(results, {
      status: 'error',
      titleEn,
      titleJa,
      detailEn: `${options.key} must be >= ${options.min} (received ${value}).`,
      detailJa: `${options.key} は ${options.min} 以上である必要があります（現在の値: ${value}）。`
    });
    return undefined;
  }

  if (options.max !== undefined && value > options.max) {
    pushResult(results, {
      status: 'error',
      titleEn,
      titleJa,
      detailEn: `${options.key} must be <= ${options.max} (received ${value}).`,
      detailJa: `${options.key} は ${options.max} 以下である必要があります（現在の値: ${value}）。`
    });
    return undefined;
  }

  pushResult(results, {
    status: 'ok',
    titleEn,
    titleJa,
    detailEn: `${options.key}=${value} satisfies numeric constraints.`,
    detailJa: `${options.key}=${value} は設定要件を満たしています。`
  });

  return value;
}

/**
 * @param {CheckResult[]} results
 * @param {Record<string, string>} env
 * @param {Object} options
 * @param {string} options.key
 * @param {string} options.labelEn
 * @param {string} options.labelJa
 * @param {'warning' | 'error'} [options.missingSeverity]
 * @param {string} [options.missingDetailEn]
 * @param {string} [options.missingDetailJa]
 * @returns {boolean | undefined}
 */
function validateBooleanField(results, env, options) {
  const raw = getEnvValue(env, options.key);
  const titleEn = `${options.labelEn} boolean validation`;
  const titleJa = `${options.labelJa} の真偽値検証`;

  if (!raw) {
    if (options.missingSeverity) {
      pushResult(results, {
        status: options.missingSeverity,
        titleEn,
        titleJa,
        detailEn: options.missingDetailEn || `${options.key} is not set. Define it explicitly to avoid surprises.`,
        detailJa:
          options.missingDetailJa || `${options.key} が未設定です。予期せぬ挙動を避けるため明示的に設定してください。`
      });
    }
    return undefined;
  }

  const normalized = raw.toLowerCase();
  if (normalized !== 'true' && normalized !== 'false') {
    pushResult(results, {
      status: 'error',
      titleEn,
      titleJa,
      detailEn: `${options.key} must be "true" or "false" (received "${raw}").`,
      detailJa: `${options.key} は "true" または "false" に設定してください（現在の値: "${raw}"）。`
    });
    return undefined;
  }

  pushResult(results, {
    status: 'ok',
    titleEn,
    titleJa,
    detailEn: `${options.key}=${normalized}.`,
    detailJa: `${options.key}=${normalized} です。`
  });

  return normalized === 'true';
}

/**
 * @param {CheckResult[]} results
 * @param {Record<string, string>} env
 * @param {Object} options
 * @param {string} options.key
 * @param {string} options.labelEn
 * @param {string} options.labelJa
 * @param {readonly string[]} options.allowed
 * @param {'warning' | 'error'} [options.missingSeverity]
 * @param {string} [options.missingDetailEn]
 * @param {string} [options.missingDetailJa]
 * @returns {string | undefined}
 */
function validateEnumField(results, env, options) {
  const raw = getEnvValue(env, options.key);
  const titleEn = `${options.labelEn} value`;
  const titleJa = `${options.labelJa} の値検証`;

  if (!raw) {
    if (options.missingSeverity) {
      pushResult(results, {
        status: options.missingSeverity,
        titleEn,
        titleJa,
        detailEn: options.missingDetailEn || `${options.key} is not set. Choose one of: ${options.allowed.join(', ')}.`,
        detailJa:
          options.missingDetailJa ||
          `${options.key} が未設定です。${options.allowed.join(', ')} のいずれかを設定してください。`
      });
    }
    return undefined;
  }

  const normalized = raw.toLowerCase();
  if (!options.allowed.includes(normalized)) {
    pushResult(results, {
      status: 'error',
      titleEn,
      titleJa,
      detailEn: `${options.key} must be one of ${options.allowed.join(', ')} (received "${raw}").`,
      detailJa: `${options.key} は ${options.allowed.join(', ')} のいずれかである必要があります（現在の値: "${raw}"）。`
    });
    return undefined;
  }

  pushResult(results, {
    status: 'ok',
    titleEn,
    titleJa,
    detailEn: `${options.key}=${normalized}.`,
    detailJa: `${options.key}=${normalized} です。`
  });

  return normalized;
}

/**
 * @param {CheckResult[]} results
 * @param {Record<string, string>} env
 * @param {boolean | undefined} notificationsEnabled
 */
function validateNotificationWebhooks(results, env, notificationsEnabled) {
  const raw = getEnvValue(env, 'NOTIFICATION_WEBHOOKS');
  const titleEn = 'Notification webhook endpoints';
  const titleJa = '通知Webhookエンドポイント';

  if (!raw) {
    if (notificationsEnabled) {
      pushResult(results, {
        status: 'error',
        titleEn,
        titleJa,
        detailEn:
          'NOTIFICATION_WEBHOOKS is required when notifications are enabled. Provide at least one HTTPS endpoint.',
        detailJa:
          '通知機能を有効化している場合は NOTIFICATION_WEBHOOKS に少なくとも1つの HTTPS エンドポイントを設定してください。'
      });
    }
    return;
  }

  const endpoints = raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (endpoints.length === 0) {
    if (notificationsEnabled) {
      pushResult(results, {
        status: 'error',
        titleEn,
        titleJa,
        detailEn: 'NOTIFICATION_WEBHOOKS must include at least one HTTPS URL when notifications are enabled.',
        detailJa: '通知機能を有効化している場合、NOTIFICATION_WEBHOOKS には少なくとも1つの HTTPS URL が必要です。'
      });
    }
    return;
  }

  const invalidFormat = [];
  const insecure = [];

  for (const endpoint of endpoints) {
    try {
      const parsed = new URL(endpoint);
      if (parsed.protocol !== 'https:') {
        insecure.push(endpoint);
      }
    } catch (error) {
      invalidFormat.push(endpoint);
    }
  }

  let hasIssues = false;
  if (invalidFormat.length > 0) {
    hasIssues = true;
    pushResult(results, {
      status: 'error',
      titleEn,
      titleJa,
      detailEn: `Invalid webhook URL(s): ${invalidFormat.join(', ')}. Provide absolute URLs.`,
      detailJa: `無効なWebhook URLがあります: ${invalidFormat.join(', ')}。絶対URLを指定してください。`
    });
  }

  if (insecure.length > 0) {
    hasIssues = true;
    pushResult(results, {
      status: 'error',
      titleEn,
      titleJa,
      detailEn: `Webhook URL(s) must use HTTPS: ${insecure.join(', ')}.`,
      detailJa: `Webhook URL は HTTPS を使用する必要があります: ${insecure.join(', ')}。`
    });
  }

  if (!hasIssues) {
    pushResult(results, {
      status: 'ok',
      titleEn,
      titleJa,
      detailEn: `Configured webhook endpoints (${endpoints.length}) are valid HTTPS URLs.`,
      detailJa: `設定されたWebhookエンドポイント（${endpoints.length}件）は有効なHTTPS URLです。`
    });
  }
}

function validateHealthMetrics(results, env) {
  const ratioFields = [
    { key: 'HEALTH_MEMORY_WARNING', labelEn: 'Health memory warning ratio', labelJa: 'メモリ警告比率', min: 0, max: 1 },
    { key: 'HEALTH_MEMORY_CRITICAL', labelEn: 'Health memory critical ratio', labelJa: 'メモリ緊急比率', min: 0, max: 1 },
    { key: 'HEALTH_HEAP_WARNING', labelEn: 'Health heap warning ratio', labelJa: 'ヒープ警告比率', min: 0, max: 1 },
    { key: 'HEALTH_HEAP_CRITICAL', labelEn: 'Health heap critical ratio', labelJa: 'ヒープ緊急比率', min: 0, max: 1 },
    { key: 'HEALTH_CPU_WARNING', labelEn: 'Health CPU warning ratio', labelJa: 'CPU 警告比率', min: 0, max: 1 },
    { key: 'HEALTH_CPU_CRITICAL', labelEn: 'Health CPU critical ratio', labelJa: 'CPU 緊急比率', min: 0, max: 1 }
  ];

  for (const field of ratioFields) {
    validateFloatField(results, env, {
      key: field.key,
      labelEn: field.labelEn,
      labelJa: field.labelJa,
      min: field.min,
      max: field.max,
      missingSeverity: WARNING_SEVERITY
    });
  }

  const durationFields = [
    {
      key: 'HEALTH_SAMPLE_INTERVAL_MS',
      labelEn: 'Health sample interval (ms)',
      labelJa: 'ヘルスサンプル間隔 (ms)',
      min: 1000,
      missingSeverity: WARNING_SEVERITY
    },
    {
      key: 'HEALTH_EVENT_LOOP_SAMPLE_MS',
      labelEn: 'Health event loop sample (ms)',
      labelJa: 'イベントループサンプル (ms)',
      min: 10,
      missingSeverity: WARNING_SEVERITY
    },
    {
      key: 'HEALTH_EVENT_LOOP_WARNING_MS',
      labelEn: 'Health event loop warning (ms)',
      labelJa: 'イベントループ警告 (ms)',
      min: 10,
      missingSeverity: WARNING_SEVERITY
    },
    {
      key: 'HEALTH_EVENT_LOOP_CRITICAL_MS',
      labelEn: 'Health event loop critical (ms)',
      labelJa: 'イベントループ緊急 (ms)',
      min: 10,
      missingSeverity: WARNING_SEVERITY
    }
  ];

  for (const field of durationFields) {
    validateNumericField(results, env, {
      key: field.key,
      labelEn: field.labelEn,
      labelJa: field.labelJa,
      min: field.min,
      missingSeverity: WARNING_SEVERITY
    });
  }
}

function runEnvCheck(options = {}) {
  const { envPath = ENV_PATH, silent = false, logger = console } = options;

  const resolvedEnvPath = path.resolve(envPath);
  const env = loadEnvFile(resolvedEnvPath);
  const results = [];

  if (!fs.existsSync(resolvedEnvPath)) {
    pushResult(results, {
      status: 'error',
      titleEn: '.env file presence',
      titleJa: '.env ファイル存在確認',
      detailEn: 'Missing .env file at project root. Copy .env.example and configure secrets.',
      detailJa: 'プロジェクト直下に .env が存在しません。.env.example を複製し、機密情報を設定してください。'
    });
  } else {
    pushResult(results, {
      status: 'ok',
      titleEn: '.env file presence',
      titleJa: '.env ファイル存在確認',
      detailEn: '.env file detected.',
      detailJa: '.env ファイルを検出しました。'
    });
  }

  const nodeEnv = getEnvValue(env, 'NODE_ENV') || 'development';
  pushResult(results, {
    status: 'ok',
    titleEn: 'NODE_ENV value',
    titleJa: 'NODE_ENV の値',
    detailEn: `Detected environment: ${nodeEnv}.`,
    detailJa: `検出した環境: ${nodeEnv} です。`
  });

  // validateHostBinding(results, env, nodeEnv); // TODO: Define function
  // validateAllowedHosts(results, env); // TODO: Define function
  // validateAllowedOrigins(results, env, nodeEnv); // TODO: Define function

  // PORT validation
  const portValue = getEnvValue(env, 'PORT') || '8000';
  const port = Number.parseInt(portValue, 10);
  const minPort = nodeEnv === 'test' ? 0 : 1024;
  if (!Number.isInteger(port) || port < minPort || port > 65535) {
    pushResult(results, {
      status: 'error',
      titleEn: 'PORT range validation',
      titleJa: 'PORT 範囲検証',
      detailEn: `PORT must be an integer between ${minPort} and 65535 (received "${portValue}").`,
      detailJa: `PORT は ${minPort} から 65535 の整数である必要があります（現在の値: "${portValue}"）。`
    });
  } else {
    pushResult(results, {
      status: 'ok',
      titleEn: 'PORT range validation',
      titleJa: 'PORT 範囲検証',
      detailEn: `PORT=${port} is within the allowed range.`,
      detailJa: `PORT=${port} は許容範囲内です。`
    });
  }

  // Mandatory secrets
  const secretKeys = [
    { key: 'STRIPE_PUBLISHABLE_KEY', labelEn: 'Stripe publishable key', labelJa: 'Stripe 公開鍵' },
    { key: 'STRIPE_SECRET_KEY', labelEn: 'Stripe secret key', labelJa: 'Stripe 秘密鍵' },
    { key: 'STRIPE_WEBHOOK_SECRET', labelEn: 'Stripe webhook secret', labelJa: 'Stripe Webhook 秘密' },
    { key: 'BILLING_ADMIN_TOKEN', labelEn: 'Billing admin token', labelJa: '課金管理トークン' }
  ];

  for (const secret of secretKeys) {
    const value = getEnvValue(env, secret.key);
    if (!value) {
      pushResult(results, {
        status: 'error',
        titleEn: `${secret.labelEn} presence`,
        titleJa: `${secret.labelJa} の設定`,
        detailEn: `${secret.key} is missing. Set a valid value before deployment.`,
        detailJa: `${secret.key} が未設定です。運用前に有効な値を設定してください。`
      });
      continue;
    }
    if (isPlaceholder(value)) {
      pushResult(results, {
        status: 'error',
        titleEn: `${secret.labelEn} placeholder`,
        titleJa: `${secret.labelJa} のプレースホルダー`,
        detailEn: `${secret.key} still contains a placeholder value. Replace it with real credentials.`,
        detailJa: `${secret.key} がプレースホルダーのままです。実際の認証情報に置き換えてください。`
      });
      continue;
    }
    pushResult(results, {
      status: 'ok',
      titleEn: `${secret.labelEn} presence`,
      titleJa: `${secret.labelJa} の設定`,
      detailEn: `${secret.key} is configured.`,
      detailJa: `${secret.key} は設定されています。`
    });
  }

  // Billing admin token strength
  const adminToken = getEnvValue(env, 'BILLING_ADMIN_TOKEN');
  if (adminToken && adminToken.length < 16) {
    pushResult(results, {
      status: 'warning',
      titleEn: 'Billing admin token length',
      titleJa: '課金管理トークンの長さ',
      detailEn: 'BILLING_ADMIN_TOKEN should be at least 16 characters for security.',
      detailJa: 'BILLING_ADMIN_TOKEN は安全のため 16 文字以上にしてください。'
    });
  }

  // Security headers
  const securityHeaders = getEnvValue(env, 'ENABLE_SECURITY_HEADERS');
  if (nodeEnv === 'production' && securityHeaders !== 'true') {
    pushResult(results, {
      status: 'error',
      titleEn: 'Security headers in production',
      titleJa: '本番環境でのセキュリティヘッダー',
      detailEn: 'ENABLE_SECURITY_HEADERS must be set to true in production.',
      detailJa: '本番環境では ENABLE_SECURITY_HEADERS を true に設定する必要があります。'
    });
  } else if (securityHeaders === 'true') {
    pushResult(results, {
      status: 'ok',
      titleEn: 'Security headers enabled',
      titleJa: 'セキュリティヘッダー有効化',
      detailEn: 'Security headers are enabled.',
      detailJa: 'セキュリティヘッダーが有効になっています。'
    });
  } else {
    pushResult(results, {
      status: 'warning',
      titleEn: 'Security headers setting',
      titleJa: 'セキュリティヘッダー設定',
      detailEn: 'ENABLE_SECURITY_HEADERS is not explicitly set to true. Enable it before production rollout.',
      detailJa: 'ENABLE_SECURITY_HEADERS が true に設定されていません。本番展開前に有効化してください。'
    });
  }

  // Success/Cancel URLs
  const urlChecks = [
    { key: 'STRIPE_SUCCESS_URL', labelEn: 'Stripe success URL', labelJa: 'Stripe 成功時 URL' },
    { key: 'STRIPE_CANCEL_URL', labelEn: 'Stripe cancel URL', labelJa: 'Stripe キャンセル時 URL' }
  ];

  for (const urlCheck of urlChecks) {
    const value = getEnvValue(env, urlCheck.key);
    if (!value) {
      pushResult(results, {
        status: 'warning',
        titleEn: `${urlCheck.labelEn} presence`,
        titleJa: `${urlCheck.labelJa} の設定`,
        detailEn: `${urlCheck.key} is empty. Configure an HTTPS endpoint for Stripe redirection.`,
        detailJa: `${urlCheck.key} が空です。Stripe のリダイレクト用 HTTPS エンドポイントを設定してください。`
      });
      continue;
    }
    if (!value.startsWith('https://')) {
      pushResult(results, {
        status: 'error',
        titleEn: `${urlCheck.labelEn} protocol`,
        titleJa: `${urlCheck.labelJa} のプロトコル`,
        detailEn: `${urlCheck.key} must start with https:// to satisfy Stripe requirements.`,
        detailJa: `${urlCheck.key} は Stripe の要件を満たすため https:// で始める必要があります。`
      });
      continue;
    }
    pushResult(results, {
      status: 'ok',
      titleEn: `${urlCheck.labelEn} protocol`,
      titleJa: `${urlCheck.labelJa} のプロトコル`,
      detailEn: `${urlCheck.key} uses HTTPS.`,
      detailJa: `${urlCheck.key} は HTTPS を利用しています。`
    });
  }

  // CORS wildcard warning for production
  // validateStripeIdentifiers(results, env); // TODO: Define function
  // validateDefaultBillingLocale(results, env); // TODO: Define function

  // Rate limiting configuration
  validateNumericField(results, env, {
    key: 'RATE_LIMIT_MAX',
    labelEn: 'Rate limit maximum requests',
    labelJa: 'レート制限 最大リクエスト数',
    min: 1,
    missingSeverity: 'warning',
    missingDetailEn: 'RATE_LIMIT_MAX is not defined. Configure to avoid unlimited burst traffic.',
    missingDetailJa: 'RATE_LIMIT_MAX が未設定です。無制限の突発的トラフィックを防ぐため値を設定してください。'
  });
  validateNumericField(results, env, {
    key: 'RATE_LIMIT_WINDOW',
    labelEn: 'Rate limit window (ms)',
    labelJa: 'レート制限 ウィンドウ (ms)',
    min: 1,
    missingSeverity: 'warning'
  });
  validateNumericField(results, env, {
    key: 'RATE_LIMIT_MAX_ENTRIES',
    labelEn: 'Rate limit cache entries',
    labelJa: 'レート制限 キャッシュエントリ数',
    min: 1,
    missingSeverity: 'warning'
  });

  // Cache and compression configuration
  validateNumericField(results, env, {
    key: 'FILE_CACHE_MAX_SIZE',
    labelEn: 'File cache size',
    labelJa: 'ファイルキャッシュサイズ',
    min: 1,
    missingSeverity: 'warning'
  });
  validateNumericField(results, env, {
    key: 'FILE_CACHE_MAX_FILE_SIZE',
    labelEn: 'File cache max file size',
    labelJa: 'キャッシュ可能な最大ファイルサイズ',
    min: 1024,
    missingSeverity: 'warning'
  });
  validateNumericField(results, env, {
    key: 'COMPRESSION_THRESHOLD',
    labelEn: 'Compression threshold',
    labelJa: '圧縮閾値',
    min: 0,
    missingSeverity: 'warning'
  });

  validateBooleanField(results, env, {
    key: 'LIGHTWEIGHT',
    labelEn: 'Lightweight mode toggle',
    labelJa: '軽量モード設定',
    missingSeverity: 'warning'
  });

  // Notification dispatcher configuration
  const notificationsEnabled = validateBooleanField(results, env, {
    key: 'NOTIFICATION_ENABLED',
    labelEn: 'Notification feature toggle',
    labelJa: '通知機能の有効化',
    missingSeverity: 'warning'
  });

  validateEnumField(results, env, {
    key: 'NOTIFICATION_MIN_LEVEL',
    labelEn: 'Notification minimum level',
    labelJa: '通知最小レベル',
    allowed: ['info', 'warning', 'error'],
    missingSeverity: notificationsEnabled ? 'error' : 'warning',
    missingDetailEn: notificationsEnabled
      ? 'NOTIFICATION_MIN_LEVEL is required when notifications are enabled.'
      : undefined,
    missingDetailJa: notificationsEnabled
      ? '通知機能を有効化する場合は NOTIFICATION_MIN_LEVEL を設定してください。'
      : undefined
  });

  validateNumericField(results, env, {
    key: 'NOTIFICATION_TIMEOUT_MS',
    labelEn: 'Notification timeout (ms)',
    labelJa: '通知タイムアウト (ms)',
    min: 100,
    missingSeverity: notificationsEnabled ? 'error' : 'warning'
  });
  validateNumericField(results, env, {
    key: 'NOTIFICATION_BATCH_WINDOW_MS',
    labelEn: 'Notification batch window (ms)',
    labelJa: '通知バッチウィンドウ (ms)',
    min: 0,
    missingSeverity: notificationsEnabled ? 'warning' : undefined
  });
  validateNumericField(results, env, {
    key: 'NOTIFICATION_RETRY_BACKOFF_MS',
    labelEn: 'Notification retry backoff (ms)',
    labelJa: '通知リトライ初期バックオフ (ms)',
    min: 0,
    missingSeverity: notificationsEnabled ? 'warning' : undefined
  });

  validateBooleanField(results, env, {
    key: 'LOG_SANITIZED_HEADERS',
    labelEn: 'Log sanitized headers flag',
    labelJa: 'ヘッダーサニタイズログ設定'
  });
  validateBooleanField(results, env, {
    key: 'LOG_SANITIZED_BODY',
    labelEn: 'Log sanitized body flag',
    labelJa: 'ボディサニタイズログ設定'
  });

  validateHealthMetrics(results, env);

  validateNotificationWebhooks(results, env, notificationsEnabled);

  const errorCount = countByStatus(results, 'error');
  const warningCount = countByStatus(results, 'warning');

  if (!silent) {
    logger.log('Qui Browser Environment Check / 環境検証レポート');
    logger.log('========================================');
    for (const result of results) {
      const icon = ICONS[result.status] || '•';
      logger.log(`${icon} ${result.titleEn}: ${result.detailEn}`);
      logger.log(`  ${icon} ${result.titleJa}: ${result.detailJa}`);
    }
    logger.log('========================================');
    logger.log(`Summary: errors=${errorCount}, warnings=${warningCount}`);
  }

  return {
    results,
    errorCount,
    warningCount,
    exitCode: errorCount > 0 ? 1 : 0
  };
}

if (require.main === module) {
  const { exitCode } = runEnvCheck();
  process.exit(exitCode);
}

module.exports = {
  runEnvCheck
};
