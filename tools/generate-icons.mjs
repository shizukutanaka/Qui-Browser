/**
 * Generate PWA icons and favicons from assets/icon.svg.
 *
 * Usage: node tools/generate-icons.mjs
 * Requires: sharp (devDependency)
 *
 * The single source of truth is assets/icon.svg (512x512). Every raster asset
 * referenced by the manifest and index.html is derived from it so they stay in
 * sync and never 404.
 *
 * Output locations are NOT interchangeable:
 *   - PWA icons go to public/assets/icons/, because Vite's publicDir is
 *     public/ and copies it verbatim. They used to be written to
 *     assets/icons/, which the build never sees, so all seven 404'd in the
 *     shipped app for as long as the manifest has existed.
 *   - Favicons stay in assets/icons/: index.html references them directly, so
 *     Vite resolves and hashes them as part of the module graph.
 * `npm run verify:app` fails if a manifest asset is missing from the build.
 *
 * Social share images (og:image / twitter:image) used to be generated here and
 * were removed: nothing referenced them, and wiring them correctly needs an
 * absolute URL, which means a canonical deploy origin the build does not have
 * (base is relative so one artefact serves Pages, Netlify and Vercel alike).
 * Add them back together with that origin, not before.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svgPath = join(root, 'assets', 'icon.svg');
const iconsDir = join(root, 'public', 'assets', 'icons'); // shipped verbatim by Vite
const faviconDir = join(root, 'assets', 'icons'); // referenced from index.html, hashed by Vite

// Square app/PWA icons -> public/assets/icons/icon-<n>.png
// Every size here must appear in public/manifest.json — verify:app fails on a
// manifest entry with no file, and an unreferenced file is dead weight shipped.
// 152 was generated for years and never listed; apple-touch-icon (180) covers iOS.
const ICON_SIZES = [72, 96, 128, 144, 192, 384, 512];
// Favicons + apple touch icon -> assets/icons/ (index.html references these)
const NAMED = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 }
];

async function main() {
  await mkdir(iconsDir, { recursive: true });
  await mkdir(faviconDir, { recursive: true });

  for (const size of ICON_SIZES) {
    await sharp(svgPath).resize(size, size).png().toFile(join(iconsDir, `icon-${size}.png`));
  }
  for (const { name, size } of NAMED) {
    await sharp(svgPath).resize(size, size).png().toFile(join(faviconDir, name));
  }

  const total = ICON_SIZES.length + NAMED.length;
  console.log(`Generated ${total} assets from ${svgPath}`);
  console.log(`  ${ICON_SIZES.length} PWA icons -> ${iconsDir}`);
  console.log(`  ${NAMED.length} favicons    -> ${faviconDir}`);
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
