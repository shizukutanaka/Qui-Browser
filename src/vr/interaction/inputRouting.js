/**
 * Controller input routing: per-frame locomotion, snap turns, teleport aiming,
 * and button/select dispatch for the VR session.
 *
 * Extracted from VRApp — every function takes `app` (the VRApp instance) and
 * reads subsystems lazily, preserving construction order. Scratch vectors are
 * module-scoped and lazy-inited (zero cost when smooth move is disabled).
 */

import * as THREE from 'three';
import { t } from '../../i18n/i18n.js';
import { snapTurnLabel, fireTeleportFeedback } from '../comfort/ComfortSystem.js';
import { firePanelReleaseFeedback } from '../browser/WindowManager.js';

let _locoQ, _locoFwd, _locoRight, _locoMove;

/**
 * Returns false when the object or any ancestor in the scene hierarchy is not
 * visible. Three.js raycasting does NOT walk parent-visibility, so hidden groups
 * (keyboard when closed, bookmark panel when toggled off) would otherwise still
 * intercept controller/gaze input while invisible.
 * @param {THREE.Object3D} obj
 */
export function isWorldVisible(obj) {
  let o = obj;
  while (o) {
    if (o.visible === false) {
      return false;
    }
    o = o.parent;
  }
  return true;
}

export function updateLocomotion(app, dt = 0.016) {
  if (!app.playerRig) {
    return;
  }

  // Southpaw swaps which hand drives snap-turn (typically right) vs move (left).
  const turnHand  = app.settings.southpaw ? 'left'  : 'right';
  const moveHand  = app.settings.southpaw ? 'right' : 'left';
  // Snap activation and hysteresis thresholds.
  const snapThreshold = 0.7;
  const snapRelease   = 0.3;

  let smoothMoving = false;
  let smoothMoveLevel = 0; // strongest normalized stick deflection this frame
  for (const controller of app.controllers) {
    const src = controller.userData.inputSource;
    if (!src) {
      continue;
    }

    // Use profile-aware axis reading with configured dead zone.
    const snap = app.controllerInput
      ? app.controllerInput.read(src)
      : { axes: { stickX: 0, stickY: 0 }, buttons: {}, hand: src.handedness };

    const { stickX: x = 0, stickY: y = 0 } = snap.axes;

    // Turn hand: snap turn.
    if (app.settings.enableSnapTurn && snap.hand === turnHand) {
      if (Math.abs(x) > snapThreshold && !controller.userData.snapLatched) {
        app.snapTurn(x > 0 ? -1 : 1, snap.hand); // push right → turn clockwise
        controller.userData.snapLatched = true;
      } else if (Math.abs(x) < snapRelease) {
        controller.userData.snapLatched = false;
      }
    }

    // Move hand: smooth locomotion (opt-in) in the head's facing plane.
    if (app.settings.enableSmoothMove && snap.hand === moveHand && Math.hypot(x, y) > 0) {
      // Lazy-init scratch objects; reused every frame instead of allocating
      // 4 objects per active gamepad at 90 Hz (Qiita "avoid new in render loop").
      if (!_locoQ) {
        _locoQ = new THREE.Quaternion();
        _locoFwd = new THREE.Vector3();
        _locoRight = new THREE.Vector3();
        _locoMove = new THREE.Vector3();
      }
      app.camera.getWorldQuaternion(_locoQ);
      const forward = _locoFwd.set(0, 0, -1).applyQuaternion(_locoQ);
      forward.y = 0;
      forward.normalize();
      const right = _locoRight.set(1, 0, 0).applyQuaternion(_locoQ);
      right.y = 0;
      right.normalize();
      const move = _locoMove.set(0, 0, 0)
        .addScaledVector(forward, -y) // stick up → forward
        .addScaledVector(right, x);
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(app.settings.smoothMoveSpeed * dt);
        app.playerRig.position.add(move);
        smoothMoving = true;
        // Track how far the stick is pushed (dead-zone output is already
        // normalized to (0,1]) so the comfort vignette can scale with actual
        // glide speed rather than snapping to full strength (adaptive FOV
        // restriction). Take the strongest deflection across both hands.
        smoothMoveLevel = Math.max(smoothMoveLevel, Math.min(1, Math.hypot(x, y)));
      }
    }
  }

  // Engage the comfort vignette while continuously moving, scaled by how
  // fast the user is actually gliding (see ComfortSystem.updateVignette).
  if (app.comfortSystem) {
    app.comfortSystem.externalMotion = smoothMoving;
    app.comfortSystem.externalMotionLevel = smoothMoveLevel;
  }
}

export function updateButtonInput(app) {
  if (!app.controllerInput) {
    return;
  }

  // Which hand is which depends on southpaw setting.
  const pointerHand = app.settings.southpaw ? 'left'  : 'right';
  const utilityHand = app.settings.southpaw ? 'right' : 'left';

  for (const controller of app.controllers) {
    const src = controller.userData.inputSource;
    if (!src) {
      continue;
    }

    const snap = app.controllerInput.read(src);
    const hand = snap.hand;
    const btn  = snap.buttons;

    // Play a brief haptic click for any face/thumb button press.
    const anyJustPressed = Object.values(btn).some(b => b.justPressed);
    if (anyJustPressed && app.hapticFeedback) {
      app.hapticFeedback.playPattern(hand, 'click');
    }

    if (hand === pointerHand) {
      // Browser navigation — available only when a tab is open.
      const tab = app.tabManager?.getActiveTab();
      if (tab) {
        if (btn.faceA?.justPressed) {
          const moved = tab.goForward?.();
          if (app.captionSystem?.enabled) {
            app.captionSystem.show(moved ? t('vr.msg.goingForward') : t('vr.msg.noNextPage'));
          }
        }
        if (btn.faceB?.justPressed) {
          const moved = tab.goBack?.();
          if (app.captionSystem?.enabled) {
            app.captionSystem.show(moved ? t('vr.msg.goingBack') : t('vr.msg.noPreviousPage'));
          }
        }
      }
      // Recenter: snap the player rig back to the origin.
      if (btn.thumbstickClick?.justPressed) {
        app.recenter();
        if (app.hapticFeedback) {
          app.hapticFeedback.playPattern(hand, 'click');
        }
      }

    } else if (hand === utilityHand) {
      // Toggle bookmarks/history panel.
      if (btn.faceA?.justPressed && app.bookmarkPanel) {
        app.bookmarkPanel.toggle();
        if (app.captionSystem && app.captionSystem.enabled) {
          app.captionSystem.show(app.bookmarkPanel.visible ? t('vr.msg.bookmarksOpen') : t('vr.msg.bookmarksClosed'));
        }
      }
      // Toggle settings panel.
      if ((btn.faceB?.justPressed || btn.menu?.justPressed) && app.settingsPanel) {
        app.settingsPanel.visible = !app.settingsPanel.visible;
        app.settingsPanel.mesh && (app.settingsPanel.mesh.visible = app.settingsPanel.visible);
        app.semanticDOM?.setSettingsExpanded(app.settingsPanel.visible);
        // Caption so users who rely on text feedback know whether the panel
        // opened or closed — the face/menu button click haptic is generic
        // and doesn't distinguish panel-open from panel-close.
        if (app.captionSystem && app.captionSystem.enabled) {
          app.captionSystem.show(app.settingsPanel.visible ? t('vr.msg.settingsOpen') : t('vr.msg.settingsClosed'));
        }
      }
      // Toggle VR keyboard.
      if (btn.thumbstickClick?.justPressed && app.vrKeyboard) {
        app.vrKeyboard.visible ? app.vrKeyboard.hide() : app.vrKeyboard.show();
        if (app.captionSystem && app.captionSystem.enabled) {
          app.captionSystem.show(`Keyboard: ${app.vrKeyboard.visible ? 'open' : 'closed'}`);
        }
      }
    }
  }
}

export function snapTurn(app, direction, hand = null) {
  const angleDeg = app.settings.snapTurnAngle || 30;
  const angle = direction * THREE.MathUtils.degToRad(angleDeg);
  const head = new THREE.Vector3();
  app.camera.getWorldPosition(head);
  const up = new THREE.Vector3(0, 1, 0);
  // Rotate the rig's origin around the head pivot, then rotate its orientation;
  // together this keeps the head fixed while turning the world.
  app.playerRig.position.sub(head).applyAxisAngle(up, angle).add(head);
  app.playerRig.rotateOnWorldAxis(up, angle);

  // Haptic confirmation on the triggering hand — same lightweight pulse as a
  // button click. Fires for all users: the turn always deserves tactile
  // acknowledgement regardless of whether it was animated.
  if (app.hapticFeedback && hand) {
    app.hapticFeedback.playPattern(hand, 'click');
  }

  // Directional caption for caption-reliant users: the snap turn is always
  // instantaneous (no animation regardless of prefers-reduced-motion), so
  // there is no visual cue that the world moved. Announce direction and
  // angle whenever captions are enabled (WCAG 1.3.3 Sensory Characteristics,
  // WCAG 4.1.3 Status Messages). Previously gated on osReducedMotion(), but
  // that excluded users who rely on captions without requesting reduced motion.
  if (app.captionSystem && app.captionSystem.enabled) {
    app.captionSystem.show(snapTurnLabel(direction, angleDeg));
  }
}

export function updateTeleport(app) {
  const t = app.teleport;
  if (!t.active || !t.controller || !app.floorMesh) {
    return;
  }
  const hit = app.raycasterFromController(t.controller).intersectObject(app.floorMesh, false)[0];
  if (hit) {
    t.valid = true;
    t.target = hit.point.clone();
    if (t.marker) {
      t.marker.position.set(hit.point.x, hit.point.y + 0.01, hit.point.z);
      t.marker.visible = true;
    }
  } else {
    t.valid = false;
    if (t.marker) {
      t.marker.visible = false;
    }
  }
}

export function onControllerSelect(app, controller, isStart) {
  if (!isStart) {
    // Releasing the trigger ends an in-progress panel grab (grab-to-move).
    // This is independent of the interactables hit-test below, which only
    // ever fires on press — a drag has no "hit" to re-test on release.
    if (app.windowManager?.isGrabbing && controller === app._grabController) {
      app.windowManager.endGrab();
      app._grabController = null;
      firePanelReleaseFeedback(controller, app.hapticFeedback, app.captionSystem);
    }
    return;
  }
  if (app.interactables.length === 0) {
    return;
  }
  const hit = app.raycasterFromController(controller)
    .intersectObjects(app.interactables, false)
    .find(h => isWorldVisible(h.object));
  if (!hit) {
    return;
  }
  const handlers = hit.object.userData.interactable;
  if (handlers && handlers.onSelect) {
    handlers.onSelect({ intersection: hit, controller });
  }
  // Haptic click on the selecting hand confirms that the trigger registered
  // on an interactable, giving tactile parity with face-button presses.
  if (app.hapticFeedback) {
    const hand = controller.userData?.inputSource?.handedness || 'right';
    app.hapticFeedback.playPattern(hand, 'click');
  }
  // Also emit a DOM-style event for any external listeners.
  if (hit.object.dispatchEvent) {
    hit.object.dispatchEvent({ type: 'qui-select', intersection: hit, controller });
  }
}


export function updateHover(app ) {
  if (app.interactables.length === 0) {
    return;
  }
  for (const controller of app.controllers) {
    const hit = app.raycasterFromController(controller)
      .intersectObjects(app.interactables, false)
      .find(h => isWorldVisible(h.object));
    const obj = hit ? hit.object : null;
    const prev = controller.userData.hovered || null;
    if (prev === obj) {
      continue;
    }
    if (prev && prev.userData.interactable && prev.userData.interactable.onHoverEnd) {
      prev.userData.interactable.onHoverEnd();
    }
    if (obj && obj.userData.interactable && obj.userData.interactable.onHover) {
      obj.userData.interactable.onHover();
    }
    controller.userData.hovered = obj;
  }
}

export function onTeleportStart(app, controller) {
  if (!app.settings.enableTeleport || !app.floorMesh) {
    return;
  }
  app.teleport.active = true;
  app.teleport.controller = controller;
}

export function onTeleportEnd(app ) {
  const t = app.teleport;
  if (t.active && t.valid && t.target) {
    // Move the rig by the delta between the head's ground position and the
    // target so the user ends up standing on the marker.
    const head = new THREE.Vector3();
    app.camera.getWorldPosition(head);
    app.playerRig.position.x += t.target.x - head.x;
    app.playerRig.position.z += t.target.z - head.z;

    // Cross-modal landing confirmation: haptic impact on the triggering
    // controller + caption for caption-enabled users.
    fireTeleportFeedback(t.controller, app.hapticFeedback, app.captionSystem);
  }
  app._resetTeleportAim();
}

export function _resetTeleportAim(app ) {
  const t = app.teleport;
  t.active = false;
  t.valid = false;
  t.controller = null;
  if (t.marker) {
    t.marker.visible = false;
  }
}

export function _cancelTeleportIfAimedBy(app, controller) {
  if (app.teleport.active && app.teleport.controller === controller) {
    app._resetTeleportAim();
  }
}
