/**
 * Unit tests for AccessibilityCoordinator (CLAUDE.md Phase 3 extraction,
 * docs/OUTSTANDING_ISSUES.md item C-1 — slices 1-2: captionSystem, hapticFeedback).
 */
const { AccessibilityCoordinator } = require('../src/vr/accessibility/AccessibilityCoordinator.js');

describe('AccessibilityCoordinator', () => {
  test('constructs with captionSystem and hapticFeedback null', () => {
    const coord = new AccessibilityCoordinator();
    expect(coord.captionSystem).toBeNull();
    expect(coord.hapticFeedback).toBeNull();
  });

  test('holds whatever captionSystem instance is assigned', () => {
    const coord = new AccessibilityCoordinator();
    const fakeCaptionSystem = { show: () => {}, enabled: true };
    coord.captionSystem = fakeCaptionSystem;
    expect(coord.captionSystem).toBe(fakeCaptionSystem);
  });

  test('holds whatever hapticFeedback instance is assigned', () => {
    const coord = new AccessibilityCoordinator();
    const fakeHaptic = { playPattern: () => {} };
    coord.hapticFeedback = fakeHaptic;
    expect(coord.hapticFeedback).toBe(fakeHaptic);
  });

  test('captionSystem and hapticFeedback are independent', () => {
    const coord = new AccessibilityCoordinator();
    const fakeCaptionSystem = { show: () => {} };
    coord.captionSystem = fakeCaptionSystem;
    expect(coord.hapticFeedback).toBeNull();
  });
});
