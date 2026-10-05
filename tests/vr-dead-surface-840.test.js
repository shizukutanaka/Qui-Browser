/**
 * Dead public-surface audit — round 840
 *
 * Zero-call-site API (verified with plain-name greps across src/, tests/ and
 * tools/, including optional-chaining call forms) is removed:
 *
 *   VoiceCommands.getCommands / unregisterCommand / getStats
 *   HandTracking.getPointingRay / getStats
 *   urlResolver.isSearchQuery
 *
 * The two `stats` accumulators were read only by the removed getStats
 * methods — the write-only fields and their increment sites go with them.
 */

import { VoiceCommands } from '../src/vr/input/VoiceCommands';
import { HandTracking } from '../src/vr/interaction/HandTracking';
import * as urlResolver from '../src/vr/browser/urlResolver';

const scene = { add() {}, remove() {} };

describe('VoiceCommands dead surface removed', () => {
  test('getCommands / unregisterCommand / getStats are gone', () => {
    expect(VoiceCommands.prototype.getCommands).toBeUndefined();
    expect(VoiceCommands.prototype.unregisterCommand).toBeUndefined();
    expect(VoiceCommands.prototype.getStats).toBeUndefined();
  });

  test('write-only stats accumulator removed with getStats', () => {
    const vc = new VoiceCommands();
    expect(vc.stats).toBeUndefined();
  });
});

describe('HandTracking dead surface removed', () => {
  test('getPointingRay / getStats are gone', () => {
    expect(HandTracking.prototype.getPointingRay).toBeUndefined();
    expect(HandTracking.prototype.getStats).toBeUndefined();
  });

  test('write-only stats accumulator removed with getStats', () => {
    const ht = new HandTracking({}, scene);
    expect(ht.stats).toBeUndefined();
  });
});

describe('urlResolver dead surface removed', () => {
  test('isSearchQuery is gone', () => {
    expect(urlResolver.isSearchQuery).toBeUndefined();
  });
});

describe('live surface stays pinned', () => {
  test('VoiceCommands real API intact', () => {
    const vc = new VoiceCommands();
    expect(typeof vc.registerCommand).toBe('function');
    expect(typeof vc.processCommand).toBe('function');
    expect(typeof vc.start).toBe('function');
    expect(typeof vc.stop).toBe('function');
    expect(typeof vc.speak).toBe('function');
    expect(typeof vc.connectBrowser).toBe('function');
    expect(typeof vc.dispose).toBe('function');
  });

  test('HandTracking real API intact', () => {
    const ht = new HandTracking({}, scene);
    expect(typeof ht.detectGesture).toBe('function');
    expect(typeof ht.getPinchPosition).toBe('function');
    expect(typeof ht.isFingerExtended).toBe('function');
    expect(typeof ht.update).toBe('function');
    expect(typeof ht.onGesture).toBe('function');
    expect(typeof ht.dispose).toBe('function');
  });

  test('urlResolver real API intact', () => {
    expect(typeof urlResolver.resolveInput).toBe('function');
    expect(typeof urlResolver.searchEngineHosts).toBe('function');
    expect(urlResolver.DEFAULT_SEARCH_ENGINE).toBe('duckduckgo');
  });
});
