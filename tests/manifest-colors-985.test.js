/**
 * manifest brand colors must match the app's canonical color tokens.
 *
 * The PWA manifest's `theme_color` / `background_color` drive the installed
 * app's toolbar tint and launch splash. index.html declares the same brand
 * color via <meta name="theme-color"> and src/styles/main.css defines the
 * canonical --color-primary / --color-background tokens. When the manifest
 * disagrees, the installed app shows a different tint and a white splash
 * that flashes before the dark UI loads.
 */

const { readFileSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'public/manifest.json'), 'utf8'));
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
const css = readFileSync(join(ROOT, 'src/styles/main.css'), 'utf8');

function cssToken(name) {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1].toLowerCase() : null;
}

function metaThemeColor() {
  const m = indexHtml.match(/<meta\s+name="theme-color"\s+content="(#[0-9a-fA-F]{6})"/);
  return m ? m[1].toLowerCase() : null;
}

describe('manifest brand colors', () => {
  test('theme_color matches the --color-primary token', () => {
    expect(cssToken('--color-primary')).not.toBeNull();
    expect(manifest.theme_color.toLowerCase()).toBe(cssToken('--color-primary'));
  });

  test('theme_color matches the index.html meta theme-color', () => {
    expect(metaThemeColor()).not.toBeNull();
    expect(manifest.theme_color.toLowerCase()).toBe(metaThemeColor());
  });

  test('background_color matches the --color-background token', () => {
    expect(cssToken('--color-background')).not.toBeNull();
    expect(manifest.background_color.toLowerCase()).toBe(cssToken('--color-background'));
  });
});
