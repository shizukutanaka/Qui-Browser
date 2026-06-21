/**
 * Unit tests for the shared UI canvas-texture configuration helper.
 * THREE is mocked so the helper's property-setting can be verified headlessly.
 */

jest.mock('three', () => ({
  // Real THREE.LinearFilter is 1006; mirror that so the guard branch is taken.
  LinearFilter: 1006
}));

const { configureUITexture } = require('../src/vr/ui/canvasTexture.js');

describe('configureUITexture', () => {
  test('disables mipmaps for flat UI text', () => {
    const tex = { generateMipmaps: true };
    configureUITexture(tex);
    expect(tex.generateMipmaps).toBe(false);
  });

  test('sets a linear min filter (no mip sampling) so text stays crisp', () => {
    const tex = {};
    configureUITexture(tex);
    expect(tex.minFilter).toBe(1006);
  });

  test('returns the same texture instance for chaining', () => {
    const tex = {};
    expect(configureUITexture(tex)).toBe(tex);
  });

  test('is a no-op (no throw) when given null', () => {
    expect(() => configureUITexture(null)).not.toThrow();
    expect(configureUITexture(null)).toBeNull();
  });
});

describe('configureUITexture — without LinearFilter in the THREE build', () => {
  beforeEach(() => jest.resetModules());

  test('still disables mipmaps and does not assign an undefined minFilter', () => {
    jest.doMock('three', () => ({})); // no LinearFilter exported
    const { configureUITexture: cfg } = require('../src/vr/ui/canvasTexture.js');
    const tex = { generateMipmaps: true };
    cfg(tex);
    expect(tex.generateMipmaps).toBe(false);
    expect('minFilter' in tex).toBe(false); // guard skipped the assignment
  });
});
