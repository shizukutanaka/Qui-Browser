#!/usr/bin/env node

/**
 * Static Asset Precompression Pipeline
 * Pre-compress static files for optimal performance
 * Priority: H007 from improvement backlog
 *
 * @module scripts/precompress-assets
 */

const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const crypto = require('crypto');

const brotliCompress = promisify(zlib.brotliCompress);
const gzipCompress = promisify(zlib.gzip);

class AssetPrecompressor {
  constructor(options = {}) {
    this.options = {
      inputDir: options.inputDir || './assets',
      outputDir: options.outputDir || './public',
      enableBrotli: options.enableBrotli !== false,
      enableGzip: options.enableGzip !== false,
      minFileSize: options.minFileSize || 1024, // 1KB minimum
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB maximum
      extensions: options.extensions || ['.js', '.css', '.html', '.svg', '.json', '.xml'],
      brotliQuality: options.brotliQuality || 11, // Max quality
      gzipLevel: options.gzipLevel || 9, // Max compression
      preserveOriginal: options.preserveOriginal !== false,
      generateManifest: options.generateManifest !== false,
      verbose: options.verbose || false,
      ...options
    };

    this.stats = {
      totalFiles: 0,
      compressedFiles: 0,
      skippedFiles: 0,
      totalOriginalSize: 0,
      totalBrotliSize: 0,
      totalGzipSize: 0,
      errors: []
    };

    this.manifest = {
      generated: new Date().toISOString(),
      files: []
    };
  }

  /**
   * Run precompression pipeline
   */
  async run() {
    console.log('[AssetPrecompressor] Starting precompression...\n');

    try {
      // Ensure output directory exists
      await fs.mkdir(this.options.outputDir, { recursive: true });

      // Find all files
      const files = await this.findFiles(this.options.inputDir);
      console.log(`Found ${files.length} files to process\n`);

      // Process each file
      for (const file of files) {
        await this.processFile(file);
      }

      // Generate manifest
      if (this.options.generateManifest) {
        await this.saveManifest();
      }

      // Print summary
      this.printSummary();

      return {
        success: true,
        stats: this.stats
      };
    } catch (error) {
      console.error('[AssetPrecompressor] Fatal error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find all files in directory
   * @param {string} dir - Directory path
   * @returns {Promise<Array>} File paths
   */
  async findFiles(dir) {
    const files = [];

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }

        const subFiles = await this.findFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (this.options.extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Process single file
   * @param {string} filePath - File path
   */
  async processFile(filePath) {
    this.stats.totalFiles++;

    try {
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      // Check file size limits
      if (fileSize < this.options.minFileSize) {
        if (this.options.verbose) {
          console.log(`[SKIP] ${filePath} (too small: ${this.formatSize(fileSize)})`);
        }
        this.stats.skippedFiles++;
        return;
      }

      if (fileSize > this.options.maxFileSize) {
        if (this.options.verbose) {
          console.log(`[SKIP] ${filePath} (too large: ${this.formatSize(fileSize)})`);
        }
        this.stats.skippedFiles++;
        return;
      }

      // Read file
      const content = await fs.readFile(filePath);
      this.stats.totalOriginalSize += fileSize;

      // Calculate relative path for output
      const relativePath = path.relative(this.options.inputDir, filePath);
      const outputPath = path.join(this.options.outputDir, relativePath);

      // Ensure output directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // Copy original file
      if (this.options.preserveOriginal) {
        await fs.copyFile(filePath, outputPath);
      }

      const fileInfo = {
        path: relativePath,
        originalSize: fileSize,
        hash: this.calculateHash(content),
        compressed: {}
      };

      // Brotli compression
      if (this.options.enableBrotli) {
        const brotliContent = await this.compressBrotli(content);
        const brotliSize = brotliContent.length;
        const brotliRatio = ((1 - brotliSize / fileSize) * 100).toFixed(2);

        if (brotliSize < fileSize) {
          await fs.writeFile(`${outputPath}.br`, brotliContent);
          this.stats.totalBrotliSize += brotliSize;

          fileInfo.compressed.brotli = {
            size: brotliSize,
            ratio: brotliRatio + '%',
            savings: this.formatSize(fileSize - brotliSize)
          };

          if (this.options.verbose) {
            console.log(`[BR] ${relativePath} (${this.formatSize(fileSize)} → ${this.formatSize(brotliSize)}, -${brotliRatio}%)`);
          }
        }
      }

      // Gzip compression
      if (this.options.enableGzip) {
        const gzipContent = await this.compressGzip(content);
        const gzipSize = gzipContent.length;
        const gzipRatio = ((1 - gzipSize / fileSize) * 100).toFixed(2);

        if (gzipSize < fileSize) {
          await fs.writeFile(`${outputPath}.gz`, gzipContent);
          this.stats.totalGzipSize += gzipSize;

          fileInfo.compressed.gzip = {
            size: gzipSize,
            ratio: gzipRatio + '%',
            savings: this.formatSize(fileSize - gzipSize)
          };

          if (this.options.verbose) {
            console.log(`[GZ] ${relativePath} (${this.formatSize(fileSize)} → ${this.formatSize(gzipSize)}, -${gzipRatio}%)`);
          }
        }
      }

      this.manifest.files.push(fileInfo);
      this.stats.compressedFiles++;
    } catch (error) {
      console.error(`[ERROR] Failed to process ${filePath}:`, error.message);
      this.stats.errors.push({
        file: filePath,
        error: error.message
      });
    }
  }

  /**
   * Compress with Brotli
   * @param {Buffer} content - Content to compress
   * @returns {Promise<Buffer>} Compressed content
   */
  async compressBrotli(content) {
    return brotliCompress(content, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: this.options.brotliQuality,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: content.length
      }
    });
  }

  /**
   * Compress with Gzip
   * @param {Buffer} content - Content to compress
   * @returns {Promise<Buffer>} Compressed content
   */
  async compressGzip(content) {
    return gzipCompress(content, {
      level: this.options.gzipLevel
    });
  }

  /**
   * Calculate file hash
   * @param {Buffer} content - File content
   * @returns {string} Hash string
   */
  calculateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Format bytes to human readable
   * @param {number} bytes - Byte count
   * @returns {string} Formatted size
   */
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Save compression manifest
   */
  async saveManifest() {
    const manifestPath = path.join(this.options.outputDir, 'compression-manifest.json');

    await fs.writeFile(
      manifestPath,
      JSON.stringify(this.manifest, null, 2),
      'utf8'
    );

    console.log(`\n[AssetPrecompressor] Manifest saved: ${manifestPath}`);
  }

  /**
   * Print summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('Precompression Summary');
    console.log('='.repeat(60));
    console.log(`Total files processed:     ${this.stats.totalFiles}`);
    console.log(`Files compressed:          ${this.stats.compressedFiles}`);
    console.log(`Files skipped:             ${this.stats.skippedFiles}`);
    console.log(`Errors:                    ${this.stats.errors.length}`);
    console.log();
    console.log(`Original size:             ${this.formatSize(this.stats.totalOriginalSize)}`);

    if (this.options.enableBrotli) {
      const brotliRatio = ((1 - this.stats.totalBrotliSize / this.stats.totalOriginalSize) * 100).toFixed(2);
      const brotliSavings = this.stats.totalOriginalSize - this.stats.totalBrotliSize;
      console.log(`Brotli compressed size:    ${this.formatSize(this.stats.totalBrotliSize)} (-${brotliRatio}%)`);
      console.log(`Brotli savings:            ${this.formatSize(brotliSavings)}`);
    }

    if (this.options.enableGzip) {
      const gzipRatio = ((1 - this.stats.totalGzipSize / this.stats.totalOriginalSize) * 100).toFixed(2);
      const gzipSavings = this.stats.totalOriginalSize - this.stats.totalGzipSize;
      console.log(`Gzip compressed size:      ${this.formatSize(this.stats.totalGzipSize)} (-${gzipRatio}%)`);
      console.log(`Gzip savings:              ${this.formatSize(gzipSavings)}`);
    }

    console.log('='.repeat(60) + '\n');

    if (this.stats.errors.length > 0) {
      console.log('Errors:');
      this.stats.errors.forEach(err => {
        console.log(`  - ${err.file}: ${err.error}`);
      });
      console.log();
    }
  }

  /**
   * Get compression middleware for Express
   * @returns {Function} Express middleware
   */
  static middleware() {
    return (req, res, next) => {
      const acceptEncoding = req.headers['accept-encoding'] || '';
      const url = req.url.split('?')[0]; // Remove query string

      // Try Brotli first
      if (acceptEncoding.includes('br')) {
        const brotliPath = path.join(process.cwd(), 'public', url + '.br');
        fs.access(brotliPath)
          .then(() => {
            res.setHeader('Content-Encoding', 'br');
            res.setHeader('Vary', 'Accept-Encoding');
            req.url = url + '.br';
            next();
          })
          .catch(() => {
            // Try Gzip
            if (acceptEncoding.includes('gzip')) {
              const gzipPath = path.join(process.cwd(), 'public', url + '.gz');
              fs.access(gzipPath)
                .then(() => {
                  res.setHeader('Content-Encoding', 'gzip');
                  res.setHeader('Vary', 'Accept-Encoding');
                  req.url = url + '.gz';
                  next();
                })
                .catch(() => next());
            } else {
              next();
            }
          });
      } else if (acceptEncoding.includes('gzip')) {
        const gzipPath = path.join(process.cwd(), 'public', url + '.gz');
        fs.access(gzipPath)
          .then(() => {
            res.setHeader('Content-Encoding', 'gzip');
            res.setHeader('Vary', 'Accept-Encoding');
            req.url = url + '.gz';
            next();
          })
          .catch(() => next());
      } else {
        next();
      }
    };
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v')
  };

  // Parse input/output dirs
  const inputIndex = args.indexOf('--input') >= 0 ? args.indexOf('--input') : args.indexOf('-i');
  if (inputIndex >= 0 && args[inputIndex + 1]) {
    options.inputDir = args[inputIndex + 1];
  }

  const outputIndex = args.indexOf('--output') >= 0 ? args.indexOf('--output') : args.indexOf('-o');
  if (outputIndex >= 0 && args[outputIndex + 1]) {
    options.outputDir = args[outputIndex + 1];
  }

  const compressor = new AssetPrecompressor(options);

  compressor.run()
    .then(result => {
      if (result.success) {
        console.log('✓ Precompression completed successfully\n');
        process.exit(0);
      } else {
        console.error('✗ Precompression failed\n');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('✗ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = AssetPrecompressor;
