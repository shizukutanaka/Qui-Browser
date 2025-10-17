/**
 * GraphQL Query Optimizer
 *
 * Implements GraphQL performance optimizations (Improvements #64-65, #201-202)
 * - Query depth limiting
 * - Query cost analysis
 * - DataLoader for batch loading (N+1 problem prevention)
 * - Persisted queries
 * - Query complexity analysis
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

/**
 * Query depth limiter configuration
 */
const DEFAULT_DEPTH_CONFIG = {
  maxDepth: 10,
  ignoreIntrospection: true
};

/**
 * Query cost configuration
 */
const DEFAULT_COST_CONFIG = {
  maxCost: 1000,
  objectCost: 1,
  scalarCost: 0,
  listFactor: 10,
  depthMultiplier: 2
};

/**
 * DataLoader configuration
 */
const DEFAULT_DATALOADER_CONFIG = {
  batch: true,
  cache: true,
  maxBatchSize: 100
};

/**
 * Calculate query depth
 */
function calculateQueryDepth(node, depth = 0, config = DEFAULT_DEPTH_CONFIG) {
  if (!node || typeof node !== 'object') {
    return depth;
  }

  // Ignore introspection queries
  if (config.ignoreIntrospection && node.name && node.name.value === '__schema') {
    return depth;
  }

  let maxDepth = depth;

  // Check definitions (for Document nodes)
  if (node.definitions && Array.isArray(node.definitions)) {
    for (const definition of node.definitions) {
      const defDepth = calculateQueryDepth(definition, depth, config);
      maxDepth = Math.max(maxDepth, defDepth);
    }
  }

  // Check selections
  if (node.selectionSet && node.selectionSet.selections) {
    for (const selection of node.selectionSet.selections) {
      // Skip introspection fields
      if (config.ignoreIntrospection && selection.name && selection.name.value.startsWith('__')) {
        continue;
      }

      const selectionDepth = calculateQueryDepth(selection, depth + 1, config);
      maxDepth = Math.max(maxDepth, selectionDepth);
    }
  }

  return maxDepth;
}

/**
 * Query depth limiting rule
 */
function createDepthLimitRule(config = {}) {
  const finalConfig = { ...DEFAULT_DEPTH_CONFIG, ...config };

  return function depthLimitRule(context) {
    return {
      Document(node) {
        const depth = calculateQueryDepth(node);

        if (depth > finalConfig.maxDepth) {
          context.reportError(
            new Error(`Query exceeds maximum depth of ${finalConfig.maxDepth} (depth: ${depth})`)
          );
        }
      }
    };
  };
}

/**
 * Calculate query cost
 */
class QueryCostAnalyzer {
  constructor(config = {}) {
    this.config = { ...DEFAULT_COST_CONFIG, ...config };
  }

  /**
   * Analyze query cost
   */
  analyze(node, schema, depth = 1) {
    if (!node || typeof node !== 'object') {
      return 0;
    }

    let totalCost = 0;

    // Calculate base cost
    if (node.kind === 'Field') {
      const fieldType = this.getFieldType(node, schema);

      if (this.isScalarType(fieldType)) {
        totalCost += this.config.scalarCost;
      } else if (this.isListType(fieldType)) {
        totalCost += this.config.objectCost * this.config.listFactor;
      } else {
        totalCost += this.config.objectCost;
      }

      // Apply depth multiplier
      totalCost *= Math.pow(this.config.depthMultiplier, depth - 1);
    }

    // Analyze selections
    if (node.selectionSet && node.selectionSet.selections) {
      for (const selection of node.selectionSet.selections) {
        totalCost += this.analyze(selection, schema, depth + 1);
      }
    }

    // Analyze child nodes
    if (node.definitions) {
      for (const definition of node.definitions) {
        totalCost += this.analyze(definition, schema, depth);
      }
    }

    return totalCost;
  }

  /**
   * Get field type from schema
   */
  getFieldType(node, schema) {
    // Simplified type detection
    if (!node.name || !schema) {
      return 'scalar';
    }

    const fieldName = node.name.value;

    // Common scalar fields
    if (['id', 'name', 'email', 'createdAt', 'updatedAt'].includes(fieldName)) {
      return 'scalar';
    }

    // Common list fields
    if (fieldName.endsWith('s') || fieldName === 'items' || fieldName === 'results') {
      return 'list';
    }

    return 'object';
  }

  /**
   * Check if type is scalar
   */
  isScalarType(type) {
    return type === 'scalar';
  }

  /**
   * Check if type is list
   */
  isListType(type) {
    return type === 'list';
  }
}

/**
 * Create query cost limit rule
 */
function createCostLimitRule(schema, config = {}) {
  const analyzer = new QueryCostAnalyzer(config);

  return function costLimitRule(context) {
    return {
      Document(node) {
        const cost = analyzer.analyze(node, schema);

        if (cost > analyzer.config.maxCost) {
          context.reportError(
            new Error(`Query exceeds maximum cost of ${analyzer.config.maxCost} (cost: ${Math.round(cost)})`)
          );
        }
      }
    };
  };
}

/**
 * DataLoader implementation for batch loading
 */
class DataLoader extends EventEmitter {
  constructor(batchLoadFn, config = {}) {
    super();
    this.batchLoadFn = batchLoadFn;
    this.config = { ...DEFAULT_DATALOADER_CONFIG, ...config };

    this.cache = this.config.cache ? new Map() : null;
    this.queue = [];
    this.batchScheduled = false;
  }

  /**
   * Load a single value
   */
  async load(key) {
    // Check cache
    if (this.cache && this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Add to queue
    return new Promise((resolve, reject) => {
      this.queue.push({ key, resolve, reject });

      // Schedule batch if not already scheduled
      if (!this.batchScheduled) {
        this.scheduleBatch();
      }
    });
  }

  /**
   * Load multiple values
   */
  async loadMany(keys) {
    return Promise.all(keys.map((key) => this.load(key)));
  }

  /**
   * Schedule batch execution
   */
  scheduleBatch() {
    this.batchScheduled = true;

    process.nextTick(() => {
      this.executeBatch();
    });
  }

  /**
   * Execute batch load
   */
  async executeBatch() {
    this.batchScheduled = false;

    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.config.maxBatchSize);
    const keys = batch.map((item) => item.key);

    try {
      const results = await this.batchLoadFn(keys);

      // Validate results
      if (!Array.isArray(results) || results.length !== keys.length) {
        throw new Error(`DataLoader batch function must return array of same length as keys`);
      }

      // Resolve promises and cache results
      for (let i = 0; i < batch.length; i++) {
        const { key, resolve } = batch[i];
        const result = results[i];

        if (this.cache) {
          this.cache.set(key, result);
        }

        resolve(result);
      }

      this.emit('batch', { keys, results });
    } catch (error) {
      // Reject all promises in batch
      for (const { reject } of batch) {
        reject(error);
      }

      this.emit('error', error);
    }

    // Process remaining queue
    if (this.queue.length > 0) {
      this.scheduleBatch();
    }
  }

  /**
   * Clear cache
   */
  clearAll() {
    if (this.cache) {
      this.cache.clear();
    }
  }

  /**
   * Clear specific key from cache
   */
  clear(key) {
    if (this.cache) {
      this.cache.delete(key);
    }
  }

  /**
   * Prime cache with value
   */
  prime(key, value) {
    if (this.cache) {
      this.cache.set(key, value);
    }
  }
}

/**
 * Persisted queries manager
 */
class PersistedQueriesManager {
  constructor(config = {}) {
    this.config = config;
    this.queries = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      stored: 0
    };
  }

  /**
   * Generate query hash
   */
  hashQuery(query) {
    return crypto.createHash('sha256').update(query).digest('hex');
  }

  /**
   * Store query
   */
  store(query) {
    const hash = this.hashQuery(query);
    this.queries.set(hash, query);
    this.stats.stored++;
    return hash;
  }

  /**
   * Retrieve query by hash
   */
  retrieve(hash) {
    const query = this.queries.get(hash);

    if (query) {
      this.stats.hits++;
      return query;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Check if query exists
   */
  has(hash) {
    return this.queries.has(hash);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      ...this.stats,
      total,
      hitRate: hitRate.toFixed(2) + '%',
      size: this.queries.size
    };
  }

  /**
   * Clear all queries
   */
  clear() {
    this.queries.clear();
  }
}

/**
 * Create persisted queries middleware
 */
function createPersistedQueriesMiddleware(manager) {
  return async (req, res, next) => {
    const body = req.body || {};

    // Check for persisted query
    if (body.extensions && body.extensions.persistedQuery) {
      const { sha256Hash, version } = body.extensions.persistedQuery;

      // Only support APQ version 1
      if (version !== 1) {
        return res.status(400).json({
          errors: [{ message: 'Unsupported persisted query version' }]
        });
      }

      // Try to retrieve query
      const query = manager.retrieve(sha256Hash);

      if (query) {
        // Use persisted query
        req.body.query = query;
        return next();
      }

      // Query not found
      if (!body.query) {
        return res.status(400).json({
          errors: [{ message: 'PersistedQueryNotFound' }]
        });
      }

      // Store new query
      manager.store(body.query);
    }

    next();
  };
}

/**
 * Query complexity analyzer
 */
class QueryComplexityAnalyzer {
  constructor(config = {}) {
    this.config = {
      maxComplexity: 1000,
      defaultFieldComplexity: 1,
      ...config
    };
  }

  /**
   * Analyze query complexity
   */
  analyze(node, depth = 1) {
    if (!node || typeof node !== 'object') {
      return 0;
    }

    let complexity = 0;

    // Field complexity
    if (node.kind === 'Field') {
      complexity += this.config.defaultFieldComplexity * depth;

      // Arguments increase complexity
      if (node.arguments && node.arguments.length > 0) {
        complexity += node.arguments.length;
      }

      // Directives increase complexity
      if (node.directives && node.directives.length > 0) {
        complexity += node.directives.length * 2;
      }
    }

    // Analyze selections
    if (node.selectionSet && node.selectionSet.selections) {
      for (const selection of node.selectionSet.selections) {
        complexity += this.analyze(selection, depth + 1);
      }
    }

    // Analyze definitions
    if (node.definitions) {
      for (const definition of node.definitions) {
        complexity += this.analyze(definition, depth);
      }
    }

    return complexity;
  }

  /**
   * Validate query complexity
   */
  validate(node) {
    const complexity = this.analyze(node);

    return {
      valid: complexity <= this.config.maxComplexity,
      complexity,
      maxComplexity: this.config.maxComplexity
    };
  }
}

/**
 * Create query complexity rule
 */
function createComplexityRule(config = {}) {
  const analyzer = new QueryComplexityAnalyzer(config);

  return function complexityRule(context) {
    return {
      Document(node) {
        const result = analyzer.validate(node);

        if (!result.valid) {
          context.reportError(
            new Error(
              `Query is too complex: ${result.complexity} (max: ${result.maxComplexity})`
            )
          );
        }
      }
    };
  };
}

/**
 * Create GraphQL optimizer middleware
 */
function createGraphQLOptimizer(schema, config = {}) {
  const {
    enableDepthLimit = true,
    enableCostAnalysis = true,
    enableComplexityAnalysis = true,
    depthConfig = {},
    costConfig = {},
    complexityConfig = {}
  } = config;

  const rules = [];

  if (enableDepthLimit) {
    rules.push(createDepthLimitRule(depthConfig));
  }

  if (enableCostAnalysis) {
    rules.push(createCostLimitRule(schema, costConfig));
  }

  if (enableComplexityAnalysis) {
    rules.push(createComplexityRule(complexityConfig));
  }

  return {
    validationRules: rules,
    createDataLoader: (batchFn, loaderConfig) => new DataLoader(batchFn, loaderConfig)
  };
}

module.exports = {
  // Depth limiting
  calculateQueryDepth,
  createDepthLimitRule,
  DEFAULT_DEPTH_CONFIG,

  // Cost analysis
  QueryCostAnalyzer,
  createCostLimitRule,
  DEFAULT_COST_CONFIG,

  // DataLoader
  DataLoader,
  DEFAULT_DATALOADER_CONFIG,

  // Persisted queries
  PersistedQueriesManager,
  createPersistedQueriesMiddleware,

  // Complexity analysis
  QueryComplexityAnalyzer,
  createComplexityRule,

  // Main optimizer
  createGraphQLOptimizer
};
