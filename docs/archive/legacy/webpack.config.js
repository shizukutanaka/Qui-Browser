const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',

    // Entry points for different bundles
    entry: {
      // Core bundle - always loaded
      core: [
        './assets/js/unified-performance-system.js',
        './assets/js/unified-security-system.js',
        './assets/js/unified-error-handler.js',
        './assets/js/ui-components.js',
        './assets/js/accessibility.js'
      ],

      // VR bundle - loaded on demand (unified systems)
      vr: [
        './assets/js/unified-vr-extension-system.js',
        './assets/js/vr-launcher.js',
        './assets/js/vr-utils.js',
        './assets/js/vr-settings.js',
        './assets/js/vr-ui-system.js',
        './assets/js/vr-input-system.js',
        './assets/js/vr-navigation-system.js',
        './assets/js/vr-media-system.js',
        './assets/js/vr-system-monitor.js'
      ],

      // Enhancement bundle - loaded in background
      enhancements: [
        './assets/js/cross-platform-optimizer.js',
        './assets/js/ux-enhancer.js',
        './assets/js/plugin-system.js'
      ]
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash:8].js' : '[name].js',
      chunkFilename: isProduction ? '[name].[contenthash:8].chunk.js' : '[name].chunk.js',
      publicPath: '/'
    },

    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: {
                    browsers: [
                      'last 2 Chrome versions',
                      'last 2 Firefox versions',
                      'last 2 Safari versions'
                    ]
                  },
                  modules: false,
                  useBuiltIns: 'usage',
                  corejs: 3
                }]
              ],
              plugins: [
                '@babel/plugin-syntax-dynamic-import',
                '@babel/plugin-proposal-optional-chaining',
                '@babel/plugin-proposal-nullish-coalescing-operator'
              ]
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg|webp)$/,
          type: 'asset/resource',
          generator: {
            filename: 'images/[name].[hash:8][ext]'
          }
        },
        {
          test: /\.(woff|woff2|ttf|eot)$/,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[name].[hash:8][ext]'
          }
        }
      ]
    },

    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info'],
              passes: 2
            },
            mangle: {
              safari10: true
            },
            format: {
              comments: false
            }
          },
          extractComments: false
        })
      ],

      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            reuseExistingChunk: true
          },
          common: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true
          },
          three: {
            test: /[\\/]node_modules[\\/]three/,
            name: 'three',
            priority: 10,
            reuseExistingChunk: true
          }
        }
      },

      runtimeChunk: 'single',
      moduleIds: 'deterministic'
    },

    plugins: [
      new CleanWebpackPlugin(),

      new HtmlWebpackPlugin({
        template: './index-optimized.html',
        filename: 'index.html',
        chunks: ['core'],
        minify: isProduction ? {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
          minifyURLs: true
        } : false
      }),

      ...(isProduction ? [
        new CompressionPlugin({
          filename: '[path][base].gz',
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 8192,
          minRatio: 0.8
        }),

        new CompressionPlugin({
          filename: '[path][base].br',
          algorithm: 'brotliCompress',
          test: /\.(js|css|html|svg)$/,
          compressionOptions: {
            level: 11
          },
          threshold: 8192,
          minRatio: 0.8
        })
      ] : []),

      ...(process.env.ANALYZE === 'true' ? [
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: 'bundle-report.html'
        })
      ] : [])
    ],

    resolve: {
      extensions: ['.js', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'assets/js'),
        '@core': path.resolve(__dirname, 'assets/js/core'),
        '@vr': path.resolve(__dirname, 'assets/js/vr'),
        '@utils': path.resolve(__dirname, 'assets/js/utils')
      }
    },

    devServer: {
      static: {
        directory: path.join(__dirname, 'public')
      },
      compress: true,
      port: 8080,
      hot: true,
      open: true,
      historyApiFallback: true,
      https: false,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
      }
    },

    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
      assetFilter: function(assetFilename) {
        return assetFilename.endsWith('.js');
      }
    },

    devtool: isProduction ? 'source-map' : 'eval-source-map',

    stats: {
      colors: true,
      chunks: false,
      modules: false,
      children: false,
      warnings: true,
      errors: true,
      errorDetails: true,
      performance: true
    }
  };
};