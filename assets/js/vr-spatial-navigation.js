/**
 * Qui Browser VR Spatial Navigation
 * VR空間ナビゲーションの改善機能
 *
 * 機能:
 * - 高度なテレポートシステム
 * - スムーズな移動と回転
 * - ランドマーク管理とナビゲーション
 * - 経路計画と自動ナビゲーション
 * - 空間アンカーと位置同期
 * - ジェスチャー連携ナビゲーション
 * - アクセシビリティ対応ナビゲーション
 */

class VRSpatialNavigation {
  constructor() {
    this.currentPosition = { x: 0, y: 0, z: 0 };
    this.currentRotation = { x: 0, y: 0, z: 0 };
    this.teleportTargets = new Map();
    this.landmarks = new Map();
    this.navigationPaths = new Map();
    this.spatialAnchors = new Map();
    this.movementHistory = [];
    this.waypoints = new Set();

    // ナビゲーション設定
    this.navigationConfig = {
      teleportRange: 50,        // テレポート最大距離
      smoothMovement: true,     // スムーズ移動有効
      pathfindingEnabled: true, // 経路探索有効
      landmarkSync: true,       // ランドマーク同期
      gestureNavigation: true,  // ジェスチャーナビゲーション
      accessibilityMode: false, // アクセシビリティモード
      autoNavigation: false,    // 自動ナビゲーション
      spatialAnchorsEnabled: true // 空間アンカー有効
    };

    // 移動パラメータ
    this.movementParams = {
      walkSpeed: 2.0,          // 歩行速度 m/s
      runSpeed: 5.0,           // 走行速度 m/s
      teleportCooldown: 1000,   // テレポートクールダウン ms
      rotationSpeed: 90,        // 回転速度 deg/s
      smoothFactor: 0.1         // スムーズ係数
    };

    this.init();
  }

  init() {
    // 初期位置設定
    this.setInitialPosition();

    // ランドマークの初期化
    this.initializeDefaultLandmarks();

    // ナビゲーションイベントの設定
    this.setupNavigationEvents();

    // ジェスチャー連携の設定
    this.setupGestureIntegration();

    // アクセシビリティ設定
    this.setupAccessibilityFeatures();

    console.log('[VR Navigation] VR Spatial Navigation initialized');
  }

  /**
   * 初期位置設定
   */
  setInitialPosition() {
    // デフォルトのスポーン位置
    this.currentPosition = { x: 0, y: 1.6, z: 0 }; // 目の高さに相当
    this.currentRotation = { x: 0, y: 0, z: 0 };

    // 初期位置を履歴に追加
    this.addToMovementHistory(this.currentPosition, this.currentRotation);

    console.log('[VR Navigation] Initial position set');
  }

  /**
   * デフォルトランドマークの初期化
   */
  initializeDefaultLandmarks() {
    const defaultLandmarks = [
      {
        id: 'spawn',
        name: 'スポーン地点',
        position: { x: 0, y: 1.6, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        type: 'system',
        icon: '🏠',
        description: 'ゲーム開始地点'
      },
      {
        id: 'center',
        name: '中央広場',
        position: { x: 0, y: 1.6, z: -20 },
        rotation: { x: 0, y: 0, z: 0 },
        type: 'public',
        icon: '🏛️',
        description: 'みんなが集まる場所'
      },
      {
        id: 'north-gate',
        name: '北門',
        position: { x: 0, y: 1.6, z: -50 },
        rotation: { x: 0, y: 180, z: 0 },
        type: 'gateway',
        icon: '🚪',
        description: '北エリアへの入口'
      }
    ];

    defaultLandmarks.forEach(landmark => {
      this.landmarks.set(landmark.id, {
        ...landmark,
        createdAt: Date.now(),
        visitCount: 0,
        lastVisited: null,
        isActive: true
      });
    });

    console.log('[VR Navigation] Default landmarks initialized');
  }

  /**
   * ナビゲーションイベントの設定
   */
  setupNavigationEvents() {
    // テレポートイベント
    document.addEventListener('vrgesturestart', (event) => {
      if (event.detail.gesture === 'point') {
        this.handlePointGesture(event.detail);
      }
    });

    // ジェスチャーナビゲーション
    document.addEventListener('vrgesturestart', (event) => {
      const gesture = event.detail.gesture;
      const handedness = event.detail.handedness;

      switch (gesture) {
        case 'thumbsUp':
          this.handleThumbsUpGesture(handedness);
          break;
        case 'open':
          this.handleOpenHandGesture(handedness);
          break;
        case 'fist':
          this.handleFistGesture(handedness);
          break;
      }
    });

    // WebXRマネージャーの連携
    if (window.WebXRManager) {
      window.WebXRManager.addEventListener('positionchange', (event) => {
        this.updateCurrentPosition(event.detail.position, event.detail.rotation);
      });
    }

    console.log('[VR Navigation] Navigation events setup');
  }

  /**
   * ジェスチャー連携の設定
   */
  setupGestureIntegration() {
    if (window.vrGestureControls) {
      // ピンチジェスチャーでテレポート
      window.vrGestureControls.onGesture('pinch', (action, data) => {
        if (action === 'start') {
          this.initiateTeleport(data.handedness);
        }
      });

      // 開手ジェスチャーでメニュー表示
      window.vrGestureControls.onGesture('open', (action, data) => {
        if (action === 'start') {
          this.showNavigationMenu(data.handedness);
        }
      });

      console.log('[VR Navigation] Gesture integration setup');
    }
  }

  /**
   * アクセシビリティ機能の設定
   */
  setupAccessibilityFeatures() {
    // 音声ガイドの設定
    this.voiceGuide = {
      enabled: false,
      volume: 0.7,
      rate: 1.0,
      voice: null
    };

    // 触覚フィードバックの設定
    this.hapticFeedback = {
      enabled: true,
      intensity: 0.5,
      duration: 100
    };

    console.log('[VR Navigation] Accessibility features setup');
  }

  /**
   * テレポート実行
   */
  async teleportTo(targetPosition, targetRotation = null) {
    if (!this.canTeleport(targetPosition)) {
      this.showTeleportError('テレポート先が範囲外です');
      return false;
    }

    // テレポートクールダウンチェック
    if (this.isTeleportOnCooldown()) {
      this.showTeleportError('テレポートのクールダウン中です');
      return false;
    }

    try {
      // テレポート実行
      await this.performTeleport(targetPosition, targetRotation);

      // 履歴に追加
      this.addToMovementHistory(targetPosition, targetRotation || this.currentRotation);

      // ランドマークの訪問カウント更新
      this.updateLandmarkVisit(targetPosition);

      console.log(`[VR Navigation] Teleported to: ${JSON.stringify(targetPosition)}`);

      return true;
    } catch (error) {
      console.error('[VR Navigation] Teleport failed:', error);
      this.showTeleportError('テレポートに失敗しました');
      return false;
    }
  }

  /**
   * テレポート実行処理
   */
  async performTeleport(position, rotation) {
    // WebXRマネージャーを使用したテレポート
    if (window.WebXRManager) {
      await window.WebXRManager.setPosition(position, rotation);
    }

    // 位置更新
    this.currentPosition = { ...position };
    if (rotation) {
      this.currentRotation = { ...rotation };
    }

    // テレポートクールダウン設定
    this.lastTeleportTime = Date.now();

    // 視覚効果（オプション）
    this.playTeleportEffect();

    // 音声ガイド
    if (this.voiceGuide.enabled) {
      this.speakArrivalMessage(position);
    }
  }

  /**
   * テレポート可能かチェック
   */
  canTeleport(position) {
    const distance = this.calculateDistance(this.currentPosition, position);
    return distance <= this.navigationConfig.teleportRange;
  }

  /**
   * テレポートクールダウンチェック
   */
  isTeleportOnCooldown() {
    if (!this.lastTeleportTime) return false;

    const timeSinceLastTeleport = Date.now() - this.lastTeleportTime;
    return timeSinceLastTeleport < this.movementParams.teleportCooldown;
  }

  /**
   * スムーズ移動
   */
  async moveTo(targetPosition, duration = 1000) {
    if (!this.navigationConfig.smoothMovement) {
      return this.teleportTo(targetPosition);
    }

    const startPosition = { ...this.currentPosition };
    const startTime = Date.now();

    return new Promise((resolve) => {
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // イージング関数適用
        const easedProgress = this.easeInOutCubic(progress);

        // 位置補間
        const currentPos = {
          x: startPosition.x + (targetPosition.x - startPosition.x) * easedProgress,
          y: startPosition.y + (targetPosition.y - startPosition.y) * easedProgress,
          z: startPosition.z + (targetPosition.z - startPosition.z) * easedProgress
        };

        // WebXRマネージャー経由で位置更新
        if (window.WebXRManager) {
          window.WebXRManager.setPosition(currentPos);
        }

        this.currentPosition = currentPos;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.addToMovementHistory(targetPosition, this.currentRotation);
          resolve(true);
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * 経路探索ナビゲーション
   */
  async navigateTo(destination, options = {}) {
    if (!this.navigationConfig.pathfindingEnabled) {
      return this.moveTo(destination);
    }

    try {
      // 経路探索
      const path = await this.findPath(this.currentPosition, destination);

      if (!path || path.length === 0) {
        console.warn('[VR Navigation] No path found, using direct movement');
        return this.moveTo(destination);
      }

      // 経路に従って移動
      for (let i = 0; i < path.length; i++) {
        const waypoint = path[i];
        await this.moveTo(waypoint, options.waypointDuration || 800);

        // ウェイポイント到達時のコールバック
        if (options.onWaypointReached) {
          options.onWaypointReached(waypoint, i, path.length);
        }
      }

      return true;
    } catch (error) {
      console.error('[VR Navigation] Pathfinding navigation failed:', error);
      return this.moveTo(destination);
    }
  }

  /**
   * 経路探索
   */
  async findPath(start, end) {
    // 簡易的なA*アルゴリズムの実装
    const path = [];
    const gridSize = 2; // 2mグリッド

    // グリッド座標に変換
    const startGrid = this.worldToGrid(start);
    const endGrid = this.worldToGrid(end);

    // 直線距離が近い場合は直接移動
    const directDistance = this.calculateDistance(start, end);
    if (directDistance < 10) {
      path.push(end);
      return path;
    }

    // より複雑な経路探索（簡易実装）
    const waypoints = this.generateWaypoints(start, end);
    return waypoints;
  }

  /**
   * ランドマーク管理
   */
  addLandmark(id, name, position, options = {}) {
    if (this.landmarks.has(id)) {
      console.warn(`[VR Navigation] Landmark ${id} already exists`);
      return false;
    }

    const landmark = {
      id,
      name,
      position: { ...position },
      rotation: options.rotation || { x: 0, y: 0, z: 0 },
      type: options.type || 'user',
      icon: options.icon || '📍',
      description: options.description || '',
      createdAt: Date.now(),
      visitCount: 0,
      lastVisited: null,
      isActive: true,
      tags: options.tags || []
    };

    this.landmarks.set(id, landmark);

    // ランドマーク同期（オプション）
    if (this.navigationConfig.landmarkSync) {
      this.syncLandmark(landmark);
    }

    console.log(`[VR Navigation] Landmark added: ${name} at ${JSON.stringify(position)}`);
    return true;
  }

  /**
   * ランドマークへのテレポート
   */
  async teleportToLandmark(landmarkId) {
    const landmark = this.landmarks.get(landmarkId);

    if (!landmark || !landmark.isActive) {
      this.showNavigationError('ランドマークが見つかりません');
      return false;
    }

    const success = await this.teleportTo(landmark.position, landmark.rotation);

    if (success) {
      landmark.visitCount++;
      landmark.lastVisited = Date.now();

      // 訪問音声ガイド
      if (this.voiceGuide.enabled) {
        this.speakLandmarkArrival(landmark);
      }
    }

    return success;
  }

  /**
   * ランドマークの訪問カウント更新
   */
  updateLandmarkVisit(position) {
    // 近くのランドマークを探して訪問カウント更新
    for (const [id, landmark] of this.landmarks) {
      const distance = this.calculateDistance(position, landmark.position);
      if (distance < 3) { // 3m以内
        landmark.visitCount++;
        landmark.lastVisited = Date.now();
        break;
      }
    }
  }

  /**
   * ジェスチャーハンドラー
   */
  handlePointGesture(data) {
    // 指さし方向へのテレポートターゲット設定
    const targetDirection = this.calculatePointDirection(data);
    const targetPosition = this.calculateTeleportTarget(targetDirection);

    this.teleportTargets.set('gesture', {
      position: targetPosition,
      timestamp: Date.now(),
      confidence: data.confidence
    });

    // 視覚フィードバック
    this.showTeleportPreview(targetPosition);
  }

  handleThumbsUpGesture(handedness) {
    // 親指立てでクイックメニュー表示
    this.showQuickNavigationMenu(handedness);
  }

  handleOpenHandGesture(handedness) {
    // 開手でランドマークメニュー表示
    this.showLandmarkMenu(handedness);
  }

  handleFistGesture(handedness) {
    // 握り拳で緊急停止
    this.emergencyStop();
  }

  /**
   * 指さし方向の計算
   */
  calculatePointDirection(data) {
    // 簡易的な方向計算（実際の実装では手の姿勢から正確に計算）
    const handPosition = data.handData?.joints?.get('index-finger-tip')?.position;
    if (handPosition) {
      return {
        x: handPosition.x - this.currentPosition.x,
        y: 0, // Y方向は無視
        z: handPosition.z - this.currentPosition.z
      };
    }

    // デフォルトは前方
    return { x: 0, y: 0, z: -1 };
  }

  /**
   * テレポートターゲットの計算
   */
  calculateTeleportTarget(direction) {
    const distance = 10; // 10m先
    const normalizedDirection = this.normalizeVector(direction);

    return {
      x: this.currentPosition.x + normalizedDirection.x * distance,
      y: this.currentPosition.y,
      z: this.currentPosition.z + normalizedDirection.z * distance
    };
  }

  /**
   * テレポート開始
   */
  initiateTeleport(handedness) {
    const target = this.teleportTargets.get('gesture');

    if (target && (Date.now() - target.timestamp) < 2000) { // 2秒以内
      this.teleportTo(target.position);
      this.teleportTargets.delete('gesture');
    }
  }

  /**
   * ナビゲーションメニューの表示
   */
  showNavigationMenu(handedness) {
    // ナビゲーションメニューの表示（実装はUIコンポーネントに依存）
    console.log(`[VR Navigation] Showing navigation menu for ${handedness} hand`);

    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'info',
        title: 'ナビゲーション',
        message: 'ランドマークを選択してください',
        duration: 3000
      });
    }
  }

  /**
   * クイックナビゲーションメニュー
   */
  showQuickNavigationMenu(handedness) {
    const landmarks = Array.from(this.landmarks.values())
      .filter(l => l.isActive)
      .slice(0, 3); // 最大3つ

    console.log(`[VR Navigation] Quick navigation menu for ${landmarks.length} landmarks`);
  }

  /**
   * ランドマークメニュー
   */
  showLandmarkMenu(handedness) {
    const landmarks = Array.from(this.landmarks.values())
      .filter(l => l.isActive);

    console.log(`[VR Navigation] Landmark menu with ${landmarks.length} landmarks`);
  }

  /**
   * 緊急停止
   */
  emergencyStop() {
    console.log('[VR Navigation] Emergency stop activated');

    // 移動中の処理を停止
    this.cancelCurrentMovement();

    // ユーザーに通知
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'warning',
        title: '緊急停止',
        message: 'ナビゲーションを停止しました',
        duration: 2000
      });
    }
  }

  /**
   * 位置更新
   */
  updateCurrentPosition(position, rotation) {
    this.currentPosition = { ...position };
    this.currentRotation = { ...rotation };

    // 移動履歴に追加（高頻度なので間引く）
    if (this.shouldAddToHistory()) {
      this.addToMovementHistory(position, rotation);
    }
  }

  /**
   * 移動履歴への追加
   */
  addToMovementHistory(position, rotation) {
    this.movementHistory.push({
      position: { ...position },
      rotation: { ...rotation },
      timestamp: Date.now()
    });

    // 履歴サイズ制限
    if (this.movementHistory.length > 1000) {
      this.movementHistory.shift();
    }
  }

  /**
   * 履歴追加判定
   */
  shouldAddToHistory() {
    if (this.movementHistory.length === 0) return true;

    const lastEntry = this.movementHistory[this.movementHistory.length - 1];
    const timeDiff = Date.now() - lastEntry.timestamp;
    const distance = this.calculateDistance(this.currentPosition, lastEntry.position);

    // 1秒以上経過 または 1m以上移動したら追加
    return timeDiff > 1000 || distance > 1;
  }

  /**
   * ユーティリティ関数
   */
  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  normalizeVector(vector) {
    const length = Math.sqrt(vector.x * vector.x + vector.z * vector.z);
    if (length === 0) return { x: 0, y: 0, z: 1 };

    return {
      x: vector.x / length,
      y: 0,
      z: vector.z / length
    };
  }

  worldToGrid(worldPos) {
    const gridSize = 2;
    return {
      x: Math.floor(worldPos.x / gridSize),
      z: Math.floor(worldPos.z / gridSize)
    };
  }

  generateWaypoints(start, end) {
    // 簡易的なウェイポイント生成
    const waypoints = [];
    const steps = 5;
    const dx = (end.x - start.x) / steps;
    const dz = (end.z - start.z) / steps;

    for (let i = 1; i <= steps; i++) {
      waypoints.push({
        x: start.x + dx * i,
        y: start.y,
        z: start.z + dz * i
      });
    }

    return waypoints;
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * エラーメッセージ表示
   */
  showTeleportError(message) {
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'error',
        title: 'テレポートエラー',
        message: message,
        duration: 3000
      });
    }
  }

  showNavigationError(message) {
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'error',
        title: 'ナビゲーションエラー',
        message: message,
        duration: 3000
      });
    }
  }

  /**
   * 視覚効果
   */
  playTeleportEffect() {
    // テレポート時の視覚効果（実装は3Dエンジンに依存）
    console.log('[VR Navigation] Teleport effect played');
  }

  /**
   * 音声ガイド
   */
  speakArrivalMessage(position) {
    const message = `位置 ${Math.round(position.x)}, ${Math.round(position.z)} に到着しました`;
    this.speak(message);
  }

  speakLandmarkArrival(landmark) {
    const message = `${landmark.name}に到着しました`;
    this.speak(message);
  }

  speak(text) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = this.voiceGuide.volume;
      utterance.rate = this.voiceGuide.rate;
      utterance.voice = this.voiceGuide.voice;

      speechSynthesis.speak(utterance);
    }
  }

  /**
   * プレビュー表示
   */
  showTeleportPreview(position) {
    // テレポート先のプレビュー表示（実装は3Dエンジンに依存）
    console.log(`[VR Navigation] Teleport preview at ${JSON.stringify(position)}`);
  }

  /**
   * 同期処理
   */
  syncLandmark(landmark) {
    // ランドマークの同期処理（オプション）
    console.log(`[VR Navigation] Landmark synced: ${landmark.name}`);
  }

  cancelCurrentMovement() {
    // 現在の移動をキャンセル
    console.log('[VR Navigation] Current movement cancelled');
  }

  /**
   * 統計取得
   */
  getStats() {
    return {
      currentPosition: { ...this.currentPosition },
      currentRotation: { ...this.currentRotation },
      landmarks: this.landmarks.size,
      movementHistory: this.movementHistory.length,
      activeWaypoints: this.waypoints.size,
      navigationConfig: { ...this.navigationConfig },
      canTeleport: this.canTeleport({ x: 0, y: 0, z: 0 }) // テスト用
    };
  }

  /**
   * ランドマーク取得
   */
  getLandmarks() {
    return Array.from(this.landmarks.values());
  }

  /**
   * 移動履歴取得
   */
  getMovementHistory(limit = 10) {
    return this.movementHistory.slice(-limit);
  }
}

// グローバルインスタンス作成
const vrSpatialNavigation = new VRSpatialNavigation();

// グローバルアクセス用
window.vrSpatialNavigation = vrSpatialNavigation;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[VR Navigation] VR Spatial Navigation initialized');
});
