/**
 * Unit tests for AccessibilityCoordinator (CLAUDE.md Phase 3 extraction,
 * docs/OUTSTANDING_ISSUES.md item C-1 — first slice: captionSystem only).
 */
const { AccessibilityCoordinator } = require('../src/vr/accessibility/AccessibilityCoordinator.js');

describe('AccessibilityCoordinator', () => {
  test('constructs with captionSystem null', () => {
    const coord = new AccessibilityCoordinator();
    expect(coord.captionSystem).toBeNull();
  });

  test('holds whatever captionSystem instance is assigned', () => {
    const coord = new AccessibilityCoordinator();
    const fakeCaptionSystem = { show: () => {}, enabled: true };
    coord.captionSystem = fakeCaptionSystem;
    expect(coord.captionSystem).toBe(fakeCaptionSystem);
  });
});
