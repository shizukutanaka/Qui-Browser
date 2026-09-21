/**
 * Generate PWA icons and favicons from assets/icon.svg.
 *
 * Usage: node tools/generate-icons.mjs
 * Requires: sharp (devDependency)
 *
 * The single source of truth is assets/icon.svg (512x512). Every output is a
 * file that is actually referenced:
 *  - public/icons/icon-<n>.png  — the manifest's seven icon srcs (served
 *    verbatim from public/)
 *  - assets/icons/favicon-*, apple-touch-icon.png — index.html <link> refs
 *    (bundled/hashed by Vite)
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svgPath = join(root, 'assets', 'icon.svg');
const publicIconsDir = join(root, 'public', 'icons');
const viteIconsDir = join(root, 'assets', 'icons');

// Square app/PWA icons -> public/icons/icon-<n>.png (manifest srcs)
const ICON_SIZES = [72, 96, 128, 144, 192, 384, 512];
// Favicons + apple touch icon -> assets/icons/ (index.html link refs)
const NAMED = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 }
];

async function main() {
  await mkdir(publicIconsDir, { recursive: true });
  await mkdir(viteIconsDir, { recursive: true });

  for (const size of ICON_SIZES) {
    await sharp(svgPath).resize(size, size).png().toFile(join(publicIconsDir, `icon-${size}.png`));
  }
  for (const { name, size } of NAMED) {
    await sharp(svgPath).resize(size, size).png().toFile(join(viteIconsDir, name));
  }

  const total = ICON_SIZES.length + NAMED.length;
  console.log(`Generated ${total} assets from ${svgPath}`);
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
