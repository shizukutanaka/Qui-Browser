# Qui Browser VR — 仕様書 (Specification) v2.0.0

> 本書は Qui Browser VR の**あるべき仕様**を定義し、現実装との**適合状況（conformance）**を示す。
> 関連: 改善分析 `docs/IMPROVEMENT_ANALYSIS.md`、カテゴリー別調査 `docs/CATEGORY_RESEARCH.md`。
> 凡例: ✅実装済 / 🟡部分実装 / ❌未実装。

## 1. 概要
- **目的**: WebXR ベースの没入型ブラウザ／空間シェル。Web・メディア・3D 空間を VR/MR で閲覧・操作する。
- **対象端末**: Meta Quest 2 / 3、Pico 4（WebXR 対応ブラウザ）。2D ランディングは任意ブラウザ。
- **スタック**: Three.js + WebXR Device API、Vite ビルド、PWA（Service Worker）。
- **性能目標**: Quest 3 = 90–120 FPS、Quest 2 / Pico 4 = 72–90 FPS。

## 2. 用語
- **playerRig**: カメラ＋コントローラを内包し、移動/旋回の単位となる `THREE.Group`。
- **rest frame**: 視野内の静的参照（床/グリッド等）。酔い軽減に寄与。
- **FFR**: Fixed Foveated Rendering（中心窩外の解像度低減）。

## 3. 機能要件（FR）と適合状況

### 3.1 ブラウジング中核
| ID | 要件 | 状態 | 根拠/備考 |
|----|------|------|-----------|
| FR-1.1 | 任意 Web ページを 3D 空間内パネルに描画 | 🟡 | `WebPanel`（`settings.enableWebPanel`）: iframe + dom-overlay。クロスオリジンはサンドボックス制限あり。dom-overlay 非対応端末はプレースホルダ表示 |
| FR-1.2 | URL バー・戻る/進む・再読込 | ✅ | `WebPanel` の CanvasTexture chrome。back/forward/reload/URL入力・navigate() で BookmarkStore + AI 連携 |
| FR-1.3 | タブ／複数ウィンドウ | ✅ | `TabManager`: 複数 `WebPanel` を管理、タブストリップ（CanvasTexture）で切替/新規/閉じる。最大8タブ |
| FR-1.4 | ブックマーク・履歴 | ✅ | `BookmarkStore`（localStorage）: `addBookmark/removeBookmark/isBookmarked` + `addHistory/getHistory/clearHistory`。`VRApp.bookmarks` 経由でアクセス可 |
| FR-1.5 | 鮮明なテキスト（WebXR quad/cylinder Layers） | ✅ | `LayersSystem`（`XRWebGLBinding.createQuadLayer`）: chrome bar を native 解像度で合成。未対応環境は Three.js mesh にフォールバック。`WebPanel.enableLayerMode/updateLayer`、VRApp にて session start/end でライフサイクル管理 |
| FR-1.6 | 空間ウィンドウ管理（head-lock/移動/距離） | ✅ | `WindowManager`（Wolvic/Quest ブラウザ調査由来）: head-lock follow（視界中央追従）、billboard、距離調整、grab-to-move。設定パネル「Follow View」でトグル、アクティブタブに自動追従 |
| FR-1.7 | 湾曲スクリーン（flat↔curved） | ✅ | `curvedPlaneData`/`buildCurvedPlaneGeometry` で content 面を凹面アーク化（Quest ブラウザ調査由来）。`WebPanel.setCurved`、`TabManager.setCurved`（全タブ＋新規タブ継承）、設定パネル「Curved」トグル。chrome bar は平面維持でヒットテスト正確性を担保 |

### 3.2 入力・操作
| ID | 要件 | 状態 | 根拠/備考 |
|----|------|------|-----------|
| FR-2.1 | コントローラ表示＋レイポインタ＋select | ✅ | `setupControllers()` / `XRControllerModelFactory` |
| FR-2.2 | ハンドトラッキング（pinch/point） | ✅ | `HandTracking` |
| FR-2.3 | 選択ヒットのイベント配信（interactable） | ✅ | `registerInteractable()`＋ホバー（`updateHover`）。ウェルカム板を Recenter ボタン化 |
| FR-2.4 | 音声コマンド | ✅ | `VoiceCommands`（`settings.enableVoice` で on/off、致命エラー時の再起動ループ修正済）、VRApp に配線済 |
| FR-2.5 | 日本語 IME 入力 | ✅ | `JapaneseIME` + VR キーボード |
| FR-2.6 | ハプティクスフィードバック | ✅ | `HapticFeedback` — pinch→click, grab→impact パターン。VRApp に配線済（`onVRSessionStart` でジェスチャー callback に登録） |

### 3.3 移動・快適性
| ID | 要件 | 状態 | 根拠/備考 |
|----|------|------|-----------|
| FR-3.1 | playerRig による移動基盤 | ✅ | カメラ/コントローラを rig 内包 |
| FR-3.2 | テレポート移動 | ✅ | squeeze で照準→離して移動。floor へ raycast |
| FR-3.3 | スムーズ移動＋トンネリング | ✅ | 左スティック移動（既定off・opt-in）。移動中は ComfortSystem.externalMotion でビネット連動 |
| FR-3.4 | スナップ/スムーズ旋回 | ✅ | 右スティックで rig をスナップ旋回（`updateLocomotion`/`snapTurn`）。XR実機で有効 |
| FR-3.5 | 快適性（ビネット/FOV 縮小） | ✅ | `ComfortSystem` |
| FR-3.6 | rest frame（静的参照） | ✅ | ホーム環境の床/グリッド |

### 3.4 レンダリング
| ID | 要件 | 状態 | 根拠/備考 |
|----|------|------|-----------|
| FR-4.1 | Fixed Foveated Rendering | ✅ | `FFRSystem`（静的） |
| FR-4.2 | 視線追従フォービエーション | 🟡 | 頭部角速度ベースの予測 gaze foveation（`FFRSystem.trackHeadPose`/`updatePredictedGazeFoveation`）。真の eye-tracking は Quest Pro ハードウェア待ち |
| FR-4.3 | テクスチャ圧縮（KTX2/Basis） | ✅ | `TextureManager` |
| FR-4.4 | WebGPU 描画 | 🟡 | `WebGPURenderer` 実験的・ループ未接続 |
| FR-4.5 | 3D Gaussian Splatting | ❌ | 未導入 |
| FR-4.6 | ホーム環境（空/床/ウェルカム） | ✅ | `createHomeEnvironment()` |

### 3.5 空間オーディオ / MR / マルチプレイヤー / AI
| ID | 要件 | 状態 | 根拠/備考 |
|----|------|------|-----------|
| FR-5.1 | HRTF 空間オーディオ | ✅ | `SpatialAudio` |
| FR-5.2 | アンビソニック/知覚的 LOD | ✅ | `SpatialAudio`: `hrtfThreshold`(15m)超はequalpower、以内はHRTF。`updateAllLOD()`/`updateSourceLOD()` で毎フレーム更新 |
| FR-6.1 | AR パススルー（MR） | 🟡 | `MixedReality` |
| FR-6.2 | ヒットテスト/アンカー配置 | 🟡 | `MixedReality.placeObject()` + hit-test。メモリ内アンカーは FR-6.3 で IndexedDB 永続化済 |
| FR-6.3 | 永続アンカー（再訪復元） | ✅ | `MixedReality`: IndexedDB `QuiBrowserMR/anchors` に pose を保存。`loadSavedAnchors()` / `deletePersistedAnchor()` / `clearSavedAnchors()` API |
| FR-6.4 | Depth sensing/平面・メッシュ検出 | 🟡 | 平面検出（`updatePlanes`）に加え、メッシュ検出（`updateMeshes`/`frame.detectedMeshes`、ワイヤフレーム可視化）と深度センシング（`updateDepth`/`frame.getDepthInformation`、`getDepthInMeters(x,y)` で遮蔽用サンプリング）を実装。真の遮蔽シェーダ合成は別途。実機 Quest 3 の depth-API 待ち |
| FR-7.1 | マルチプレイヤー接続 | 🟡 | `MultiplayerSystem`（設定化済・要 signaling/TURN） |
| FR-7.2 | アバター/プレゼンス/空間ボイス | ✅ | `AvatarSystem`: 幾何学的アバター（頭+手）、`addPeer/removePeer/updatePeerPose`、Canvas ラベル。`SpatialAudio.createVoiceSource/removeVoiceSource/updateVoicePosition` で WebRTC MediaStream を空間 PannerNode に接続。`AvatarSystem.setPeerVoiceStream/connectSpatialAudio` で配線、pose 更新時に音声位置を自動同期 |
| FR-8.1 | AI コンテンツ推薦 | 🟡 | `AIRecommendation` ヒューリスティック（時間帯/カテゴリ重み）。`VRApp.navigate()` 経由で BookmarkStore 履歴とリアルタイム同期 |

### 3.6 設定・永続化・PWA・監視・国際化・アクセシビリティ
| ID | 要件 | 状態 | 根拠/備考 |
|----|------|------|-----------|
| FR-9.1 | 設定/プロファイルの永続化 | ✅ | `localStorage`（`loadPersistedSettings`/`saveSettings`） |
| FR-9.2 | VR 内設定パネル | ✅ | トグルボタン式パネル（Teleport/Snap Turn/Comfort/Foveation）。永続化＋即時反映 |
| FR-10.1 | PWA インストール／オフライン | ✅ | `service-worker.js` + manifest |
| FR-10.2 | 起動時の即没入（PWA→requestSession） | ✅ | `display-mode: standalone` 検出時に `enter-vr` 自動発火（200ms 後）。非対応 UA はボタン操作に fallback |
| FR-11.1 | 監視（web-vitals/Sentry/分析） | 🟡 | web-vitals ✅、Sentry/分析は opt-in（本番のみ） |
| FR-12.1 | i18n（多言語 UI） | ✅ | `src/i18n/i18n.js`（ja/en、`navigator.language` 自動判定＋永続化）。ランディングを data-i18n で多言語化、言語トグル付き |
| FR-13.1 | アクセシビリティ（字幕/色覚/コントラスト/片手） | ✅ | ランディングに高コントラスト/大文字/reduced-motion（`src/a11y`）。VR内 gaze-dwell ハンズフリー選択（`GazeInteraction`、レティクル進捗）。VR内字幕（`CaptionSystem`：カメラ追従 HUD パネル、タイムアウト付きキュー、VoiceCommands の `onTranscript` から音声字幕化、設定パネルでトグル） |

## 4. 非機能要件（NFR）
| ID | 要件 | 状態 | 根拠/備考 |
|----|------|------|-----------|
| NFR-1 | 性能目標 FPS の達成 | 🟡 | 実測計測を整備（FPS/フレーム時間/draw calls/三角形/programs/geo/tex を `renderer.info` から overlay 表示）。実機での FPS 達成検証はハードウェア待ち |
| NFR-2 | 端末互換（Quest2/3, Pico4） | ✅ | `DeviceCompatibility.check()` — UA ベースのデバイスティア検出（quest3/quest2/pico4）、WebXR 任意機能プローブ、`targetFPS()` 自動設定 |
| NFR-3 | セキュリティ（オリジン分離/権限） | 🟡 | 遠隔描画(FR-1.1)未実装のためホスト委譲 |
| NFR-4 | 品質（テスト/カバレッジ） | 🟡 | 主要純ロジックに単体テスト追加。広域カバレッジは低 |
| NFR-5 | CI 再現性（`npm ci`） | ✅ | lockfile コミット済 |
| NFR-6 | 保守性（単一フレームクロック等） | ✅ | `render()` で dt を一度計算し `updateSystems(t,f,dt)` / `updateLocomotion(dt)` へ配布。`_lastLocoTime`/`_lastFFRTime` を廃止 |
| NFR-7 | 廃止インフラ非依存 | ✅ | マルチプレイヤの死んだ signaling/TURN を除去・設定化 |

## 5. 不足の実装計画（本仕様から導出）

**フェーズ1（中核）**: FR-1.1 実 Web 描画 → FR-1.2/1.3 クローム → FR-1.5 Layers。
**フェーズ2（操作・移動の完成）**: FR-3.3 スムーズ移動、FR-3.4 rig 旋回修正、FR-2.3 interactable レジストリ。
**フェーズ3（永続・UI・PWA）**: FR-9.2 設定 UI、FR-1.4 履歴/ブックマーク、FR-10.2 即没入、FR-6.3 永続アンカー。
**フェーズ4（先端）**: FR-4.2 gaze フォービエーション、FR-4.4/4.5 WebGPU/3DGS、FR-7.2 アバター、FR-5.2 オーディオ高度化。
**横断**: i18n(FR-12.1)、アクセシビリティ(FR-13.1)、NFR-1 実機計測、NFR-4 カバレッジ拡充。

## 6. 本セッションでの実装（適合改善の記録）
- FR-3.1 playerRig / FR-2.1 コントローラ＋レイ（`cdb4c04`）
- FR-3.2 テレポート移動（`4f6cd1d`）
- FR-3.4 スナップ旋回（`ab11e6d`）
- FR-2.3 interactable レジストリ＋ホバー＋Recenter ボタン（`0e18443`）
- FR-9.2 VR内設定パネル（`1686bc0`）
- FR-3.3 スムーズ移動＋快適性連動（`22c412c`）
- FR-12.1 i18n（ja/en、ランディング多言語化＋トグル）（`0695da0`）
- FR-13.1 アクセシビリティ（ランディング: 高コントラスト/大文字/reduced-motion）（`a61ff6a`）
- NFR-1 性能計測の実体化（renderer.info の GPU メトリクスを overlay 表示）（本コミット）
- FR-4.6 ホーム環境 / FR-7.1 マルチプレイヤ設定化（`bd6d132`）
- FR-9.1 設定永続化 / NFR-5 lockfile（`77426d7`）
- NFR-4 単体テスト追加（`3a42b98`）
- NFR-1 性能計測 GPU メトリクス overlay（`16b9860`）
- FR-5.2 知覚的オーディオ LOD（`hrtfThreshold`・`updateAllLOD`）（`891590d`）
- FR-10.2 PWA 即没入（`display-mode:standalone` 自動 enter-vr）（`92ca046`）
- FR-6.3 永続アンカー（IndexedDB `QuiBrowserMR/anchors`、`loadSavedAnchors` / `deletePersistedAnchor` / `clearSavedAnchors`）（`0eca44f`）
- Phase 4.1 PerformanceMonitor 配線（`render()` に `beginFrame`/`endFrame` 追加、'P'キーで rich UI トグル）（`ad64c3f`）
- FR-4.2 予測 gaze foveation（頭部角速度 → FFR 強度）＋ `FFRSystem.adjustIntensity`（`208c307`）
- NFR-6 統一フレームクロック（`render()` で dt 一元計算・配布）（本コミット）
- FR-1.4 BookmarkStore（bookmarks + history, localStorage 永続化）（`06a565b`）
- NFR-2 DeviceCompatibility（UA ティア検出・WebXR 機能マトリクス・targetFPS 自動設定）（`a55b51d`）
- FR-2.4 VoiceCommands → ✅（設定フラグ＋配線済確認）
- FR-7.2 AvatarSystem（幾何学的アバター・pose 更新・Canvas ラベル）（`9e0bbb2`）
- FR-8.1 AIRecommendation → BookmarkStore 連携（起動時履歴シード + `navigate()` リアルタイム更新）（`5409fab`）
- NFR-4 AvatarSystem テスト追加（62 tests total）（`5409fab`）
- FR-1.1/1.2 WebPanel（iframe + dom-overlay、URL chrome、back/forward/reload）（`3897963`）
- FR-1.3 TabManager（複数 WebPanel・タブストリップ・最大8タブ）（`31668fd`）
- FR-1.5 WebXR Layers（`LayersSystem`・`WebPanel.enableLayerMode`・VRApp 配線）（`ea87393`）
- FR-13.1 VR gaze-dwell ハンズフリー選択（`GazeInteraction`・レティクル・設定トグル）（`db1e306`）
- FR-6.4 メッシュ検出＋深度センシング（`MixedReality.updateMeshes`/`updateDepth`/`getDepthInMeters`）（`8bbd070`）
- FR-7.2 空間ボイス統合（`SpatialAudio.createVoiceSource`＋`AvatarSystem.setPeerVoiceStream`）（`54bf8e2`）
- FR-13.1 VR内字幕（`CaptionSystem`：HUDパネル・タイムアウトキュー・VoiceCommands 連携）（`2624e3f`）
- FR-1.6 空間ウィンドウ管理（`WindowManager`：head-lock follow/billboard/距離/grab、Wolvic/Quest 調査由来）（`cfef329`）
- FR-1.7 湾曲スクリーン（`curvedPlaneData`/`WebPanel.setCurved`/`TabManager.setCurved`、Quest 調査由来）（本コミット）
