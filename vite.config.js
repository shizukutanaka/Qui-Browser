/**
 * Vite Configuration for Production Build
 * Optimized for Qui Browser VR v2.0.0
 *
 * John Carmack principle: Ship fast, optimize later
 */

import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { terser } from 'rollup-plugin-terser';

export default defineConfig({
  root: '.',
  base: '/',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Disable in production for smaller size
    minify: 'terser',

    // Rollup options
    rollupOptions: {
      output: {
        // Manual chunks for better caching
        manualChunks: {
          // Three.js and WebXR in separate chunk
          'vendor-three': ['three'],

          // Tier 1 optimizations
          'tier1': [
            '/src/vr/rendering/FFRSystem.js',
            '/src/vr/comfort/ComfortSystem.js',
            '/src/utils/ObjectPool.js',
            '/src/utils/TextureManager.js'
          ],

          // Tier 2 features (lazy loaded)
          'tier2-input': ['/src/vr/input/JapaneseIME.js'],
          'tier2-interaction': ['/src/vr/interaction/HandTracking.js'],
          'tier2-audio': ['/src/vr/audio/SpatialAudio.js'],
          'tier2-ar': ['/src/vr/ar/MixedReality.js'],
          'tier2-loading': ['/src/utils/ProgressiveLoader.js']
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
      },

      plugins: [
        terser({
          compress: {
            drop_console: true,      // Remove console.log in production
            drop_debugger: true,
            passes: 2,
            pure_funcs: ['console.log', 'console.info']
          },
          mangle: {
            properties: false  // Don't mangle property names (breaks Three.js)
          },
          format: {
            comments: false
          }
        })
      ]
    },

    // Target modern browsers that support WebXR
    target: ['chrome90', 'firefox88', 'safari14'],

    // Optimize chunk size
    chunkSizeWarningLimit: 1000, // 1MB warning

    // Asset inlining threshold
    assetsInlineLimit: 4096 // 4KB
  },

  // Development server
  server: {
    host: true,  // Allow external connections (for Quest)
    port: 5173,
    https: false, // Use ngrok for HTTPS in development
    cors: true,

    headers: {
      // Required for SharedArrayBuffer (if using)
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',

      // Security headers
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block'
    }
  },

  // Preview server (for testing production build)
  preview: {
    host: true,
    port: 8080,
    https: false,
    cors: true
  },

  // Plugins
  plugins: [
    // Support older browsers if needed
    legacy({
      targets: ['defaults', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    })
  ],

  // Optimize dependencies
  optimizeDeps: {
    include: ['three'],
    exclude: ['@tensorflow/tfjs'] // Large, load on demand
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify('2.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __PRODUCTION__: true
  },

  // Module resolution
  resolve: {
    alias: {
      '@': '/src',
      '@vr': '/src/vr',
      '@utils': '/src/utils',
      '@assets': '/assets'
    },
    extensions: ['.js', '.jsx', '.json', '.wasm']
  },

  // CSS handling
  css: {
    postcss: {
      plugins: []
    },
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`
      }
    }
  },

  // Worker configuration
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'workers/[name]-[hash].js'
      }
    }
  },

  // Build optimizations
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    drop: ['console', 'debugger'],
    legalComments: 'none'
  }
});