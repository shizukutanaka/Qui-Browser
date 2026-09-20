/**
 * Vite Configuration for Production Build
 * Optimized for Qui Browser VR v2.0.0
 *
 * John Carmack principle: Ship fast, optimize later
 */

import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // Base public path. Defaults to '/' (root-served: local dev, Netlify,
  // Vercel, custom domain). GitHub Pages serves under a repo subpath
  // (https://<user>.github.io/Qui-Browser/), so the Pages workflow sets
  // BASE_PATH=/Qui-Browser/ for that build only — keeping every other
  // target root-served and unaffected.
  base: process.env.BASE_PATH || '/',
  publicDir: 'public',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Disable in production for smaller size
    emptyOutDir: true,

    // Rollup options
    rollupOptions: {
      // Sentry is an optional, account-gated dependency loaded lazily by
      // src/monitoring.js. It is NOT installed/bundled by default; mark it
      // external so the build succeeds without it (the dynamic import is
      // wrapped in try/catch and only runs when a DSN is configured). To
      // actually enable Sentry: `npm i @sentry/browser @sentry/tracing
      // @sentry/replay`, remove these from this external list, and set the
      // SENTRY DSN. web-vitals IS installed and bundled normally.
      external: ['@sentry/browser', '@sentry/tracing', '@sentry/replay'],
      output: {
        // Manual chunks for better caching
        manualChunks: {
          // Three.js and WebXR in separate chunk
          'vendor-three': ['three'],

          // Tier 1 optimizations
          'tier1': [
            '/src/vr/rendering/FFRSystem.js',
            '/src/vr/comfort/ComfortSystem.js',
            '/src/utils/TextureManager.js'
          ],

          // Tier 2 features (lazy loaded)
          'tier2-input': ['/src/vr/input/JapaneseIME.js'],
          'tier2-interaction': ['/src/vr/interaction/HandTracking.js'],
          'tier2-audio': ['/src/vr/audio/SpatialAudio.js']
        },

        // Asset file naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];

          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }

          if (/woff2?|ttf|otf|eot/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }

          if (/ktx2|basis/i.test(ext)) {
            return `assets/textures/[name]-[hash][extname]`;
          }

          return `assets/[name]-[hash][extname]`;
        },

        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js'
      }
    },

    // Target modern browsers that support WebXR
    target: ['chrome90', 'firefox88', 'safari14'],

    // The vendored three.js chunk is intentionally ~550 kB; keep the warning
    // threshold above it so a genuinely oversized chunk still stands out.
    chunkSizeWarningLimit: 1000
  },

  // Development server
  server: {
    host: true,  // Allow external connections (for Quest)
    port: 5173,
    headers: {
      // Security headers
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block'
    }
  },

  // Preview server (for testing production build)
  preview: {
    host: true,
    port: 8080
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['three']
  },

  // Build optimizations
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    drop: ['console', 'debugger'],
    legalComments: 'none'
  }
});