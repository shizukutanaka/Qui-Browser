/**
 * Phase 9 Improvements Tests
 *
 * Tests for:
 * - Code Splitter (#159-160)
 * - Service Worker Manager (#163)
 * - CDN Manager (#185-187)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Import Phase 9 utilities
const {
  CodeSplitter,
  DependencyGraph,
  LazyLoader
} = require('../utils/code-splitter');

const {
  ServiceWorkerGenerator,
  ServiceWorkerCacheManager
} = require('../utils/service-worker-manager');

const {
  CDNManager,
  CDNProvider,
  CloudflareCDN,
  ImageCDNHelper
} = require('../utils/cdn-manager');

// ==================== Code Splitter Tests ====================

describe('Code Splitter', () => {
  it('should create dependency graph', () => {
    const graph = new DependencyGraph();
    assert.ok(graph);
  });

  it('should add modules to graph', () => {
    const graph = new DependencyGraph();

    const module = graph.addModule('/app.js', { size: 1000 });

    assert.ok(module);
    assert.strictEqual(module.path, '/app.js');
    assert.strictEqual(module.size, 1000);
  });

  it('should add dependencies', () => {
    const graph = new DependencyGraph();

    graph.addModule('/app.js');
    graph.addModule('/utils.js');
    graph.addDependency('/app.js', '/utils.js');

    const deps = graph.getDependencies('/app.js');

    assert.strictEqual(deps.length, 1);
    assert.strictEqual(deps[0], '/utils.js');
  });

  it('should detect circular dependencies', () => {
    const graph = new DependencyGraph();

    graph.addModule('/a.js');
    graph.addModule('/b.js');
    graph.addModule('/c.js');

    graph.addDependency('/a.js', '/b.js');
    graph.addDependency('/b.js', '/c.js');
    graph.addDependency('/c.js', '/a.js');

    const circles = graph.detectCircularDependencies();

    assert.ok(circles.length > 0);
  });

  it('should calculate size impact', () => {
    const graph = new DependencyGraph();

    graph.addModule('/app.js', { size: 1000 });
    graph.addModule('/utils.js', { size: 500 });
    graph.addDependency('/app.js', '/utils.js');

    const impact = graph.calculateSizeImpact('/app.js');

    assert.strictEqual(impact.directSize, 1000);
    assert.strictEqual(impact.totalSize, 1500);
  });

  it('should create code splitter', () => {
    const splitter = new CodeSplitter();
    assert.ok(splitter);
  });

  it('should extract ES6 imports', () => {
    const splitter = new CodeSplitter();

    const code = `
      import React from 'react';
      import { useState, useEffect } from 'react';
      import './styles.css';
    `;

    const imports = splitter.extractImports(code);

    assert.ok(imports.length >= 3);
    assert.ok(imports.some((imp) => imp.source === 'react'));
  });

  it('should extract dynamic imports', () => {
    const splitter = new CodeSplitter();

    const code = `
      const module = await import('./module.js');
    `;

    const imports = splitter.extractImports(code);

    assert.ok(imports.some((imp) => imp.type === 'dynamic'));
  });

  it('should extract exports', () => {
    const splitter = new CodeSplitter();

    const code = `
      export const foo = 'bar';
      export function test() {}
      export class MyClass {}
      export default App;
    `;

    const exports = splitter.extractExports(code);

    assert.ok(exports.includes('foo'));
    assert.ok(exports.includes('test'));
    assert.ok(exports.includes('MyClass'));
    assert.ok(exports.includes('default'));
  });

  it('should detect side effects', () => {
    const splitter = new CodeSplitter();

    const codeWithSideEffects = `
      console.log('hello');
      window.addEventListener('load', () => {});
    `;

    const codeWithoutSideEffects = `
      function pureFunction(x) {
        return x * 2;
      }
    `;

    assert.strictEqual(splitter.detectSideEffects(codeWithSideEffects), true);
    assert.strictEqual(splitter.detectSideEffects(codeWithoutSideEffects), false);
  });

  it('should analyze module', () => {
    const splitter = new CodeSplitter();

    const code = `
      import { helper } from './helper.js';
      export const value = helper();
    `;

    const module = splitter.analyzeModule('/app.js', code);

    assert.ok(module);
    assert.strictEqual(module.path, '/app.js');
    assert.ok(module.imports.length > 0);
    assert.ok(module.exports.length > 0);
  });

  it('should create chunk', () => {
    const splitter = new CodeSplitter();

    splitter.dependencyGraph.addModule('/a.js', { size: 1000 });
    splitter.dependencyGraph.addModule('/b.js', { size: 500 });

    const chunk = splitter.createChunk('main', ['/a.js', '/b.js']);

    assert.ok(chunk);
    assert.strictEqual(chunk.name, 'main');
    assert.strictEqual(chunk.size, 1500);
  });

  it('should tree shake unused code', () => {
    const splitter = new CodeSplitter({ treeShaking: { enabled: true } });

    splitter.dependencyGraph.addModule('/utils.js', {
      size: 1000,
      exports: new Set(['foo', 'bar', 'baz']),
      sideEffects: false
    });

    // Mark only 'foo' as used
    splitter.dependencyGraph.markExportUsed('/utils.js', 'foo');

    const result = splitter.treeShake();

    assert.ok(result.eliminated > 0);
  });

  it('should create lazy loader', () => {
    const loader = new LazyLoader();
    assert.ok(loader);
  });

  it('should load module lazily', async () => {
    const loader = new LazyLoader();

    const module = await loader.loadModule('/lazy.js');

    assert.ok(module);
    assert.strictEqual(loader.stats.modulesLoaded, 1);
  });

  it('should cache loaded modules', async () => {
    const loader = new LazyLoader();

    await loader.loadModule('/cached.js');
    await loader.loadModule('/cached.js');

    assert.strictEqual(loader.stats.modulesLoaded, 1);
    assert.strictEqual(loader.stats.cacheHits, 1);
  });
});

// ==================== Service Worker Tests ====================

describe('Service Worker', () => {
  it('should create service worker generator', () => {
    const generator = new ServiceWorkerGenerator();
    assert.ok(generator);
  });

  it('should generate service worker script', () => {
    const generator = new ServiceWorkerGenerator({
      cacheName: 'test-cache-v1',
      precache: ['/', '/app.js'],
      caching: { strategy: 'network-first' }
    });

    const script = generator.generateScript();

    assert.ok(script.includes('test-cache-v1'));
    assert.ok(script.includes('network-first'));
    assert.ok(script.includes('install'));
    assert.ok(script.includes('activate'));
    assert.ok(script.includes('fetch'));
  });

  it('should generate manifest', () => {
    const generator = new ServiceWorkerGenerator({
      cacheName: 'test-cache',
      precache: ['/index.html']
    });

    const manifest = generator.generateManifest();

    assert.ok(manifest.version);
    assert.ok(manifest.hash);
    assert.ok(manifest.timestamp);
    assert.ok(Array.isArray(manifest.precache));
  });

  it('should generate background sync code', () => {
    const generator = new ServiceWorkerGenerator({
      backgroundSync: { enabled: true, tagPrefix: 'sync-' }
    });

    const code = generator.generateBackgroundSyncCode();

    assert.ok(code.includes('sync'));
    assert.ok(code.includes('sync-'));
  });

  it('should create cache manager', () => {
    const manager = new ServiceWorkerCacheManager('test-cache');
    assert.ok(manager);
    assert.strictEqual(manager.cacheName, 'test-cache');
  });
});

// ==================== CDN Manager Tests ====================

describe('CDN Manager', () => {
  it('should create CDN provider', () => {
    const provider = new CDNProvider('test', {
      baseURL: 'https://cdn.test.com',
      priority: 1
    });

    assert.ok(provider);
    assert.strictEqual(provider.name, 'test');
  });

  it('should generate CDN URL', () => {
    const provider = new CDNProvider('test', {
      baseURL: 'https://cdn.test.com'
    });

    const url = provider.getURL('/image.jpg', {
      width: 800,
      quality: 80
    });

    assert.ok(url.includes('cdn.test.com'));
    assert.ok(url.includes('/image.jpg'));
    assert.ok(url.includes('w=800'));
    assert.ok(url.includes('q=80'));
  });

  it('should record request statistics', () => {
    const provider = new CDNProvider('test', {
      baseURL: 'https://cdn.test.com'
    });

    provider.recordRequest(true);
    provider.recordRequest(true);
    provider.recordRequest(false);

    const stats = provider.getStatistics();

    assert.strictEqual(stats.requests, 3);
    assert.strictEqual(stats.hits, 2);
    assert.strictEqual(stats.misses, 1);
  });

  it('should create Cloudflare CDN', () => {
    const cdn = new CloudflareCDN({
      baseURL: 'https://cdn.cloudflare.com'
    });

    assert.ok(cdn);
    assert.strictEqual(cdn.name, 'cloudflare');
  });

  it('should generate Cloudflare-specific parameters', () => {
    const cdn = new CloudflareCDN({
      baseURL: 'https://cdn.cloudflare.com'
    });

    const url = cdn.getURL('/image.jpg', {
      width: 800,
      format: 'webp',
      sharpen: 1
    });

    assert.ok(url.includes('width=800'));
    assert.ok(url.includes('format=webp'));
    assert.ok(url.includes('sharpen=1'));
  });

  it('should create CDN manager', () => {
    const manager = new CDNManager({
      providers: [
        {
          name: 'cloudflare',
          baseURL: 'https://cdn.cloudflare.com',
          priority: 1
        }
      ]
    });

    assert.ok(manager);
    assert.strictEqual(manager.providers.length, 1);
  });

  it('should generate URL with transformations', async () => {
    const manager = new CDNManager({
      providers: [
        {
          name: 'test',
          baseURL: 'https://cdn.test.com',
          priority: 1
        }
      ],
      failover: { enabled: false }
    });

    const url = await manager.getURL('/image.jpg', {
      width: 1200,
      quality: 85
    });

    assert.ok(url.includes('/image.jpg'));
  });

  it('should sort providers by priority', () => {
    const manager = new CDNManager({
      providers: [
        { name: 'cdn3', baseURL: 'https://cdn3.com', priority: 3 },
        { name: 'cdn1', baseURL: 'https://cdn1.com', priority: 1 },
        { name: 'cdn2', baseURL: 'https://cdn2.com', priority: 2 }
      ]
    });

    assert.strictEqual(manager.providers[0].name, 'cdn1');
    assert.strictEqual(manager.providers[1].name, 'cdn2');
    assert.strictEqual(manager.providers[2].name, 'cdn3');
  });

  it('should get active provider', () => {
    const manager = new CDNManager({
      providers: [
        { name: 'test', baseURL: 'https://cdn.test.com', priority: 1 }
      ]
    });

    const active = manager.getActiveProvider();

    assert.strictEqual(active.name, 'test');
  });

  it('should switch active provider', () => {
    const manager = new CDNManager({
      providers: [
        { name: 'cdn1', baseURL: 'https://cdn1.com', priority: 1 },
        { name: 'cdn2', baseURL: 'https://cdn2.com', priority: 2 }
      ]
    });

    manager.setActiveProvider('cdn2');

    const active = manager.getActiveProvider();
    assert.strictEqual(active.name, 'cdn2');
  });

  it('should generate signed URL', () => {
    const manager = new CDNManager({
      providers: [
        { name: 'test', baseURL: 'https://cdn.test.com', priority: 1 }
      ],
      security: { signedURLs: true, secret: 'test-secret' }
    });

    const url = manager.getSignedURL('/secure.jpg', 3600);

    assert.ok(url);
  });

  it('should get all provider statistics', () => {
    const manager = new CDNManager({
      providers: [
        { name: 'cdn1', baseURL: 'https://cdn1.com', priority: 1 },
        { name: 'cdn2', baseURL: 'https://cdn2.com', priority: 2 }
      ]
    });

    const stats = manager.getAllStatistics();

    assert.strictEqual(stats.length, 2);
    assert.ok(stats[0].name);
    assert.ok('requests' in stats[0]);
  });

  it('should create image CDN helper', () => {
    const manager = new CDNManager({
      providers: [
        { name: 'test', baseURL: 'https://cdn.test.com', priority: 1 }
      ]
    });

    const helper = new ImageCDNHelper(manager);

    assert.ok(helper);
  });

  it('should generate responsive URLs', async () => {
    const manager = new CDNManager({
      providers: [
        { name: 'test', baseURL: 'https://cdn.test.com', priority: 1 }
      ],
      failover: { enabled: false }
    });

    const helper = new ImageCDNHelper(manager, { quality: 80 });

    const urls = await helper.getResponsiveURLs('/image.jpg', [640, 1280]);

    assert.strictEqual(urls.length, 2);
    assert.strictEqual(urls[0].width, 640);
    assert.strictEqual(urls[1].width, 1280);
  });

  it('should generate srcset', async () => {
    const manager = new CDNManager({
      providers: [
        { name: 'test', baseURL: 'https://cdn.test.com', priority: 1 }
      ],
      failover: { enabled: false }
    });

    const helper = new ImageCDNHelper(manager);

    const srcset = await helper.generateSrcSet('/image.jpg', [640, 1280]);

    assert.ok(srcset.includes('640w'));
    assert.ok(srcset.includes('1280w'));
  });
});

console.log('All Phase 9 tests completed!');
