/**
 * Honesty pins for the shipped Docker/nginx surface and
 * docs/BUILD_OPTIMIZATION_GUIDE.md (round 916).
 *
 * Two defect classes sealed here:
 *  - Permissions-Policy must not deny the microphone the product's core
 *    voice-command feature needs (same class as the netlify.toml fix).
 *  - Config/docs must not describe asset classes or modules that cannot
 *    exist (dead extension lists, deleted WebGPURenderer/TextureManager
 *    examples, phantom KTX2/fonts audio pipelines).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Extensions actually shippable: files under public/ plus Vite-emitted js/css.
const shippedExts = new Set(
  fs
    .readdirSync(path.join(ROOT, 'public'), { recursive: true })
    .filter((f) => fs.statSync(path.join(ROOT, 'public', f)).isFile())
    .map((f) => f.split('.').pop().toLowerCase())
);
shippedExts.delete('gitkeep');
for (const ext of ['js', 'css']) shippedExts.add(ext);

describe('docker/nginx.conf honesty (round 916)', () => {
  const nginx = read('docker/nginx.conf');

  test('shipped container permits the microphone voice commands require', () => {
    expect(nginx).toMatch(/microphone=\(self\)/);
    expect(nginx).not.toMatch(/microphone=\(\)/);
  });

  test('static-extension cache locations only cover asset classes that exist', () => {
    const groups = [...nginx.matchAll(/location\s+~\*?\s+\\\.\(([^)]+)\)\$/g)].map((m) => m[1].split('|'));
    expect(groups.length).toBeGreaterThan(0);
    const dead = groups.flat().filter((ext) => !shippedExts.has(ext));
    expect(dead).toEqual([]);
  });
});

describe('docs/BUILD_OPTIMIZATION_GUIDE.md honesty (round 916)', () => {
  const doc = read('docs/BUILD_OPTIMIZATION_GUIDE.md');

  test('does not reference deleted modules or APIs', () => {
    expect(doc).not.toMatch(/WebGPURenderer/);
    expect(doc).not.toMatch(/textureManager/i);
    expect(doc).not.toMatch(/loadTexture/);
  });

  test('does not keep ktx2 inside runnable config or code examples', () => {
    expect(doc).not.toMatch(/['"][^'"]*\.ktx2/);
    expect(doc).not.toMatch(/\*\.ktx2/);
    expect(doc).not.toMatch(/\|\s*ktx2\b/);
    expect(doc).not.toMatch(/\bktx2\b\s*\|/);
  });

  test('the shipped-state checklist contains no false completed asset claims', () => {
    expect(doc).not.toMatch(
      /\[x\]\s+(?:Images optimized|Fonts subsetted|Textures compressed|SVGs minified|Audio files compressed)/
    );
  });

  test('unshipped asset pipelines are marked as such', () => {
    const texture = doc.match(/#### Texture Compression([\s\S]*?)(?:\n####|\n###)/);
    expect(texture).not.toBeNull();
    expect(texture[1]).toMatch(/not ship|removed|no texture assets/i);
    const font = doc.match(/#### Font Subsetting([\s\S]*?)(?:\n####|\n###)/);
    expect(font).not.toBeNull();
    expect(font[1]).toMatch(/not ship|no font assets|does not ship/i);
  });
});
