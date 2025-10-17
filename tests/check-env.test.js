'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');

const { runEnvCheck } = require('../scripts/check-env.js');

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qui-envcheck-'));
});

afterEach(() => {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function writeEnvFile(filename, lines) {
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  return filePath;
}

test('runEnvCheck returns ok when environment is fully configured', () => {
  const envPath = writeEnvFile('ok.env', [
    'NODE_ENV=production',
    'PORT=8080',
    'STRIPE_PUBLISHABLE_KEY=pk_live_validkey',
    'STRIPE_SECRET_KEY=sk_live_validkey',
    'STRIPE_WEBHOOK_SECRET=whsec_validsecret',
    'BILLING_ADMIN_TOKEN=abcdefghijklmnop',
    'ENABLE_SECURITY_HEADERS=true',
    'STRIPE_SUCCESS_URL=https://vr.example.com/success',
    'STRIPE_CANCEL_URL=https://vr.example.com/cancel',
    'ALLOWED_ORIGINS=https://vr.example.com',
    'LIGHTWEIGHT=false'
  ]);

  const result = runEnvCheck({ envPath, silent: true });

  assert.equal(result.exitCode, 0);
  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 0);
});

test('runEnvCheck surfaces warnings without errors for relaxed configuration', () => {
  const envPath = writeEnvFile('warn.env', [
    'NODE_ENV=production',
    'PORT=9000',
    'STRIPE_PUBLISHABLE_KEY=pk_live_validkey',
    'STRIPE_SECRET_KEY=sk_live_validkey',
    'STRIPE_WEBHOOK_SECRET=whsec_validsecret',
    'BILLING_ADMIN_TOKEN=abcdefghijklmnop',
    'ENABLE_SECURITY_HEADERS=true',
    'STRIPE_SUCCESS_URL=',
    'STRIPE_CANCEL_URL=',
    'ALLOWED_ORIGINS=*',
    'LIGHTWEIGHT=true'
  ]);

  const result = runEnvCheck({ envPath, silent: true });

  assert.equal(result.exitCode, 0, 'warnings should not set a failing exit code');
  assert.equal(result.errorCount, 0, 'no errors expected');
  assert.ok(result.warningCount >= 1, 'warnings should be reported');
});

test('runEnvCheck reports errors for invalid numeric configuration', () => {
  const envPath = writeEnvFile('invalid-numeric.env', [
    'NODE_ENV=production',
    'PORT=8080',
    'STRIPE_PUBLISHABLE_KEY=pk_live_validkey',
    'STRIPE_SECRET_KEY=sk_live_validkey',
    'STRIPE_WEBHOOK_SECRET=whsec_validsecret',
    'BILLING_ADMIN_TOKEN=abcdefghijklmnop',
    'ENABLE_SECURITY_HEADERS=true',
    'STRIPE_SUCCESS_URL=https://example.com/success',
    'STRIPE_CANCEL_URL=https://example.com/cancel',
    'ALLOWED_ORIGINS=https://example.com',
    'RATE_LIMIT_MAX=not-a-number',
    'NOTIFICATION_ENABLED=true',
    'NOTIFICATION_WEBHOOKS=https://hooks.example.com/notify'
  ]);

  const result = runEnvCheck({ envPath, silent: true });

  assert.equal(result.exitCode, 1, 'numeric parsing errors should fail');
  const numericError = result.results.find(item => item.titleEn.includes('Rate limit maximum requests'));
  assert.ok(numericError, 'should include numeric validation error');
  assert.equal(numericError.status, 'error');
});

test('runEnvCheck enforces HTTPS webhook URLs when notifications enabled', () => {
  const envPath = writeEnvFile('webhook.env', [
    'NODE_ENV=production',
    'PORT=8080',
    'STRIPE_PUBLISHABLE_KEY=pk_live_validkey',
    'STRIPE_SECRET_KEY=sk_live_validkey',
    'STRIPE_WEBHOOK_SECRET=whsec_validsecret',
    'BILLING_ADMIN_TOKEN=abcdefghijklmnop',
    'ENABLE_SECURITY_HEADERS=true',
    'STRIPE_SUCCESS_URL=https://example.com/success',
    'STRIPE_CANCEL_URL=https://example.com/cancel',
    'ALLOWED_ORIGINS=https://example.com',
    'RATE_LIMIT_MAX=100',
    'RATE_LIMIT_WINDOW=60000',
    'RATE_LIMIT_MAX_ENTRIES=1000',
    'NOTIFICATION_ENABLED=true',
    'NOTIFICATION_TIMEOUT_MS=5000',
    'NOTIFICATION_BATCH_WINDOW_MS=0',
    'NOTIFICATION_RETRY_LIMIT=3',
    'NOTIFICATION_RETRY_BACKOFF_MS=200',
    'NOTIFICATION_MIN_LEVEL=warning',
    'NOTIFICATION_WEBHOOKS=http://insecure.example.com/webhook,https://valid.example.com/webhook'
  ]);

  const result = runEnvCheck({ envPath, silent: true });

  assert.equal(result.exitCode, 1, 'insecure webhook should fail the check');
  const webhookError = result.results.find(item => item.titleEn === 'Notification webhook endpoints');
  assert.ok(webhookError, 'should report webhook validation issue');
  assert.equal(webhookError.status, 'error');
});

test('runEnvCheck reports errors when required secrets are missing', () => {
  const envPath = path.join(tempDir, 'missing.env');

  const result = runEnvCheck({ envPath, silent: true });

  assert.equal(result.exitCode, 1);
  assert.ok(result.errorCount >= 1, 'at least one error expected');
  const presenceResult = result.results.find(item => item.titleEn === '.env file presence');
  assert.ok(presenceResult, 'should include .env presence result');
  assert.equal(presenceResult.status, 'error');
});
