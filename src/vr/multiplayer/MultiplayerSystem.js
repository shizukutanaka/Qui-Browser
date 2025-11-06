/**
 * Multiplayer System for VR Collaboration
 * WebRTC-based peer-to-peer networking with spatial awareness
 *
 * John Carmack principle: Low latency is everything in VR
 */

export class MultiplayerSystem {
  constructor(scene, spatialAudio) {
    this.scene = scene;
    this.spatialAudio = spatialAudio;

    // Network state
    this.roomId = null;
    this.peerId = null;
    this.isHost = false;
    this.connected = false;

    // Peer connections
    this.peers = new Map();
    this.dataChannels = new Map();

    // Player avatars
    this.avatars = new Map();
    this.localPlayer = null;

    // WebRTC configuration
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:numb.viagenie.ca',
          username: 'webrtc@live.com',
          credential: 'muazkh'
        }
      ],
      iceCandidatePoolSize: 10
    };

    // Signaling server
    this.signalingServer = null;
    this.signalingUrl = 'wss://qui-browser-signaling.herokuapp.com';

    // Network stats
    this.stats = {
      latency: 0,
      packetLoss: 0,
      bandwidth: 0,
      connectedPeers: 0,
      messagesSent: 0,
      messagesReceived: 0,
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
      factor: 0.2,
      extrapolation: true,
      maxExtrapolationTime: 100 // ms
    };
  }

  /**
   * Connect to multiplayer room
   */
  async connect(roomId, options = {}) {
    this.roomId = roomId;
    this.peerId = this.generatePeerId();
    this.isHost = options.host || false;

    console.log(`MultiplayerSystem: Connecting to room ${roomId} as ${this.peerId}`);

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
      console.log('MultiplayerSystem: Connected successfully');

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
        console.log('MultiplayerSystem: Signaling server connected');

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
        this.handleSignaling(JSON.parse(event.data));
      };
    });
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
    console.log(`MultiplayerSystem: Peer ${peerId} joined`);

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
      console.log(`MultiplayerSystem: Connection state ${peerId}: ${pc.connectionState}`);

      if (pc.connectionState === 'connected') {
        this.stats.connectedPeers++;
        this.onPeerConnected(peerId);
      } else if (pc.connectionState === 'failed') {
        this.reconnectPeer(peerId);
      }
    };

    // Handle data channel
    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, peerId);
    };
  }

  /**
   * Setup data channel
   */
  setupDataChannel(dataChannel, peerId) {
    dataChannel.onopen = () => {
      console.log(`MultiplayerSystem: Data channel open with ${peerId}`);
      this.dataChannels.set(peerId, dataChannel);

      // Send initial state
      this.sendToPeer(peerId, {
        type: 'player-info',
        data: this.getLocalPlayerInfo()
      });
    };

    dataChannel.onmessage = (event) => {
      this.handleDataMessage(peerId, JSON.parse(event.data));
      this.stats.messagesReceived++;
      this.stats.bytesIn += event.data.length;
    };

    dataChannel.onerror = (error) => {
      console.error(`MultiplayerSystem: Data channel error ${peerId}`, error);
    };

    dataChannel.onclose = () => {
      console.log(`MultiplayerSystem: Data channel closed ${peerId}`);
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

  /**
   * Start update loops
   */
  startUpdateLoops() {
    // Position updates
    setInterval(() => {
      if (this.connected) {
        this.broadcastPosition();
      }
    }, 1000 / this.updateRates.position);

    // Rotation updates
    setInterval(() => {
      if (this.connected) {
        this.broadcastRotation();
      }
    }, 1000 / this.updateRates.rotation);

    // Latency monitoring
    setInterval(() => {
      this.pingAllPeers();
    }, 1000);
  }

  /**
   * Broadcast local position
   */
  broadcastPosition() {
    if (!this.localPlayer) return;

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
    if (!this.localPlayer) return;

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
   * Create or update avatar for peer
   */
  createAvatar(peerId, info) {
    if (this.avatars.has(peerId)) return;

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

    // Add name label
    // Would create 3D text in production

    // Store avatar data
    const avatarData = {
      group: avatar,
      body: body,
      head: head,
      hands: { left: leftHand, right: rightHand },
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

    console.log(`MultiplayerSystem: Created avatar for ${peerId}`);
  }

  /**
   * Update avatar position with interpolation
   */
  updateAvatarPosition(peerId, data) {
    const avatar = this.avatars.get(peerId);
    if (!avatar) return;

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
    if (!avatar) return;

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
    if (!avatar) return;

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
    if (!this.interpolation.enabled) return;

    this.avatars.forEach((avatar, peerId) => {
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
      } else if (this.interpolation.extrapolation) {
        // Extrapolate if no recent updates
        const timeSinceUpdate = performance.now() - avatar.lastUpdate;
        if (timeSinceUpdate < this.interpolation.maxExtrapolationTime) {
          // Simple extrapolation based on velocity
          // Would calculate velocity in production
        }
      }
    });
  }

  /**
   * Send message to specific peer
   */
  sendToPeer(peerId, message) {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === 'open') {
      const data = JSON.stringify(message);
      channel.send(data);
      this.stats.messagesSent++;
      this.stats.bytesOut += data.length;
    }
  }

  /**
   * Broadcast message to all peers
   */
  broadcast(message) {
    this.dataChannels.forEach((channel, peerId) => {
      if (channel.readyState === 'open') {
        const data = JSON.stringify(message);
        channel.send(data);
        this.stats.messagesSent++;
        this.stats.bytesOut += data.length;
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
    if (!avatar) return;

    // Visual feedback for gesture
    console.log(`MultiplayerSystem: ${peerId} performed ${gesture.type}`);

    // Play spatial sound at avatar position
    if (this.spatialAudio && gesture.type === 'clap') {
      this.spatialAudio.play('clap', 'clap', avatar.group.position);
    }
  }

  /**
   * Disconnect from room
   */
  disconnect() {
    // Close all peer connections
    this.peers.forEach((pc, peerId) => {
      pc.close();
    });

    // Close signaling connection
    if (this.signalingServer) {
      this.signalingServer.close();
    }

    // Remove all avatars
    this.avatars.forEach((avatar, peerId) => {
      this.scene.remove(avatar.group);
    });

    // Clear data
    this.peers.clear();
    this.dataChannels.clear();
    this.avatars.clear();

    this.connected = false;
    console.log('MultiplayerSystem: Disconnected');
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