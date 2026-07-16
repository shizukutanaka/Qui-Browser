/**
 * Root-wide Babel config for Jest.
 *
 * jest.config.js whitelists `three` in transformIgnorePatterns so its ESM
 * examples/jsm sources get transpiled, but per-package .babelrc lookup does
 * not apply across the node_modules boundary — only a root babel.config.js
 * does. Without this file, importing e.g. three/examples/jsm/webxr/VRButton.js
 * or three/examples/jsm/loaders/KTX2Loader.js (both real, unmocked imports
 * pulled in transitively by src/vr/VRApp.js and src/utils/TextureManager.js)
 * fails with "SyntaxError: Unexpected token 'export'".
 */
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current'
        }
      }
    ]
  ]
};
