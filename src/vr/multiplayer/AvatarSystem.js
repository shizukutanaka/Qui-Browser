/**
 * FR-7.2: Basic multiplayer avatar presence system.
 * Represents remote peers as simple geometric avatars (head + hands) that
 * track the pose data broadcast by MultiplayerSystem.  No external
 * dependencies — geometry is built with Three.js primitives.
 */

import * as THREE from 'three';

const HEAD_COLOR  = 0x4a90d9;
const HAND_COLOR  = 0x7ed4a4;
const LABEL_SIZE  = 0.08;  // metres

export class AvatarSystem {
  /**
   * @param {THREE.Scene}    scene
   * @param {SpatialAudio}   [spatialAudio] — optional; enables spatial voice
   */
  constructor(scene, spatialAudio = null) {
    this.scene = scene;
    /** @type {import('../../audio/SpatialAudio.js').SpatialAudio|null} */
    this.spatialAudio = spatialAudio;
    // peerId → { group, head, leftHand, rightHand }
    this.avatars = new Map();
  }

  /**
   * Wire in a SpatialAudio instance after construction (or replace it).
   * All subsequent peer voice streams will use this instance.
   */
  connectSpatialAudio(spatialAudio) {
    this.spatialAudio = spatialAudio;
  }

  /**
   * FR-7.2: Attach the remote peer's audio stream to a spatial panner.
   * Call once when the WebRTC `ontrack` event fires for this peer.
   *
   * @param {string}      peerId
   * @param {MediaStream} mediaStream — the peer's remote audio track stream
   */
  setPeerVoiceStream(peerId, mediaStream) {
    if (!this.spatialAudio) {
      return;
    }
    const avatar = this.avatars.get(peerId);
    const pos = avatar
      ? { x: avatar.group.position.x,
        y: avatar.group.position.y,
        z: avatar.group.position.z }
      : { x: 0, y: 0, z: 0 };
    this.spatialAudio.createVoiceSource(peerId, mediaStream, pos);
  }

  // ── Geometry factories ────────────────────────────────────────────────────

  _makeHead() {
    const geo = new THREE.SphereGeometry(0.12, 16, 12);
    const mat = new THREE.MeshStandardMaterial({ color: HEAD_COLOR });
    return new THREE.Mesh(geo, mat);
  }

  _makeHand() {
    const geo = new THREE.SphereGeometry(0.04, 8, 6);
    const mat = new THREE.MeshStandardMaterial({ color: HAND_COLOR });
    return new THREE.Mesh(geo, mat);
  }

  // ── Peer lifecycle ────────────────────────────────────────────────────────

  /**
   * Add a new avatar for the given peer.  Safe to call repeatedly —
   * subsequent calls update the label text.
   *
   * @param {string} peerId
   * @param {string} [label] - Display name shown above the head
   */
  addPeer(peerId, label = '') {
    if (this.avatars.has(peerId)) {
      // Update label if already present.
      this._updateLabel(peerId, label);
      return;
    }

    const group = new THREE.Group();
    group.name = `avatar_${peerId}`;

    const head = this._makeHead();
    head.name = 'head';
    group.add(head);

    const leftHand = this._makeHand();
    leftHand.name = 'leftHand';
    leftHand.position.set(-0.25, -0.15, 0);
    group.add(leftHand);

    const rightHand = this._makeHand();
    rightHand.name = 'rightHand';
    rightHand.position.set(0.25, -0.15, 0);
    group.add(rightHand);

    this.scene.add(group);
    this.avatars.set(peerId, { group, head, leftHand, rightHand });

    if (label) {
      this._updateLabel(peerId, label);
    }
  }

  /**
   * Remove the avatar for a peer that has disconnected.
   */
  removePeer(peerId) {
    const avatar = this.avatars.get(peerId);
    if (!avatar) {
      return;
    }

    this.scene.remove(avatar.group);
    avatar.group.traverse(obj => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (obj.material.map) {
          obj.material.map.dispose();
        }
        obj.material.dispose();
      }
    });
    if (avatar._labelTex) {
      avatar._labelTex.dispose();
    }
    this.avatars.delete(peerId);

    // FR-7.2: release the spatial voice source for this peer.
    if (this.spatialAudio) {
      this.spatialAudio.removeVoiceSource(peerId);
    }
  }

  // ── Pose updates ──────────────────────────────────────────────────────────

  /**
   * Apply a pose update received from the signaling / data-channel layer.
   *
   * @param {string} peerId
   * @param {object} pose - { head, leftHand, rightHand } each with
   *   { position:{x,y,z}, quaternion:{x,y,z,w} }
   */
  updatePeerPose(peerId, pose) {
    const avatar = this.avatars.get(peerId);
    if (!avatar) {
      return;
    }

    if (pose.head) {
      const p = pose.head.position;
      const q = pose.head.quaternion;
      if (p) {
        avatar.group.position.set(p.x, p.y, p.z);
      }
      if (q) {
        avatar.group.quaternion.set(q.x, q.y, q.z, q.w);
      }

      // FR-7.2: keep the spatial voice panner in sync with the avatar head.
      if (p && this.spatialAudio) {
        this.spatialAudio.updateVoicePosition(peerId, p.x, p.y, p.z);
      }
    }

    if (pose.leftHand) {
      this._applyLocalPose(avatar.leftHand, pose.leftHand, avatar.group);
    }
    if (pose.rightHand) {
      this._applyLocalPose(avatar.rightHand, pose.rightHand, avatar.group);
    }
  }

  _applyLocalPose(mesh, pose, parent) {
    if (pose.position) {
      // Convert world → local relative to the group.
      const world = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z);
      parent.worldToLocal(world);
      mesh.position.copy(world);
    }
    if (pose.quaternion) {
      mesh.quaternion.set(
        pose.quaternion.x, pose.quaternion.y,
        pose.quaternion.z, pose.quaternion.w
      );
    }
  }

  // ── Label utility ─────────────────────────────────────────────────────────

  _updateLabel(peerId, label) {
    const avatar = this.avatars.get(peerId);
    if (!avatar || !label) {
      return;
    }

    // Remove old label if present, freeing its texture/material first so
    // repeated label updates don't leak VRAM.
    const existing = avatar.group.getObjectByName('label');
    if (existing) {
      avatar.group.remove(existing);
      if (existing.material) {
        if (existing.material.map) {
          existing.material.map.dispose();
        }
        existing.material.dispose();
      }
    }
    if (avatar._labelTex) {
      avatar._labelTex.dispose();
    }

    // Canvas-texture label floating above the head.
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    // roundRect is not available on every Canvas2D implementation.
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(0, 0, 256, 64, 8);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, 256, 64);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.slice(0, 20), 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.name = 'label';
    sprite.scale.set(0.4, 0.1, 1);
    sprite.position.set(0, 0.22, 0); // above head
    avatar.group.add(sprite);
    avatar._labelTex = tex;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Return ids of all currently rendered peers. */
  getPeerIds() {
    return [...this.avatars.keys()];
  }

  /** Remove all avatars (e.g. on session end). */
  dispose() {
    this.avatars.forEach((_, id) => this.removePeer(id));
  }
}
