/**
 * Multiplayer System for VR Collaboration — REQUIRES EXTERNAL INFRA
 *
 * Status: Implemented but requires a WebRTC signaling server to function.
 * No reference signaling server is bundled in this repo.
 * Enable via: VRApp.settings.enableMultiplayer = true  (default: false)
 *
 * Minimum required: a WebSocket signaling server that forwards SDP offer/answer
 * and ICE candidates between peers. See docs/ARCHITECTURE.md for the expected
 * message protocol.
 */

import * as THREE from 'three';
import { configureUITexture } from '../ui/canvasTexture.js';

// Backpressure high-water mark for data-channel sends. When a channel's
// bufferedAmount (app → SCTP send buffer) exceeds this, the link is congested
// and queuing more would grow the buffer without bound — risking a throw or
// memory bloat. Position/rotation updates are ephemeral (the next interval
// supersedes a dropped one), so skipping a send under backpressure is the
// correct trade-off. 256 KB leaves ample headroom for legitimate bursts while
// bounding growth far below the ~16 MB channel buffer limit.
export const MAX_BUFFERED_BYTES = 256 * 1024;

// Cap on consecutive WebRTC reconnect attempts for a single peer before it is
// treated as permanently gone (see _peerReconnectAttempts in the constructor).
export const MAX_PEER_RECONNECT_ATTEMPTS = 3;

/**
 * Whether a message may be sent on a data channel right now: the channel must
 * be open AND its buffered amount under the high-water mark. Pure / dependency-
 * free so the backpressure gate is unit-testable without a real RTCDataChannel.
 *
 * A missing/undefined bufferedAmount (older shims, test stubs) is treated as 0
 * so behaviour degrades to the previous "send if open".
 *
 * @param {{readyState?: string, bufferedAmount?: number}} channel
 * @param {number} [hwm=MAX_BUFFERED_BYTES]
 * @returns {boolean}
 */
export function canSendOnChannel(channel, hwm = MAX_BUFFERED_BYTES) {
  if (!channel || channel.readyState !== 'open') {
    return false;
  }
  return (channel.bufferedAmount || 0) <= hwm;
}

export class MultiplayerSystem {
  constructor(scene, spatialAudio, options = {}) {
    this.scene = scene;
    this.spatialAudio = spatialAudio;
    this.options = options;

    // Network state
    this.roomId = null;
    this.peerId = null;
    this.isHost = false;
    this.connected = false;

    // Peer connections
    this.peers = new Map();
    this.dataChannels = new Map();
    // Update-loop interval ids (initialised here so disconnect() before
    // startUpdateLoops() is safe).
    this.updateIntervals = [];

    // Signaling auto-reconnect state. The signaling socket can drop on a network
    // blip or a load-balancer idle timeout (AWS ALB caps idle WS at ~4000 s);
    // without recovery the user silently stops receiving new peers. A pending
    // reconnect timer id and the current backoff attempt count are tracked so
    // disconnect() can cancel an in-flight reconnect and the backoff can reset.
    this._signalingReconnectTimer = null;
    this._signalingReconnectAttempts = 0;

    // Per-peer WebRTC reconnect attempts. A peer connection can transition to
    // 'failed' (network drop, crash) without the signaling server ever
    // relaying a 'peer-left' message — the only path that previously cleaned
    // up an avatar and decremented stats.connectedPeers. Without a cap, a
    // permanently-gone peer left its avatar frozen in the scene forever
    // ("ghost avatar") and the connected-peer gauge drifted upward. Capped at
    // MAX_PEER_RECONNECT_ATTEMPTS; giving up runs the same handlePeerLeft()
    // teardown as a graceful departure.
    this._peerReconnectAttempts = new Map();

    // Player avatars
    this.avatars = new Map();
    this.localPlayer = null;

    // WebRTC configuration. Public Google STUN works out of the box; a TURN
    // server is required for peers behind symmetric NAT and must be supplied
    // by the deployer (the previously hardcoded numb.viagenie.ca TURN has been
    // defunct for years). Pass options.iceServers to add TURN.
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        ...(options.iceServers || [])
      ],
      iceCandidatePoolSize: 10
    };

    // Signaling server — must be provided; there is no default (the old
    // Heroku free-dyno endpoint was retired). Provide via options.signalingUrl
    // or a Vite env var (VITE_SIGNALING_URL).
    this.signalingServer = null;
    this.signalingUrl =
      options.signalingUrl ||
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SIGNALING_URL) ||
      null;

    // Network stats
    this.stats = {
      latency: 0,
      packetLoss: 0,
      bandwidth: 0,
      connectedPeers: 0,
      messagesSent: 0,
      messagesReceived: 0,
      messagesDropped: 0, // sends skipped under data-channel backpressure
      bytesIn: 0,
      bytesOut: 0
    };

    // Update rates
    this.updateRates = {
      position: 30,      // Hz - position updates
      rotation: 15,      // Hz - rotation updates
      animation: 10,     // Hz - animation state
      voice: 60         // Hz - voice data
    };

    // Interpolation
    this.interpolation = {
      enabled: true,
      factor: 0.2
    };
  }

  /**
   * Connect to multiplayer room
   */
  async connect(roomId, options = {}) {
    if (!this.signalingUrl) {
      throw new Error(
        'MultiplayerSystem: no signaling server configured. Pass options.signalingUrl ' +
        'to the constructor or set VITE_SIGNALING_URL. Multiplayer is experimental ' +
        'and requires a signaling server (and a TURN server for many networks).'
      );
    }

    this.roomId = roomId;
    this.peerId = this.generatePeerId();
    this.isHost = options.host || false;

    console.debug(`MultiplayerSystem: Connecting to room ${roomId} as ${this.peerId}`);

    try {
      // Connect to signaling server
      await this.connectSignaling();

      // Join or create room
      if (this.isHost) {
        await this.createRoom();
      } else {
        await this.joinRoom();
      }

      // Setup local player
      this.setupLocalPlayer();

      // Start update loops
      this.startUpdateLoops();

      this.connected = true;
      console.debug('MultiplayerSystem: Connected successfully');

    } catch (error) {
      console.error('MultiplayerSystem: Connection failed', error);
      throw error;
    }
  }

  /**
   * Connect to signaling server
   */
  async connectSignaling() {
    return new Promise((resolve, reject) => {
      this.signalingServer = new WebSocket(this.signalingUrl);

      this.signalingServer.onopen = () => {
        console.debug('MultiplayerSystem: Signaling server connected');

        // Register peer
        this.sendSignal({
          type: 'register',
          peerId: this.peerId,
          roomId: this.roomId
        });

        resolve();
      };

      this.signalingServer.onerror = (error) => {
        console.error('MultiplayerSystem: Signaling error', error);
        reject(error);
      };

      this.signalingServer.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (e) {
          console.warn('MultiplayerSystem: dropping malformed signaling message', e);
          return;
        }
        this.handleSignaling(message);
      };

      // Auto-reconnect on an unexpected close. disconnect() nulls this handler
      // before close()ing, so reaching here means the drop was NOT intentional
      // (network blip, server/LB idle timeout). Re-establish with exponential
      // backoff; connectSignaling() re-registers the peer on open, restoring
      // the room membership.
      this.signalingServer.onclose = (event) => {
        if (!this.connected) {
          return; // not in a room — nothing to restore
        }
        console.warn(`MultiplayerSystem: signaling closed (code ${event && event.code}); scheduling reconnect`);
        this._scheduleSignalingReconnect();
      };
    });
  }

  /**
   * Schedule a signaling reconnect with capped exponential backoff
   * (1 s, 2 s, 4 s … 30 s). Idempotent: a second call while a reconnect is
   * already pending is a no-op, so a burst of close/error events can't spawn
   * parallel reconnect timers.
   */
  _scheduleSignalingReconnect() {
    if (this._signalingReconnectTimer || !this.connected) {
      return;
    }
    const attempt = this._signalingReconnectAttempts;
    const delay = Math.min(30000, 1000 * Math.pow(2, attempt));
    this._signalingReconnectAttempts = attempt + 1;
    this._signalingReconnectTimer = setTimeout(() => {
      this._signalingReconnectTimer = null;
      if (!this.connected) {
        return; // disconnected while waiting
      }
      this.connectSignaling()
        .then(() => { this._signalingReconnectAttempts = 0; }) // recovered
        .catch(() => { this._scheduleSignalingReconnect(); }); // retry, longer backoff
    }, delay);
  }

  /**
   * Handle signaling messages
   */
  async handleSignaling(message) {
    switch (message.type) {
    case 'peer-joined':
      await this.handlePeerJoined(message.peerId);
      break;

    case 'peer-left':
      this.handlePeerLeft(message.peerId);
      break;

    case 'offer':
      await this.handleOffer(message);
      break;

    case 'answer':
      await this.handleAnswer(message);
      break;

    case 'ice-candidate':
      await this.handleIceCandidate(message);
      break;

    case 'room-full':
      console.warn('MultiplayerSystem: Room is full');
      break;
    }
  }

  /**
   * Handle new peer joining
   */
  async handlePeerJoined(peerId) {
    console.debug(`MultiplayerSystem: Peer ${peerId} joined`);

    // Create peer connection
    const pc = new RTCPeerConnection(this.rtcConfig);
    this.peers.set(peerId, pc);

    // Setup peer connection handlers
    this.setupPeerConnection(pc, peerId);

    // Create data channel
    const dataChannel = pc.createDataChannel('data', {
      ordered: false,      // Unordered for low latency
      maxRetransmits: 0    // No retransmits for real-time data
    });

    this.setupDataChannel(dataChannel, peerId);

    // Create offer if we're the initiator
    if (this.isHost || this.peerId < peerId) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendSignal({
        type: 'offer',
        target: peerId,
        offer: offer
      });
    }
  }

  /**
   * Handle a peer leaving the room: tear down its connection, data channel,
   * avatar, and spatial voice source, and keep stats consistent.
   * (Previously referenced from handleSignaling but never implemented, which
   * threw on every 'peer-left' message.)
   */
  handlePeerLeft(peerId) {
    console.debug(`MultiplayerSystem: Peer ${peerId} left`);

    this._peerReconnectAttempts.delete(peerId);

    // Close and drop the peer connection.
    const pc = this.peers.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch (e) { /* already closed */ }
      this.peers.delete(peerId);
      // The peer was counted as connected; keep the gauge from drifting.
      this.stats.connectedPeers = Math.max(0, this.stats.connectedPeers - 1);
    }

    // Close and drop the data channel.
    const channel = this.dataChannels.get(peerId);
    if (channel) {
      try {
        channel.close();
      } catch (e) { /* already closed */ }
      this.dataChannels.delete(peerId);
    }

    // Remove and dispose the avatar.
    this.removeAvatar(peerId);

    // Release the spatial voice source, if any.
    if (this.spatialAudio && this.spatialAudio.removeVoiceSource) {
      this.spatialAudio.removeVoiceSource(peerId);
    }

    this.onPeerDisconnected(peerId);
  }

  /** Remove a peer's avatar from the scene and dispose its GPU resources. */
  removeAvatar(peerId) {
    const avatar = this.avatars.get(peerId);
    if (!avatar) {
      return;
    }
    this.scene.remove(avatar.group);
    this._disposeAvatar(avatar);
    this.avatars.delete(peerId);
  }

  /** Dispose all geometries/materials/textures under an avatar group. */
  _disposeAvatar(avatar) {
    if (!avatar || !avatar.group) {
      return;
    }
    avatar.group.traverse(obj => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach(m => {
          // The name label's SpriteMaterial owns a CanvasTexture (map) that
          // .dispose() on the material alone does not free — same texture-
          // leak class already fixed for WebPanel/TabManager/BookmarkPanel.
          if (m.map) {
            m.map.dispose();
          }
          m.dispose();
        });
      }
    });
  }

  /** Hook for subclasses/UI; no-op by default. */
  onPeerConnected(_peerId) {}

  /** Hook for subclasses/UI; no-op by default. */
  onPeerDisconnected(_peerId) {}

  /**
   * Setup peer connection handlers
   */
  setupPeerConnection(pc, peerId) {
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'ice-candidate',
          target: peerId,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.debug(`MultiplayerSystem: Connection state ${peerId}: ${pc.connectionState}`);

      if (pc.connectionState === 'connected') {
        this.stats.connectedPeers++;
        this._peerReconnectAttempts.delete(peerId);
        this.onPeerConnected(peerId);
      } else if (pc.connectionState === 'failed') {
        const attempts = (this._peerReconnectAttempts.get(peerId) || 0) + 1;
        if (attempts > MAX_PEER_RECONNECT_ATTEMPTS) {
          // Peer is permanently gone: the signaling server never relayed a
          // 'peer-left' message, so run the same teardown here to avoid a
          // ghost avatar frozen in the scene and a stats.connectedPeers gauge
          // that never recovers.
          this._peerReconnectAttempts.delete(peerId);
          this.handlePeerLeft(peerId);
        } else {
          this._peerReconnectAttempts.set(peerId, attempts);
          this.reconnectPeer(peerId);
        }
      }
    };

    // Handle data channel
    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, peerId);
    };
  }

  /**
   * Handle a failed peer connection.  Tears down the broken connection and
   * triggers re-negotiation by calling handlePeerJoined() again if the
   * signaling server is still connected.
   */
  reconnectPeer(peerId) {
    console.debug(`MultiplayerSystem: Reconnecting to peer ${peerId}`);
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    const dc = this.dataChannels.get(peerId);
    if (dc) {
      dc.close();
      this.dataChannels.delete(peerId);
    }
    // Only attempt re-negotiation while still connected to the signaling server.
    if (this.signalingServer && this.signalingServer.readyState === WebSocket.OPEN) {
      this.handlePeerJoined(peerId).catch((e) => {
        console.error(`MultiplayerSystem: Reconnect to ${peerId} failed`, e);
      });
    }
  }

  /**
   * Setup data channel
   */
  setupDataChannel(dataChannel, peerId) {
    dataChannel.onopen = () => {
      console.debug(`MultiplayerSystem: Data channel open with ${peerId}`);
      this.dataChannels.set(peerId, dataChannel);

      // Send initial state
      this.sendToPeer(peerId, {
        type: 'player-info',
        data: this.getLocalPlayerInfo()
      });
    };

    dataChannel.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch (e) {
        console.warn(`MultiplayerSystem: dropping malformed data message from ${peerId}`, e);
        return;
      }
      this.handleDataMessage(peerId, payload);
      this.stats.messagesReceived++;
      this.stats.bytesIn += event.data.length;
    };

    dataChannel.onerror = (error) => {
      console.error(`MultiplayerSystem: Data channel error ${peerId}`, error);
    };

    dataChannel.onclose = () => {
      console.debug(`MultiplayerSystem: Data channel closed ${peerId}`);
      this.dataChannels.delete(peerId);
    };
  }

  /**
   * Handle data channel messages
   */
  handleDataMessage(peerId, message) {
    switch (message.type) {
    case 'player-info':
      this.updatePlayerInfo(peerId, message.data);
      break;

    case 'position':
      this.updateAvatarPosition(peerId, message.data);
      break;

    case 'rotation':
      this.updateAvatarRotation(peerId, message.data);
      break;

    case 'hand-pose':
      this.updateHandPose(peerId, message.data);
      break;

    case 'gesture':
      this.handleRemoteGesture(peerId, message.data);
      break;

    case 'voice':
      this.handleVoiceData(peerId, message.data);
      break;

    case 'action':
      this.handleRemoteAction(peerId, message.data);
      break;

    case 'ping':
      this.sendToPeer(peerId, { type: 'pong', timestamp: message.timestamp });
      break;

    case 'pong':
      this.updateLatency(peerId, message.timestamp);
      break;
    }
  }

  /**
   * Setup local player
   */
  setupLocalPlayer() {
    // Create local player representation
    this.localPlayer = {
      id: this.peerId,
      position: new THREE.Vector3(0, 1.6, 0),
      rotation: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1),
      hands: {
        left: { position: null, rotation: null, gesture: null },
        right: { position: null, rotation: null, gesture: null }
      },
      info: {
        name: `Player_${this.peerId.slice(0, 6)}`,
        avatar: 'default',
        color: this.generatePlayerColor()
      }
    };
  }

  getLocalPlayerInfo() {
    if (!this.localPlayer) {
      return {};
    }
    const p = this.localPlayer;
    return {
      id: p.id,
      position: { x: p.position.x, y: p.position.y, z: p.position.z },
      rotation: { x: p.rotation.x, y: p.rotation.y, z: p.rotation.z, w: p.rotation.w },
      hands: p.hands,
      info: p.info
    };
  }

  /**
   * Start update loops
   */
  startUpdateLoops() {
    // Interval IDs are stored so disconnect() can stop them; otherwise these
    // loops (and pingAllPeers in particular) keep firing for the page
    // lifetime even after disconnecting.
    this.updateIntervals = [
      // Position updates
      setInterval(() => {
        if (this.connected) {
          this.broadcastPosition();
        }
      }, 1000 / this.updateRates.position),

      // Rotation updates
      setInterval(() => {
        if (this.connected) {
          this.broadcastRotation();
        }
      }, 1000 / this.updateRates.rotation),

      // Latency monitoring
      setInterval(() => {
        this.pingAllPeers();
      }, 1000)
    ];
  }

  /**
   * Broadcast local position
   */
  broadcastPosition() {
    if (!this.localPlayer) {
      return;
    }

    const message = {
      type: 'position',
      data: {
        x: this.localPlayer.position.x,
        y: this.localPlayer.position.y,
        z: this.localPlayer.position.z,
        timestamp: performance.now()
      }
    };

    this.broadcast(message);
  }

  /**
   * Broadcast local rotation
   */
  broadcastRotation() {
    if (!this.localPlayer) {
      return;
    }

    const message = {
      type: 'rotation',
      data: {
        x: this.localPlayer.rotation.x,
        y: this.localPlayer.rotation.y,
        z: this.localPlayer.rotation.z,
        w: this.localPlayer.rotation.w,
        timestamp: performance.now()
      }
    };

    this.broadcast(message);
  }

  /**
   * Handle a 'player-info' message (sent immediately when a data channel
   * opens — see setupDataChannel's onopen). This was previously called from
   * handleDataMessage but never defined: every single peer connection threw
   * a TypeError the instant the first message arrived, and since nothing
   * else in the live message flow ever called createAvatar(), no remote
   * peer's avatar was ever created — updateAvatarPosition/Rotation/HandPose
   * all early-return on a missing `this.avatars.get(peerId)`, so avatar sync
   * was completely non-functional in a real multiplayer session despite
   * being fully implemented and unit-tested in isolation.
   *
   * Creates the avatar on first contact; refreshes its stored info (e.g. a
   * changed display name) on subsequent player-info messages.
   */
  updatePlayerInfo(peerId, info) {
    if (!info) {
      return;
    }
    const avatar = this.avatars.get(peerId);
    if (!avatar) {
      this.createAvatar(peerId, info);
      return;
    }
    avatar.info = info;
  }

  /**
   * Build a billboard name label shown above a peer's avatar.
   *
   * Previously a stub ("Would create 3D text in production"): info.name was
   * already tracked and transmitted (getLocalPlayerInfo/updatePlayerInfo) but
   * never rendered, leaving every remote avatar visually anonymous. Uses the
   * same CanvasTexture pattern as every other in-VR UI surface (captions,
   * toasts, chrome bar); THREE.Sprite auto-billboards so the label always
   * faces the viewer without per-frame orientation code.
   *
   * @param {string} name
   * @returns {THREE.Sprite}
   */
  _buildNameLabel(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Code-point-aware slice so a long/CJK name can't be cut mid-surrogate-pair.
    const label = Array.from(String(name || '')).slice(0, 20).join('');
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);

    const texture = configureUITexture(new THREE.CanvasTexture(canvas));
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.6, 0.15, 1);
    sprite.name = 'nameLabel';
    return sprite;
  }

  /**
   * Create or update avatar for peer
   */
  createAvatar(peerId, info) {
    if (this.avatars.has(peerId)) {
      return;
    }

    // Create avatar mesh
    const geometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
    const material = new THREE.MeshPhongMaterial({
      color: info.color || 0x00ff00,
      emissive: info.color || 0x00ff00,
      emissiveIntensity: 0.2
    });

    const avatar = new THREE.Group();
    const body = new THREE.Mesh(geometry, material);
    avatar.add(body);

    // Add head
    const headGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const head = new THREE.Mesh(headGeometry, material);
    head.position.y = 1;
    avatar.add(head);

    // Add hands
    const handGeometry = new THREE.SphereGeometry(0.05, 6, 6);
    const leftHand = new THREE.Mesh(handGeometry, material);
    const rightHand = new THREE.Mesh(handGeometry, material);

    leftHand.name = 'leftHand';
    rightHand.name = 'rightHand';

    avatar.add(leftHand);
    avatar.add(rightHand);

    // Add name label — billboard sprite above the head so peers can tell
    // each other apart; otherwise every avatar is an anonymous colored blob.
    const nameLabel = this._buildNameLabel(info.name || peerId);
    nameLabel.position.y = 1.35; // above the head sphere (head at y=1, r=0.2)
    avatar.add(nameLabel);

    // Store avatar data
    const avatarData = {
      group: avatar,
      body: body,
      head: head,
      hands: { left: leftHand, right: rightHand },
      nameLabel: nameLabel,
      info: info,
      lastUpdate: performance.now(),
      interpolation: {
        fromPosition: new THREE.Vector3(),
        toPosition: new THREE.Vector3(),
        fromRotation: new THREE.Quaternion(),
        toRotation: new THREE.Quaternion(),
        progress: 0
      }
    };

    this.avatars.set(peerId, avatarData);
    this.scene.add(avatar);

    console.debug(`MultiplayerSystem: Created avatar for ${peerId}`);
  }

  /**
   * Update avatar position with interpolation
   */
  updateAvatarPosition(peerId, data) {
    const avatar = this.avatars.get(peerId);
    if (!avatar) {
      return;
    }

    if (this.interpolation.enabled) {
      // Store interpolation targets
      avatar.interpolation.fromPosition.copy(avatar.group.position);
      avatar.interpolation.toPosition.set(data.x, data.y, data.z);
      avatar.interpolation.progress = 0;
    } else {
      // Direct update
      avatar.group.position.set(data.x, data.y, data.z);
    }

    avatar.lastUpdate = performance.now();
  }

  /**
   * Update avatar rotation with interpolation
   */
  updateAvatarRotation(peerId, data) {
    const avatar = this.avatars.get(peerId);
    if (!avatar) {
      return;
    }

    if (this.interpolation.enabled) {
      // Store interpolation targets
      avatar.interpolation.fromRotation.copy(avatar.group.quaternion);
      avatar.interpolation.toRotation.set(data.x, data.y, data.z, data.w);
      avatar.interpolation.progress = 0;
    } else {
      // Direct update
      avatar.group.quaternion.set(data.x, data.y, data.z, data.w);
    }
  }

  /**
   * Update hand pose
   */
  updateHandPose(peerId, data) {
    const avatar = this.avatars.get(peerId);
    if (!avatar) {
      return;
    }

    if (data.hand === 'left' && avatar.hands.left) {
      avatar.hands.left.position.set(data.position.x, data.position.y, data.position.z);
      avatar.hands.left.quaternion.set(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);
    } else if (data.hand === 'right' && avatar.hands.right) {
      avatar.hands.right.position.set(data.position.x, data.position.y, data.position.z);
      avatar.hands.right.quaternion.set(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);
    }
  }

  /**
   * Update frame - interpolate avatar positions
   */
  update(deltaTime) {
    if (!this.interpolation.enabled) {
      return;
    }

    this.avatars.forEach((avatar, _peerId) => {
      if (avatar.interpolation.progress < 1) {
        avatar.interpolation.progress += deltaTime * this.interpolation.factor;
        avatar.interpolation.progress = Math.min(avatar.interpolation.progress, 1);

        // Lerp position
        avatar.group.position.lerpVectors(
          avatar.interpolation.fromPosition,
          avatar.interpolation.toPosition,
          avatar.interpolation.progress
        );

        // Slerp rotation
        avatar.group.quaternion.slerpQuaternions(
          avatar.interpolation.fromRotation,
          avatar.interpolation.toRotation,
          avatar.interpolation.progress
        );
      }
      // else: progress has reached 1 (interpolation caught up to the last
      // known sample) and no new update has arrived yet. The avatar simply
      // holds its last position/rotation — a static freeze — rather than
      // extrapolating a guessed position. An earlier "extrapolation" branch
      // here computed timeSinceUpdate but never used it (dead code — the
      // config flag implied a working feature that did nothing); removed
      // rather than half-implemented, since a static hold is a safe fallback
      // and inventing unverified velocity-prediction math risks a worse
      // artifact (overshooting past where a stopped peer actually is).
    });
  }

  /**
   * Send message to specific peer
   */
  sendToPeer(peerId, message) {
    const channel = this.dataChannels.get(peerId);
    // Skip under backpressure: queuing onto a congested channel grows
    // bufferedAmount without bound (see canSendOnChannel).
    if (canSendOnChannel(channel)) {
      const data = JSON.stringify(message);
      channel.send(data);
      this.stats.messagesSent++;
      this.stats.bytesOut += data.length;
    } else {
      this.stats.messagesDropped++;
    }
  }

  /**
   * Broadcast message to all peers
   */
  broadcast(message) {
    this.dataChannels.forEach((channel, _peerId) => {
      if (canSendOnChannel(channel)) {
        const data = JSON.stringify(message);
        channel.send(data);
        this.stats.messagesSent++;
        this.stats.bytesOut += data.length;
      } else {
        this.stats.messagesDropped++;
      }
    });
  }

  /**
   * Send signaling message
   */
  sendSignal(message) {
    if (this.signalingServer && this.signalingServer.readyState === WebSocket.OPEN) {
      this.signalingServer.send(JSON.stringify({
        ...message,
        from: this.peerId,
        room: this.roomId
      }));
    }
  }

  /**
   * Ping all peers for latency measurement
   */
  pingAllPeers() {
    const timestamp = performance.now();
    this.broadcast({
      type: 'ping',
      timestamp: timestamp
    });
  }

  /**
   * Update latency for peer
   */
  updateLatency(peerId, sentTimestamp) {
    const rtt = performance.now() - sentTimestamp;
    this.stats.latency = (this.stats.latency * 0.9) + (rtt * 0.1); // EMA
  }

  /**
   * Handle remote gesture
   */
  handleRemoteGesture(peerId, gesture) {
    const avatar = this.avatars.get(peerId);
    if (!avatar) {
      return;
    }

    // Visual feedback for gesture
    console.debug(`MultiplayerSystem: ${peerId} performed ${gesture.type}`);

    // Play spatial sound at avatar position
    if (this.spatialAudio && gesture.type === 'clap') {
      this.spatialAudio.play('clap', 'clap', avatar.group.position);
    }
  }

  /**
   * Disconnect from room
   */
  disconnect() {
    // This is an intentional teardown: flip `connected` off first so a close
    // event fired by the explicit close() below can't schedule a reconnect.
    this.connected = false;

    // Cancel any pending signaling reconnect timer.
    if (this._signalingReconnectTimer) {
      clearTimeout(this._signalingReconnectTimer);
      this._signalingReconnectTimer = null;
    }
    this._signalingReconnectAttempts = 0;

    // Stop the position/rotation/ping update loops.
    if (this.updateIntervals) {
      this.updateIntervals.forEach((id) => clearInterval(id));
      this.updateIntervals = [];
    }

    // Close all peer connections
    this.peers.forEach((pc, _peerId) => {
      pc.close();
    });

    // Close signaling connection and null it out to release handler refs.
    // onclose is nulled too so the intentional close() can't trigger reconnect.
    if (this.signalingServer) {
      this.signalingServer.onmessage = null;
      this.signalingServer.onerror = null;
      this.signalingServer.onopen = null;
      this.signalingServer.onclose = null;
      this.signalingServer.close();
      this.signalingServer = null;
    }

    // Remove all avatars (and free their GPU resources).
    this.avatars.forEach((avatar) => {
      this.scene.remove(avatar.group);
      this._disposeAvatar(avatar);
    });

    // Clear data
    this.peers.clear();
    this.dataChannels.clear();
    this.avatars.clear();
    this._peerReconnectAttempts.clear();

    this.connected = false;
    console.debug('MultiplayerSystem: Disconnected');
  }

  /**
   * Generate unique peer ID
   */
  generatePeerId() {
    return `peer_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  }

  /**
   * Generate player color
   */
  generatePlayerColor() {
    const hue = Math.random() * 360;
    return new THREE.Color(`hsl(${hue}, 70%, 50%)`);
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      roomId: this.roomId,
      peerId: this.peerId,
      isHost: this.isHost,
      connected: this.connected,
      peersCount: this.peers.size,
      avatarsCount: this.avatars.size
    };
  }
}

/**
 * Usage:
 *
 * const multiplayer = new MultiplayerSystem(scene, spatialAudio);
 *
 * // Join room
 * await multiplayer.connect('room123', { host: false });
 *
 * // Update in render loop
 * multiplayer.update(deltaTime);
 *
 * // Update local player position
 * multiplayer.localPlayer.position.copy(camera.position);
 *
 * // Disconnect
 * multiplayer.disconnect();
 */
