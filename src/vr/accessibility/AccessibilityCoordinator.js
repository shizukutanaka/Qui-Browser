/**
 * Coordinates VRApp's accessibility subsystems, extracted out of the VRApp
 * monolith per the CLAUDE.md Phase 3 roadmap ("AccessibilityCoordinator"),
 * so accessibility state can be reasoned about independently of the rest of
 * VRApp's 3,000+ lines.
 *
 * This is an incremental extraction (see docs/OUTSTANDING_ISSUES.md, item
 * C-1), completed across three slices: captionSystem (Session 44),
 * hapticFeedback (Session 45), and gazeInteraction (Session 47). All three
 * turned out to have the identical shape — a field-decl `null`, a real
 * construction call, and (for hapticFeedback only) a dispose-time `null`
 * reassignment — so the same getter/setter delegation pattern applied
 * cleanly to each with zero call-site changes.
 *
 * VRApp still owns construction and disposal of each subsystem (the
 * dependency on `this.camera` being ready for some systems, and the
 * `_handTrackingTimers` teardown-ordering guard, are VRApp-lifecycle
 * concerns, not accessibility ones). This class is deliberately just where
 * the references live: VRApp exposes each through a getter/setter so every
 * existing call site (`this.captionSystem.show(...)`,
 * `this.hapticFeedback.playPattern(...)`, `this.gazeInteraction.update(...)`,
 * the settings-panel `apply` closures, dispose()) keeps working unchanged —
 * none of them needed to move.
 */
export class AccessibilityCoordinator {
  constructor() {
    this.captionSystem = null;
    this.hapticFeedback = null;
    this.gazeInteraction = null;
  }
}
