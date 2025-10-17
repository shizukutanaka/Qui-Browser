/**
 * Qui Browser VR Gesture Controls
 * VRデバイス専用ジェスチャーコントロール機能
 *
 * 機能:
 * - WebXR Hand Tracking APIを使用したハンドトラッキング
 * - 基本ジェスチャーの認識と処理
 * - ジェスチャーイベントの発火
 * - コントローラーフォールバック
 * - 直感的なVRインタラクション
 */

class VRGestureControls {
  constructor() {
    this.isTracking = false;
    this.hands = new Map();
    this.gestureRecognizers = new Map();
    this.activeGestures = new Set();
    this.gestureCallbacks = new Map();
    this.fallbackMode = false;

    // ジェスチャー定義
    this.gestureDefinitions = {
      pinch: {
        description: '親指と人差し指でつまむ',
        detect: this.detectPinch.bind(this),
        minConfidence: 0.7
      },
      fist: {
        description: '握り拳',
        detect: this.detectFist.bind(this),
        minConfidence: 0.8
      },
      open: {
        description: '手のひらを開く',
        detect: this.detectOpenHand.bind(this),
        minConfidence: 0.6
      },
      point: {
        description: '人差し指で指さす',
        detect: this.detectPoint.bind(this),
        minConfidence: 0.7
      },
      thumbsUp: {
        description: '親指を立てる',
        detect: this.detectThumbsUp.bind(this),
        minConfidence: 0.7
      }
    };

    this.init();
  }

  init() {
    // Hand Tracking APIのサポート確認
    this.checkHandTrackingSupport();

    // ジェスチャー認識器の初期化
    this.initializeGestureRecognizers();

    // VRセッション監視
    this.setupVRSessionMonitoring();

    // フォールバック設定
    this.setupControllerFallback();

    console.log('[VR Gesture] VR Gesture Controls initialized');
  }

  /**
   * Hand Tracking APIサポート確認
   */
  async checkHandTrackingSupport() {
    if (!navigator.xr) {
      console.warn('[VR Gesture] WebXR not supported');
      this.fallbackMode = true;
      return;
    }

    try {
      const supported = await navigator.xr.isSessionSupported('immersive-vr');
      if (supported) {
        // Hand Tracking拡張のサポート確認
        const optionalFeatures = ['hand-tracking'];
        const session = await navigator.xr.requestSession('immersive-vr', {
          optionalFeatures
        });

        this.hasHandTracking = session.enabledFeatures?.includes('hand-tracking') || false;
        session.end();

        if (this.hasHandTracking) {
          console.log('[VR Gesture] Hand tracking is supported');
        } else {
          console.warn('[VR Gesture] Hand tracking not supported, using fallback');
          this.fallbackMode = true;
        }
      } else {
        console.warn('[VR Gesture] VR not supported');
        this.fallbackMode = true;
      }
    } catch (error) {
      console.warn('[VR Gesture] Hand tracking support check failed:', error);
      this.fallbackMode = true;
    }
  }

  /**
   * ジェスチャー認識器の初期化
   */
  initializeGestureRecognizers() {
    // 各ジェスチャーの認識器を初期化
    Object.entries(this.gestureDefinitions).forEach(([gestureName, definition]) => {
      this.gestureRecognizers.set(gestureName, {
        ...definition,
        active: false,
        lastDetected: 0,
        confidence: 0
      });
    });

    console.log('[VR Gesture] Gesture recognizers initialized');
  }

  /**
   * VRセッション監視の設定
   */
  setupVRSessionMonitoring() {
    if (window.WebXRManager) {
      window.WebXRManager.addEventListener('sessionstart', (event) => {
        this.onVRSessionStart(event.detail);
      });

      window.WebXRManager.addEventListener('sessionend', () => {
        this.onVRSessionEnd();
      });
    }
  }

  /**
   * VRセッション開始時の処理
   */
  onVRSessionStart(session) {
    console.log('[VR Gesture] VR session started, initializing gesture tracking');

    if (this.hasHandTracking && !this.fallbackMode) {
      this.startHandTracking(session);
    } else {
      this.startControllerFallback(session);
    }
  }

  /**
   * VRセッション終了時の処理
   */
  onVRSessionEnd() {
    console.log('[VR Gesture] VR session ended, stopping gesture tracking');

    this.stopHandTracking();
    this.clearActiveGestures();
  }

  /**
   * ハンドトラッキングの開始
   */
  startHandTracking(session) {
    this.isTracking = true;

    // ハンドトラッキングデータの処理
    session.addEventListener('inputsourceschange', (event) => {
      this.onInputSourcesChange(event);
    });

    // フレームごとのハンドデータ処理
    session.requestAnimationFrame((time, frame) => {
      if (this.isTracking) {
        this.processHandTrackingFrame(frame);
        session.requestAnimationFrame((time, frame) => this.processHandTrackingFrame(frame));
      }
    });

    console.log('[VR Gesture] Hand tracking started');
  }

  /**
   * ハンドトラッキングの停止
   */
  stopHandTracking() {
    this.isTracking = false;
    this.hands.clear();
    console.log('[VR Gesture] Hand tracking stopped');
  }

  /**
   * 入力ソース変更時の処理
   */
  onInputSourcesChange(event) {
    const session = event.target;

    // ハンド入力ソースの検出
    session.inputSources.forEach(inputSource => {
      if (inputSource.hand) {
        this.hands.set(inputSource.handedness, inputSource);
        console.log(`[VR Gesture] Hand detected: ${inputSource.handedness}`);
      }
    });
  }

  /**
   * ハンドトラッキングフレームの処理
   */
  processHandTrackingFrame(frame) {
    if (!this.isTracking) return;

    // 各ハンドのデータを処理
    this.hands.forEach((inputSource, handedness) => {
      if (inputSource.hand) {
        const handData = this.getHandData(frame, inputSource);
        if (handData) {
          this.processHandGestures(handedness, handData);
        }
      }
    });
  }

  /**
   * ハンドデータの取得
   */
  getHandData(frame, inputSource) {
    try {
      const hand = inputSource.hand;
      const handData = {
        joints: new Map(),
        wrist: null,
        confidence: 0
      };

      // 各ジョイントのデータを取得
      const jointNames = [
        'wrist',
        'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
        'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
        'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
        'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
        'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'
      ];

      let totalConfidence = 0;
      let jointCount = 0;

      jointNames.forEach(jointName => {
        const joint = hand.get(jointName);
        if (joint) {
          const pose = frame.getJointPose(joint, frame.referenceSpace);
          if (pose) {
            handData.joints.set(jointName, {
              position: pose.transform.position,
              orientation: pose.transform.orientation,
              radius: pose.radius,
              confidence: pose.emulated ? 0.5 : 1.0
            });

            totalConfidence += pose.emulated ? 0.5 : 1.0;
            jointCount++;
          }
        }
      });

      if (jointCount > 0) {
        handData.confidence = totalConfidence / jointCount;
        return handData;
      }

    } catch (error) {
      console.warn('[VR Gesture] Failed to get hand data:', error);
    }

    return null;
  }

  /**
   * ハンドジェスチャーの処理
   */
  processHandGestures(handedness, handData) {
    // 各ジェスチャーの認識を試行
    this.gestureRecognizers.forEach((recognizer, gestureName) => {
      const result = recognizer.detect(handData, handedness);

      if (result.detected && result.confidence >= recognizer.minConfidence) {
        this.onGestureDetected(gestureName, handedness, result.confidence, handData);
      } else if (recognizer.active) {
        this.onGestureLost(gestureName, handedness);
      }
    });
  }

  /**
   * ピンチジェスチャーの検出
   */
  detectPinch(handData, handedness) {
    const thumbTip = handData.joints.get('thumb-tip');
    const indexTip = handData.joints.get('index-finger-tip');

    if (!thumbTip || !indexTip) {
      return { detected: false, confidence: 0 };
    }

    // 親指と人差し指の距離を計算
    const distance = this.calculateDistance(thumbTip.position, indexTip.position);

    // ピンチの距離しきい値（約2cm）
    const pinchThreshold = 0.02;
    const detected = distance < pinchThreshold;

    // 信頼度計算
    const confidence = Math.max(0, 1 - (distance / pinchThreshold));

    return { detected, confidence };
  }

  /**
   * 握り拳ジェスチャーの検出
   */
  detectFist(handData, handedness) {
    const fingerTips = [
      handData.joints.get('thumb-tip'),
      handData.joints.get('index-finger-tip'),
      handData.joints.get('middle-finger-tip'),
      handData.joints.get('ring-finger-tip'),
      handData.joints.get('pinky-finger-tip')
    ];

    if (fingerTips.some(tip => !tip)) {
      return { detected: false, confidence: 0 };
    }

    // 各指先が手掌に近いかをチェック
    const palmCenter = this.calculatePalmCenter(handData);
    let curledFingers = 0;

    fingerTips.forEach(tip => {
      const distance = this.calculateDistance(tip.position, palmCenter);
      if (distance < 0.03) { // 約3cm以内
        curledFingers++;
      }
    });

    const detected = curledFingers >= 4; // 4本以上の指が曲がっている
    const confidence = curledFingers / 5; // 5本中何本曲がっているか

    return { detected, confidence };
  }

  /**
   * 開いた手ジェスチャーの検出
   */
  detectOpenHand(handData, handedness) {
    const fingerTips = [
      handData.joints.get('index-finger-tip'),
      handData.joints.get('middle-finger-tip'),
      handData.joints.get('ring-finger-tip'),
      handData.joints.get('pinky-finger-tip')
    ];

    if (fingerTips.some(tip => !tip)) {
      return { detected: false, confidence: 0 };
    }

    // 指先が手掌から離れているかをチェック
    const palmCenter = this.calculatePalmCenter(handData);
    let extendedFingers = 0;

    fingerTips.forEach(tip => {
      const distance = this.calculateDistance(tip.position, palmCenter);
      if (distance > 0.08) { // 約8cm以上離れている
        extendedFingers++;
      }
    });

    const detected = extendedFingers >= 3; // 3本以上の指が伸びている
    const confidence = extendedFingers / 4;

    return { detected, confidence };
  }

  /**
   * 指さしジェスチャーの検出
   */
  detectPoint(handData, handedness) {
    const indexTip = handData.joints.get('index-finger-tip');
    const indexDip = handData.joints.get('index-finger-phalanx-intermediate');
    const otherTips = [
      handData.joints.get('middle-finger-tip'),
      handData.joints.get('ring-finger-tip'),
      handData.joints.get('pinky-finger-tip')
    ];

    if (!indexTip || !indexDip || otherTips.some(tip => !tip)) {
      return { detected: false, confidence: 0 };
    }

    // 人差し指が伸び、他の指が曲がっているかをチェック
    const palmCenter = this.calculatePalmCenter(handData);

    // 人差し指のチェック
    const indexExtended = this.calculateDistance(indexTip.position, palmCenter) > 0.08;

    // 他の指のチェック
    let otherCurled = 0;
    otherTips.forEach(tip => {
      const distance = this.calculateDistance(tip.position, palmCenter);
      if (distance < 0.04) {
        otherCurled++;
      }
    });

    const detected = indexExtended && otherCurled >= 2;
    const confidence = (indexExtended ? 0.6 : 0) + (otherCurled / 3) * 0.4;

    return { detected, confidence };
  }

  /**
   * 親指立てジェスチャーの検出
   */
  detectThumbsUp(handData, handedness) {
    const thumbTip = handData.joints.get('thumb-tip');
    const thumbBase = handData.joints.get('thumb-metacarpal');
    const otherTips = [
      handData.joints.get('index-finger-tip'),
      handData.joints.get('middle-finger-tip'),
      handData.joints.get('ring-finger-tip'),
      handData.joints.get('pinky-finger-tip')
    ];

    if (!thumbTip || !thumbBase || otherTips.some(tip => !tip)) {
      return { detected: false, confidence: 0 };
    }

    // 親指が上向きに伸び、他の指が曲がっているかをチェック
    const thumbExtended = thumbTip.position.y > thumbBase.position.y + 0.03;

    let otherCurled = 0;
    const palmCenter = this.calculatePalmCenter(handData);
    otherTips.forEach(tip => {
      const distance = this.calculateDistance(tip.position, palmCenter);
      if (distance < 0.04) {
        otherCurled++;
      }
    });

    const detected = thumbExtended && otherCurled >= 3;
    const confidence = (thumbExtended ? 0.5 : 0) + (otherCurled / 4) * 0.5;

    return { detected, confidence };
  }

  /**
   * ジェスチャー検出時の処理
   */
  onGestureDetected(gestureName, handedness, confidence, handData) {
    const recognizer = this.gestureRecognizers.get(gestureName);
    const gestureKey = `${gestureName}-${handedness}`;

    // 新規ジェスチャー検出
    if (!recognizer.active) {
      recognizer.active = true;
      recognizer.lastDetected = Date.now();

      console.log(`[VR Gesture] Gesture detected: ${gestureName} (${handedness}) confidence: ${confidence.toFixed(2)}`);

      // アクティブジェスチャーに追加
      this.activeGestures.add(gestureKey);

      // イベント発火
      this.fireGestureEvent('gesturestart', {
        gesture: gestureName,
        handedness: handedness,
        confidence: confidence,
        handData: handData
      });

      // コールバック実行
      this.executeGestureCallbacks(gestureName, 'start', {
        handedness, confidence, handData
      });
    }

    recognizer.confidence = confidence;
  }

  /**
   * ジェスチャー消失時の処理
   */
  onGestureLost(gestureName, handedness) {
    const recognizer = this.gestureRecognizers.get(gestureName);
    const gestureKey = `${gestureName}-${handedness}`;

    if (recognizer.active) {
      recognizer.active = false;

      console.log(`[VR Gesture] Gesture lost: ${gestureName} (${handedness})`);

      // アクティブジェスチャーから削除
      this.activeGestures.delete(gestureKey);

      // イベント発火
      this.fireGestureEvent('gestureend', {
        gesture: gestureName,
        handedness: handedness
      });

      // コールバック実行
      this.executeGestureCallbacks(gestureName, 'end', { handedness });
    }
  }

  /**
   * コントローラーフォールバックの設定
   */
  setupControllerFallback() {
    // コントローラーボタンイベントの監視
    document.addEventListener('keydown', (event) => {
      if (this.fallbackMode) {
        this.handleControllerInput(event);
      }
    });

    console.log('[VR Gesture] Controller fallback initialized');
  }

  /**
   * コントローラー入力の処理
   */
  handleControllerInput(event) {
    // コントローラーボタンをジェスチャーにマッピング
    const gestureMap = {
      ' ': 'pinch',      // スペースキー -> ピンチ
      'f': 'fist',       // Fキー -> 握り拳
      'o': 'open',       // Oキー -> 開いた手
      'p': 'point',      // Pキー -> 指さし
      't': 'thumbsUp'    // Tキー -> 親指立て
    };

    const gesture = gestureMap[event.key.toLowerCase()];
    if (gesture) {
      event.preventDefault();

      // フォールバックジェスチャーイベントの発火
      this.fireGestureEvent('gesturestart', {
        gesture: gesture,
        handedness: 'right', // デフォルトで右手
        confidence: 0.8,
        fallback: true
      });
    }
  }

  /**
   * コントローラーフォールバックの開始
   */
  startControllerFallback(session) {
    console.log('[VR Gesture] Starting controller fallback mode');

    // コントローラー入力の監視を開始
    this.fallbackMode = true;

    // フォールバックモードの通知
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'info',
        title: 'ジェスチャーコントロール',
        message: 'ハンドトラッキングが利用できないため、キーボード入力でジェスチャーをシミュレートします',
        duration: 5000
      });
    }
  }

  /**
   * 距離計算ユーティリティ
   */
  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * 手掌中心の計算
   */
  calculatePalmCenter(handData) {
    const wrist = handData.joints.get('wrist');
    if (!wrist) return { x: 0, y: 0, z: 0 };

    // 簡易的な手掌中心の計算
    return {
      x: wrist.position.x,
      y: wrist.position.y - 0.02, // 手首から少し下
      z: wrist.position.z
    };
  }

  /**
   * ジェスチャーイベントの発火
   */
  fireGestureEvent(type, detail) {
    const event = new CustomEvent(`vrgesture${type}`, {
      detail: detail,
      bubbles: true
    });

    document.dispatchEvent(event);
  }

  /**
   * ジェスチャーコールバックの登録
   */
  onGesture(gestureName, callback) {
    if (!this.gestureCallbacks.has(gestureName)) {
      this.gestureCallbacks.set(gestureName, new Map());
    }

    const id = Date.now() + Math.random();
    this.gestureCallbacks.get(gestureName).set(id, callback);

    return id; // コールバックIDを返す
  }

  /**
   * ジェスチャーコールバックの削除
   */
  offGesture(gestureName, callbackId) {
    const callbacks = this.gestureCallbacks.get(gestureName);
    if (callbacks) {
      callbacks.delete(callbackId);
    }
  }

  /**
   * ジェスチャーコールバックの実行
   */
  executeGestureCallbacks(gestureName, action, data) {
    const callbacks = this.gestureCallbacks.get(gestureName);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(action, data);
        } catch (error) {
          console.error('[VR Gesture] Gesture callback error:', error);
        }
      });
    }
  }

  /**
   * アクティブジェスチャーのクリア
   */
  clearActiveGestures() {
    this.activeGestures.forEach(gestureKey => {
      const [gestureName, handedness] = gestureKey.split('-');
      this.onGestureLost(gestureName, handedness);
    });

    this.activeGestures.clear();
  }

  /**
   * ジェスチャーコントロールの統計取得
   */
  getStats() {
    return {
      isTracking: this.isTracking,
      hasHandTracking: this.hasHandTracking,
      fallbackMode: this.fallbackMode,
      activeGestures: Array.from(this.activeGestures),
      availableGestures: Object.keys(this.gestureDefinitions),
      handsDetected: this.hands.size
    };
  }

  /**
   * サポート状況の取得
   */
  getSupportInfo() {
    return {
      webxr: !!navigator.xr,
      handTracking: this.hasHandTracking,
      fallbackMode: this.fallbackMode,
      supportedGestures: Object.keys(this.gestureDefinitions)
    };
  }
}

// グローバルインスタンス作成
const vrGestureControls = new VRGestureControls();

// グローバルアクセス用
window.vrGestureControls = vrGestureControls;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[VR Gesture] VR Gesture Controls initialized');
});
