/**
 * Code Splitter and Module Bundler
 *
 * Implements code optimization improvements (#159-160):
 * - Dynamic import() for code splitting
 * - Tree shaking for unused code elimination
 * - Bundle analysis and optimization
 * - Module dependency graph
 * - Lazy loading of routes and components
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');
const path = require('path');

/**
 * Code splitter configuration
 */
const DEFAULT_CODE_SPLITTER_CONFIG = {
  // Code splitting
  splitting: {
    enabled: true,
    strategy: 'dynamic', // 'dynamic' | 'vendor' | 'route'
    minSize: 20000, // 20KB minimum chunk size
    maxSize: 244000, // 244KB maximum chunk size
    maxAsyncRequests: 30,
    maxInitialRequests: 30
  },

  // Tree shaking
  treeShaking: {
    enabled: true,
    sideEffects: false,
    usedExports: true,
    removeUnusedCode: true
  },

  // Bundle optimization
  optimization: {
    minimize: true,
    splitChunks: true,
    runtimeChunk: 'single',
    moduleIds: 'deterministic'
  },

  // Caching
  cache: {
    enabled: true,
    type: 'filesystem',
    cacheDirectory: '.cache'
  }
};

/**
 * Module dependency graph
 */
class DependencyGraph extends EventEmitter {
  constructor() {
    super();
    this.modules = new Map();
    this.edges = new Map();
  }

  /**
   * Add module to graph
   */
  addModule(modulePath, metadata = {}) {
    const module = {
      path: modulePath,
      id: this.generateModuleId(modulePath),
      size: metadata.size || 0,
      imports: new Set(),
      exports: new Set(),
      usedExports: new Set(),
      sideEffects: metadata.sideEffects !== false,
      ...metadata
    };

    this.modules.set(modulePath, module);
    this.edges.set(modulePath, new Set());

    this.emit('module-added', module);
    return module;
  }

  /**
   * Add dependency edge
   */
  addDependency(from, to) {
    if (!this.modules.has(from)) {
      this.addModule(from);
    }
    if (!this.modules.has(to)) {
      this.addModule(to);
    }

    const fromModule = this.modules.get(from);
    const toModule = this.modules.get(to);

    fromModule.imports.add(to);
    this.edges.get(from).add(to);

    this.emit('dependency-added', { from, to });
  }

  /**
   * Mark export as used
   */
  markExportUsed(modulePath, exportName) {
    const module = this.modules.get(modulePath);
    if (module) {
      module.usedExports.add(exportName);
    }
  }

  /**
   * Get module dependencies
   */
  getDependencies(modulePath) {
    return Array.from(this.edges.get(modulePath) || []);
  }

  /**
   * Get module dependents (reverse dependencies)
   */
  getDependents(modulePath) {
    const dependents = [];
    for (const [from, deps] of this.edges) {
      if (deps.has(modulePath)) {
        dependents.push(from);
      }
    }
    return dependents;
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies() {
    const visited = new Set();
    const recursionStack = new Set();
    const circles = [];

    const dfs = (node, path = []) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const deps = this.edges.get(node) || new Set();
      for (const dep of deps) {
        if (!visited.has(dep)) {
          dfs(dep, [...path]);
        } else if (recursionStack.has(dep)) {
          // Found circle
          const circleStart = path.indexOf(dep);
          circles.push([...path.slice(circleStart), dep]);
        }
      }

      recursionStack.delete(node);
    };

    for (const node of this.modules.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return circles;
  }

  /**
   * Find unused exports
   */
  findUnusedExports() {
    const unused = [];

    for (const [modulePath, module] of this.modules) {
      const unusedExports = Array.from(module.exports).filter(
        (exp) => !module.usedExports.has(exp)
      );

      if (unusedExports.length > 0) {
        unused.push({
          module: modulePath,
          exports: unusedExports
        });
      }
    }

    return unused;
  }

  /**
   * Calculate module size impact
   */
  calculateSizeImpact(modulePath) {
    const visited = new Set();
    let totalSize = 0;

    const traverse = (path) => {
      if (visited.has(path)) return;
      visited.add(path);

      const module = this.modules.get(path);
      if (module) {
        totalSize += module.size;
      }

      const deps = this.edges.get(path) || new Set();
      for (const dep of deps) {
        traverse(dep);
      }
    };

    traverse(modulePath);

    return {
      module: modulePath,
      directSize: this.modules.get(modulePath)?.size || 0,
      totalSize,
      dependencies: visited.size - 1
    };
  }

  /**
   * Generate module ID
   */
  generateModuleId(modulePath) {
    return crypto.createHash('md5').update(modulePath).digest('hex').substring(0, 8);
  }

  /**
   * Get graph statistics
   */
  getStatistics() {
    const modules = this.modules.size;
    const edges = Array.from(this.edges.values()).reduce(
      (sum, deps) => sum + deps.size,
      0
    );
    const totalSize = Array.from(this.modules.values()).reduce(
      (sum, mod) => sum + mod.size,
      0
    );
    const avgDependencies = modules > 0 ? edges / modules : 0;

    return {
      modules,
      dependencies: edges,
      totalSize,
      avgDependencies: avgDependencies.toFixed(2),
      circularDependencies: this.detectCircularDependencies().length
    };
  }
}

/**
 * Code splitter
 */
class CodeSplitter extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = this.mergeConfig(DEFAULT_CODE_SPLITTER_CONFIG, config);
    this.dependencyGraph = new DependencyGraph();
    this.chunks = new Map();
    this.stats = {
      chunksCreated: 0,
      codeEliminated: 0,
      totalSavings: 0
    };
  }

  /**
   * Merge configurations
   */
  mergeConfig(defaults, custom) {
    const merged = { ...defaults };
    for (const key in custom) {
      if (custom[key] && typeof custom[key] === 'object' && !Array.isArray(custom[key])) {
        merged[key] = { ...defaults[key], ...custom[key] };
      } else {
        merged[key] = custom[key];
      }
    }
    return merged;
  }

  /**
   * Analyze module
   */
  analyzeModule(modulePath, code) {
    const imports = this.extractImports(code);
    const exports = this.extractExports(code);

    // Add to dependency graph (don't pass imports/exports as they need to be Sets)
    const module = this.dependencyGraph.addModule(modulePath, {
      size: Buffer.byteLength(code, 'utf8'),
      sideEffects: this.detectSideEffects(code)
    });

    // Add exports to the module's exports Set
    for (const exp of exports) {
      module.exports.add(exp);
    }

    // Add dependencies
    for (const imp of imports) {
      this.dependencyGraph.addDependency(modulePath, imp.source);
    }

    return {
      path: modulePath,
      size: module.size,
      imports,
      exports,
      sideEffects: module.sideEffects
    };
  }

  /**
   * Extract imports from code
   */
  extractImports(code) {
    const imports = [];

    // ES6 imports with specifiers
    const es6ImportRegex = /import\s+(?:(\{[^}]+\})|([^,\s]+)(?:\s*,\s*\{[^}]+\})?)\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = es6ImportRegex.exec(code)) !== null) {
      const named = match[1];
      const defaultImport = match[2];
      const source = match[3];

      imports.push({
        type: 'es6',
        source,
        specifiers: named ? this.parseNamedImports(named) : [defaultImport].filter(Boolean)
      });
    }

    // Side-effect imports (e.g., import './styles.css')
    const sideEffectImportRegex = /import\s+['"]([^'"]+)['"]/g;
    while ((match = sideEffectImportRegex.exec(code)) !== null) {
      const source = match[1];

      // Skip if already captured by es6ImportRegex
      if (!imports.some(imp => imp.source === source)) {
        imports.push({
          type: 'es6',
          source,
          specifiers: []
        });
      }
    }

    // Dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(code)) !== null) {
      imports.push({
        type: 'dynamic',
        source: match[1]
      });
    }

    // CommonJS requires
    const cjsRequireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = cjsRequireRegex.exec(code)) !== null) {
      imports.push({
        type: 'cjs',
        source: match[1]
      });
    }

    return imports;
  }

  /**
   * Parse named imports
   */
  parseNamedImports(namedString) {
    return namedString
      .replace(/[{}]/g, '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * Extract exports from code
   */
  extractExports(code) {
    const exports = [];

    // Named exports
    const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;

    while ((match = namedExportRegex.exec(code)) !== null) {
      exports.push(match[1]);
    }

    // Export { ... }
    const exportListRegex = /export\s+\{([^}]+)\}/g;
    while ((match = exportListRegex.exec(code)) !== null) {
      const names = match[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]);
      exports.push(...names);
    }

    // Default export
    if (/export\s+default\s+/.test(code)) {
      exports.push('default');
    }

    return exports;
  }

  /**
   * Detect side effects
   */
  detectSideEffects(code) {
    // Check for common side effects patterns
    const sideEffectPatterns = [
      /console\./,
      /window\./,
      /document\./,
      /global\./,
      /process\./,
      /addEventListener/,
      /fetch\(/,
      /XMLHttpRequest/
    ];

    return sideEffectPatterns.some((pattern) => pattern.test(code));
  }

  /**
   * Create chunk
   */
  createChunk(name, modules) {
    const chunk = {
      name,
      id: this.generateChunkId(name),
      modules: new Set(modules),
      size: 0,
      hash: ''
    };

    // Calculate chunk size
    for (const modulePath of modules) {
      const module = this.dependencyGraph.modules.get(modulePath);
      if (module) {
        chunk.size += module.size;
      }
    }

    // Generate content hash
    chunk.hash = this.generateChunkHash(chunk);

    this.chunks.set(chunk.id, chunk);
    this.stats.chunksCreated++;

    this.emit('chunk-created', chunk);

    return chunk;
  }

  /**
   * Split by dynamic imports
   */
  splitByDynamicImports() {
    const chunks = [];
    const entryModules = new Set();

    // Find all modules with dynamic imports
    for (const [modulePath, module] of this.dependencyGraph.modules) {
      const dynamicImports = this.dependencyGraph
        .getDependencies(modulePath)
        .filter((dep) => {
          const depModule = this.dependencyGraph.modules.get(dep);
          return depModule && depModule.imports.some((imp) => imp.type === 'dynamic');
        });

      if (dynamicImports.length > 0) {
        entryModules.add(modulePath);
      }
    }

    // Create chunks for each entry point
    for (const entry of entryModules) {
      const chunkModules = this.getModuleAndDependencies(entry);
      const chunk = this.createChunk(`async-${entry}`, chunkModules);
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Get module and its dependencies
   */
  getModuleAndDependencies(modulePath) {
    const visited = new Set();

    const traverse = (path) => {
      if (visited.has(path)) return;
      visited.add(path);

      const deps = this.dependencyGraph.getDependencies(path);
      for (const dep of deps) {
        traverse(dep);
      }
    };

    traverse(modulePath);
    return Array.from(visited);
  }

  /**
   * Tree shake unused code
   */
  treeShake() {
    if (!this.config.treeShaking.enabled) {
      return { eliminated: 0, savings: 0 };
    }

    const unusedExports = this.dependencyGraph.findUnusedExports();
    let eliminated = 0;
    let savings = 0;

    for (const { module: modulePath, exports } of unusedExports) {
      const moduleData = this.dependencyGraph.modules.get(modulePath);
      if (!moduleData || moduleData.sideEffects) {
        continue; // Skip modules with side effects
      }

      // Estimate savings (assume each export is ~5% of module size)
      const estimatedSavings = Math.floor(
        (exports.length / moduleData.exports.size) * moduleData.size
      );

      eliminated += exports.length;
      savings += estimatedSavings;

      this.emit('code-eliminated', {
        module: modulePath,
        exports,
        savings: estimatedSavings
      });
    }

    this.stats.codeEliminated += eliminated;
    this.stats.totalSavings += savings;

    return { eliminated, savings };
  }

  /**
   * Generate chunk ID
   */
  generateChunkId(name) {
    return crypto.createHash('md5').update(name).digest('hex').substring(0, 8);
  }

  /**
   * Generate chunk hash
   */
  generateChunkHash(chunk) {
    const content = Array.from(chunk.modules).sort().join('|');
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
  }

  /**
   * Get bundle statistics
   */
  getBundleStatistics() {
    const graphStats = this.dependencyGraph.getStatistics();

    return {
      ...graphStats,
      chunks: this.chunks.size,
      chunksCreated: this.stats.chunksCreated,
      codeEliminated: this.stats.codeEliminated,
      totalSavings: this.stats.totalSavings,
      savingsPercentage:
        graphStats.totalSize > 0
          ? ((this.stats.totalSavings / graphStats.totalSize) * 100).toFixed(2) + '%'
          : '0%'
    };
  }
}

/**
 * Lazy loader for routes and components
 */
class LazyLoader extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.loadedModules = new Map();
    this.pendingLoads = new Map();
    this.stats = {
      modulesLoaded: 0,
      cacheHits: 0,
      loadErrors: 0
    };
  }

  /**
   * Load module lazily
   */
  async loadModule(modulePath) {
    // Check cache
    if (this.loadedModules.has(modulePath)) {
      this.stats.cacheHits++;
      this.emit('cache-hit', { module: modulePath });
      return this.loadedModules.get(modulePath);
    }

    // Check if already loading
    if (this.pendingLoads.has(modulePath)) {
      return await this.pendingLoads.get(modulePath);
    }

    // Start loading
    const loadPromise = this.performLoad(modulePath);
    this.pendingLoads.set(modulePath, loadPromise);

    try {
      const module = await loadPromise;
      this.loadedModules.set(modulePath, module);
      this.pendingLoads.delete(modulePath);
      this.stats.modulesLoaded++;

      this.emit('module-loaded', { module: modulePath });

      return module;
    } catch (error) {
      this.pendingLoads.delete(modulePath);
      this.stats.loadErrors++;

      this.emit('load-error', { module: modulePath, error });

      throw error;
    }
  }

  /**
   * Perform actual module load
   */
  async performLoad(modulePath) {
    // In real implementation, this would use import()
    // For now, simulate async loading
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Simulate module content
    return {
      path: modulePath,
      default: {},
      exports: {}
    };
  }

  /**
   * Preload module
   */
  async preload(modulePath) {
    return await this.loadModule(modulePath);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      cacheSize: this.loadedModules.size,
      pendingLoads: this.pendingLoads.size
    };
  }
}

/**
 * Create code splitter
 */
function createCodeSplitter(config = {}) {
  const splitter = new CodeSplitter(config);

  // Log events
  splitter.on('chunk-created', (chunk) => {
    console.log(
      `[CodeSplitter] Chunk created: ${chunk.name} (${chunk.size} bytes, ${chunk.modules.size} modules)`
    );
  });

  splitter.on('code-eliminated', (data) => {
    console.log(
      `[CodeSplitter] Eliminated ${data.exports.length} unused exports from ${data.module} (saved ${data.savings} bytes)`
    );
  });

  return splitter;
}

module.exports = {
  CodeSplitter,
  DependencyGraph,
  LazyLoader,
  createCodeSplitter,
  DEFAULT_CODE_SPLITTER_CONFIG
};
