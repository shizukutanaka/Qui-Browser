/**
 * Coordinates VRApp's accessibility subsystems, extracted out of the VRApp
 * monolith per the CLAUDE.md Phase 3 roadmap ("AccessibilityCoordinator"),
 * so accessibility state can be reasoned about independently of the rest of
 * VRApp's 3,000+ lines.
 *
 * This is an incremental extraction (see docs/OUTSTANDING_ISSUES.md, item
 * C-1): only captionSystem is homed here so far. hapticFeedback and
 * gazeInteraction remain directly on VRApp pending follow-up slices — they
 * were deferred because hapticFeedback has ~15 call sites scattered across
 * locomotion/teleport/grab/voice handling (higher mechanical-edit risk) and
 * gazeInteraction is tightly coupled to updateSystems()'s per-frame gaze-dwell
 * block, whereas captionSystem's settings-panel surface is small and
 * self-contained (just enableCaptions/captionDuration/captionScale).
 *
 * VRApp still owns construction and disposal of each subsystem (the
 * dependency on `this.camera` being ready, and the `_handTrackingTimers`
 * teardown-ordering guard, are VRApp-lifecycle concerns, not accessibility
 * ones). This class is deliberately just where the reference lives: VRApp
 * exposes it through a `captionSystem` getter/setter so every existing call
 * site (`this.captionSystem.show(...)`, the settings-panel `apply` closures,
 * dispose()) keeps working unchanged — none of them needed to move.
 */
export class AccessibilityCoordinator {
  constructor() {
    this.captionSystem = null;
  }
}
