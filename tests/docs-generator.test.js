'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');

const { generateOperationsGuide, TEMPLATE_DIR } = require('../utils/docs-generator.js');

let tempDir;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qui-docs-'));
});

afterEach(() => {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('generateOperationsGuide creates file with language placeholder replaced', () => {
  const outputPath = path.join(tempDir, 'fr', 'operations.md');
  const result = generateOperationsGuide({
    locale: 'fr',
    language: 'Français',
    output: outputPath,
    force: true
  });

  assert.equal(result.outputPath, outputPath);
  const content = fs.readFileSync(outputPath, 'utf8');

  assert.match(content, /^# Français/m, 'language placeholder should be replaced');
  assert.ok(!content.includes('<LANGUAGE>'), 'no language placeholder should remain');
});

test('generateOperationsGuide throws when file exists and force not provided', () => {
  const outputPath = path.join(tempDir, 'es', 'operations.md');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, 'existing');

  assert.throws(() => {
    generateOperationsGuide({
      locale: 'es',
      language: 'Español',
      output: outputPath
    });
  }, /File already exists/);
});

test('generateOperationsGuide uses default output directory when output not provided', () => {
  const defaultOutput = path.join(TEMPLATE_DIR, '..', 'fr', 'operations.md');
  fs.rmSync(path.dirname(defaultOutput), { recursive: true, force: true });

  const result = generateOperationsGuide({
    locale: 'fr',
    language: 'Français',
    force: true
  });

  assert.equal(result.outputPath, defaultOutput);
  const content = fs.readFileSync(defaultOutput, 'utf8');
  assert.match(content, /^# Français/m);

  // cleanup to avoid polluting repo
  fs.rmSync(path.dirname(defaultOutput), { recursive: true, force: true });
});
