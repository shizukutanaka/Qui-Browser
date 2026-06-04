/**
 * Generate PWA icons, favicons and social images from assets/icon.svg.
 *
 * Usage: node tools/generate-icons.mjs
 * Requires: sharp (devDependency)
 *
 * The single source of truth is assets/icon.svg (512x512). All raster assets
 * referenced by manifest.json and index.html are derived from it so they stay
 * in sync and never 404.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svgPath = join(root, 'assets', 'icon.svg');
const iconsDir = join(root, 'assets', 'icons');
const imagesDir = join(root, 'assets', 'images');

// Square app/PWA icons -> assets/icons/icon-<n>.png
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
// Favicons + apple touch icon -> assets/icons/
const NAMED = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 }
];
// Social share images (summary_large_image) -> assets/images/
const SOCIAL = ['og-image.png', 'twitter-card.png'];

const brandBg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
     <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#764ba2"/>
     </linearGradient></defs>
     <rect width="1200" height="630" fill="url(#g)"/>
   </svg>`
);

async function main() {
  await mkdir(iconsDir, { recursive: true });
  await mkdir(imagesDir, { recursive: true });

  for (const size of ICON_SIZES) {
    await sharp(svgPath).resize(size, size).png().toFile(join(iconsDir, `icon-${size}.png`));
  }
  for (const { name, size } of NAMED) {
    await sharp(svgPath).resize(size, size).png().toFile(join(iconsDir, name));
  }

  // Social cards: brand gradient with the icon centered.
  const badge = await sharp(svgPath).resize(320, 320).png().toBuffer();
  for (const name of SOCIAL) {
    await sharp(brandBg)
      .composite([{ input: badge, gravity: 'center' }])
      .png()
      .toFile(join(imagesDir, name));
  }

  const total = ICON_SIZES.length + NAMED.length + SOCIAL.length;
  console.log(`Generated ${total} assets from ${svgPath}`);
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
