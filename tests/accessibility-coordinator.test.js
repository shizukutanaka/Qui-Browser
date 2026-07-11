/**
 * Unit tests for AccessibilityCoordinator (CLAUDE.md Phase 3 extraction,
 * docs/OUTSTANDING_ISSUES.md item C-1 — all 3 slices: captionSystem,
 * hapticFeedback, gazeInteraction).
 */
const { AccessibilityCoordinator } = require('../src/vr/accessibility/AccessibilityCoordinator.js');

describe('AccessibilityCoordinator', () => {
  test('constructs with captionSystem, hapticFeedback, and gazeInteraction null', () => {
    const coord = new AccessibilityCoordinator();
    expect(coord.captionSystem).toBeNull();
    expect(coord.hapticFeedback).toBeNull();
    expect(coord.gazeInteraction).toBeNull();
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

  test('holds whatever gazeInteraction instance is assigned', () => {
    const coord = new AccessibilityCoordinator();
    const fakeGaze = { update: () => {}, enabled: true };
    coord.gazeInteraction = fakeGaze;
    expect(coord.gazeInteraction).toBe(fakeGaze);
  });

  test('captionSystem, hapticFeedback, and gazeInteraction are independent', () => {
    const coord = new AccessibilityCoordinator();
    const fakeCaptionSystem = { show: () => {} };
    coord.captionSystem = fakeCaptionSystem;
    expect(coord.hapticFeedback).toBeNull();
    expect(coord.gazeInteraction).toBeNull();
  });
});
