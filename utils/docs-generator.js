'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATE_FILENAME = 'operations-template.md';
const TEMPLATE_DIR = path.join(__dirname, '..', 'docs', 'templates');
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'docs');

/**
 * Generate an operations guide from the template.
 * @param {object} options
 * @param {string} options.locale Locale directory name (e.g. `fr`).
 * @param {string} options.language Language label for template replacement.
 * @param {string} [options.output] Optional absolute or relative output path.
 * @param {boolean} [options.force] Overwrite existing file when true.
 * @returns {{ outputPath: string }}
 */
function generateOperationsGuide(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('generateOperationsGuide requires an options object');
  }

  const { locale, language, output, force = false } = options;

  if (!locale || typeof locale !== 'string') {
    throw new Error('`locale` is required (e.g. "fr")');
  }

  if (!language || typeof language !== 'string') {
    throw new Error('`language` is required (e.g. "Français")');
  }

  const templatePath = path.join(TEMPLATE_DIR, TEMPLATE_FILENAME);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const template = fs.readFileSync(templatePath, 'utf8');

  const outputPath = output ? path.resolve(output) : path.join(DEFAULT_OUTPUT_DIR, locale, 'operations.md');

  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  if (!force && fs.existsSync(outputPath)) {
    throw new Error(`File already exists: ${outputPath} (use --force to overwrite)`);
  }

  const document = template.replace(/<LANGUAGE>/g, language);

  fs.writeFileSync(outputPath, document, 'utf8');

  return { outputPath };
}

module.exports = {
  generateOperationsGuide,
  TEMPLATE_FILENAME,
  TEMPLATE_DIR
};
