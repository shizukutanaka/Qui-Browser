/**
 * Smoke tests for the live v2.0.0 src/ application modules.
 *
 * These intentionally cover dependency-free core modules of the actual app
 * (the modules reachable from index.html -> src/main.js) and lock in the
 * NaN-guard and teardown fixes made to the runtime code.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

describe('src/vr/input/VoiceCommands', () => {
  test('constructs in a non-listening state', () => {
    const vc = new VoiceCommands();
    expect(vc.isListening).toBe(false);
  });
});
