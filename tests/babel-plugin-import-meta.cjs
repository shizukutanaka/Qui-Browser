/**
 * Minimal Babel plugin: rewrite `import.meta` to a safe stub in the Jest (CJS)
 * environment.  Vite handles `import.meta.env` natively at build time, but
 * babel-jest compiles modules to CommonJS where `import.meta` is a syntax
 * error.  This replaces the `import.meta` meta-property with `({ env: {} })`
 * so modules that read `import.meta.env.*` load (and read undefined) in tests.
 */
module.exports = function importMetaStub() {
  return {
    name: 'transform-import-meta-stub',
    visitor: {
      MetaProperty(path) {
        const { node } = path;
        if (node.meta && node.meta.name === 'import' && node.property && node.property.name === 'meta') {
          path.replaceWithSourceString('({ env: {} })');
        }
      }
    }
  };
};
