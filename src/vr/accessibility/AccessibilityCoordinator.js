/**
 * Coordinates VRApp's accessibility subsystems, extracted out of the VRApp
 * monolith per the CLAUDE.md Phase 3 roadmap ("AccessibilityCoordinator"),
 * so accessibility state can be reasoned about independently of the rest of
 * VRApp's 3,000+ lines.
 *
 * This is an incremental extraction (see docs/OUTSTANDING_ISSUES.md, item
 * C-1): captionSystem (Session 44) and hapticFeedback (Session 45) are homed
 * here so far. gazeInteraction remains directly on VRApp pending a follow-up
 * slice — it is tightly coupled to updateSystems()'s per-frame gaze-dwell
 * block, whereas captionSystem/hapticFeedback each have a small, self-
 * contained construction path (a plain try/catch, no per-frame coupling).
 *
 * VRApp still owns construction and disposal of each subsystem (the
 * dependency on `this.camera` being ready for some systems, and the
 * `_handTrackingTimers` teardown-ordering guard, are VRApp-lifecycle
 * concerns, not accessibility ones). This class is deliberately just where
 * the references live: VRApp exposes each through a getter/setter so every
 * existing call site (`this.captionSystem.show(...)`,
 * `this.hapticFeedback.playPattern(...)`, the settings-panel `apply`
 * closures, dispose()) keeps working unchanged — none of them needed to move.
 */
export class AccessibilityCoordinator {
  constructor() {
    this.captionSystem = null;
    this.hapticFeedback = null;
  }
}
