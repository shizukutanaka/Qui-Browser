import { readFileSync } from 'fs';
import { join } from 'path';

const HF = join(__dirname, '..', 'src', 'vr', 'interaction', 'HapticFeedback.js');
const src = readFileSync(HF, 'utf8');

const LIVE_METHODS = [
  'constructor',
  'update',
  'pulse',
  'playPattern',
  'playPatternBothHands',
  'getGamepadForHand',
  'setEnabled',
  'wait',
  'getStats'
];

const REMOVED = [
  'createCustomPattern',
  'simulateTexture',
  'simulateForce',
  'simulateImpact',
  'proximityFeedback',
  'directionalPulse',
  'playRhythm',
  'alert',
  'playCustomSequence'
];

describe('dead-surface honesty: HapticFeedback public API', () => {
  test('the defined method set is exactly the reachable surface', () => {
    const defined = [...src.matchAll(/^  (?:async )?(\w+)\s*\(/gm)].map((m) => m[1]);
    // each defined method must be in the live set — anything else is a
    // public-looking method with zero call sites
    expect(defined.sort()).toEqual([...LIVE_METHODS].sort());
  });

  test('every defined method is invoked via this.* or a consumer', () => {
    const defined = [...src.matchAll(/^  (?:async )?(\w+)\s*\(/gm)].map((m) => m[1]);
    const callers = `${src}\n${readFileSync(join(__dirname, 'haptic-feedback.test.js'), 'utf8')}`;
    const dead = defined.filter((name) => {
      if (name === 'constructor') {
        return false;
      }
      return !new RegExp(`\\.${name}\\s*\\(`).test(callers) && !new RegExp(`this\\.${name}\\s*\\(`).test(src);
    });
    // each entry is a method defined but never invoked — dead public surface
    expect(dead).toEqual([]);
  });

  test.each(REMOVED)('%s is gone', (name) => {
    expect(src).not.toMatch(new RegExp(`^\\s+(?:async\\s+)?${name}\\s*\\(`, 'm'));
  });

  test.each(LIVE_METHODS)('live method %s is still defined', (name) => {
    expect(src).toMatch(new RegExp(`^\\s+(?:async\\s+)?${name}\\s*\\(`, 'm'));
  });
});
