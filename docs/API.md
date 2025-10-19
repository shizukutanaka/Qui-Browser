# Qui Browser VR - API Reference

**Developer API Documentation for VR Browser Modules**

Version: 2.0.0
Last Updated: 2025-10-19

---

## Table of Contents

1. [Core Systems](#core-systems)
2. [UI/UX Optimization](#uiux-optimization)
3. [Advanced Features](#advanced-features)
4. [3D Visualization](#3d-visualization)
5. [Interaction Systems](#interaction-systems)
6. [Media Handling](#media-handling)
7. [Utility Functions](#utility-functions)

---

## Core Systems

### VRLauncher

**File**: `assets/js/vr-launcher.js` (195 lines)

WebXR session management and VR mode initialization.

#### Constructor

```javascript
const launcher = new VRLauncher();
```

#### Methods

##### `checkVRSupport()`

Check if WebXR is supported by the browser.

```javascript
const isSupported = await launcher.checkVRSupport();
// Returns: boolean
```

##### `enterVR()`

Enter VR mode and start WebXR session.

```javascript
launcher.enterVR()
  .then(session => console.log('VR session started', session))
  .catch(err => console.error('Failed to enter VR', err));
```

##### `exitVR()`

Exit VR mode and end WebXR session.

```javascript
launcher.exitVR();
```

#### Events

```javascript
window.addEventListener('vr-session-started', (event) => {
  console.log('VR session started', event.detail);
});

window.addEventListener('vr-session-ended', (event) => {
  console.log('VR session ended', event.detail);
});
```

---

### VRUtils

**File**: `assets/js/vr-utils.js` (340 lines)

Utility functions for VR operations.

#### Methods

##### `showNotification(title, message, type, duration)`

Display VR notification.

```javascript
window.vrUtils.showNotification(
  'Success',
  'Bookmark saved',
  'success',
  3000
);
```

**Parameters**:
- `title` (string): Notification title
- `message` (string): Notification message
- `type` (string): 'info' | 'success' | 'warning' | 'error'
- `duration` (number): Display duration in milliseconds

##### `detectVRDevice()`

Detect current VR device type.

```javascript
const device = window.vrUtils.detectVRDevice();
// Returns: 'meta-quest-2' | 'meta-quest-3' | 'pico-4' | 'unknown'
```

##### `getStorageInfo()`

Get storage information.

```javascript
const storage = await window.vrUtils.getStorageInfo();
// Returns: { usage: number, quota: number, percentage: number }
```

---

## UI/UX Optimization

### VRTextRenderer

**File**: `assets/js/vr-text-renderer.js` (650 lines)

Research-based text rendering for optimal VR readability.

#### Constructor

```javascript
const textRenderer = new VRTextRenderer();
```

#### Methods

##### `calculateFontSize(distance)`

Calculate optimal font size based on viewing distance.

```javascript
const fontSize = textRenderer.calculateFontSize(2.0); // 2.0 meters
// Returns: number (font size in pixels)
```

**Parameters**:
- `distance` (number): Viewing distance in meters (default: 2.0)

**Based on**: 1.33° minimum, 3.45° recommended visual angle

##### `createTextCanvas(text, options)`

Create canvas with readable VR text.

```javascript
const canvas = textRenderer.createTextCanvas('Hello VR', {
  fontSize: 48,
  maxWidth: 1024,
  color: '#FFFFFF',
  backgroundColor: '#1a1a2e',
  padding: 20
});
```

**Options**:
- `fontSize` (number): Font size in pixels
- `maxWidth` (number): Maximum canvas width
- `color` (string): Text color (hex)
- `backgroundColor` (string): Background color (hex)
- `padding` (number): Canvas padding

##### `createTextSprite(text, options)`

Create Three.js sprite with text.

```javascript
const sprite = textRenderer.createTextSprite('Click Me', {
  fontSize: 48,
  scale: 1.0,
  distance: 2.0
});
scene.add(sprite);
```

##### `validateReadability(text, options)`

Validate text readability for VR.

```javascript
const validation = textRenderer.validateReadability('Test', {
  fontSize: 48,
  distance: 2.0,
  textColor: '#FFFFFF',
  backgroundColor: '#1a1a2e'
});
// Returns: { isValid: boolean, warnings: [], recommendations: [] }
```

---

### VRErgonomicUI

**File**: `assets/js/vr-ergonomic-ui.js` (620 lines)

Ergonomic UI positioning for comfort and accessibility.

#### Constructor

```javascript
const ergoUI = new VRErgonomicUI();
```

#### Initialization

```javascript
ergoUI.init(camera, scene);
```

**Parameters**:
- `camera` (THREE.Camera): VR camera
- `scene` (THREE.Scene): Three.js scene

#### Methods

##### `positionInViewingZone(element, options)`

Position UI element in optimal viewing zone.

```javascript
const position = ergoUI.positionInViewingZone(uiElement, {
  zone: 'primary',            // 'primary' | 'secondary' | 'peripheral'
  distance: 2.0,              // meters
  horizontalAngle: 0,         // degrees from center
  verticalAngle: -10,         // degrees from center (negative = down)
  anchorMode: 'lazy-follow'   // 'world' | 'head' | 'smooth-follow' | 'lazy-follow'
});
```

**Viewing Zones**:
- **Primary**: ±30° horizontal, ±15° vertical, 0.5-3.0m
- **Secondary**: ±45° horizontal, ±30° vertical, 0.5-5.0m
- **Peripheral**: ±60° horizontal, ±45° vertical, 0.5-10.0m

##### `createButton(text, options)`

Create ergonomic VR button.

```javascript
const button = ergoUI.createButton('Click Me', {
  width: 0.36,              // meters (recommended: 0.36 for 12cm button)
  height: 0.12,             // meters
  onClick: () => console.log('Clicked!'),
  color: 0x00ffff,
  hoverColor: 0x00ffff,
  textColor: '#000000'
});
scene.add(button);
```

##### `createLayout(elements, options)`

Create comfortable UI layout.

```javascript
const layout = ergoUI.createLayout([button1, button2, button3], {
  type: 'vertical',    // 'vertical' | 'horizontal' | 'grid'
  spacing: 0.02,       // meters
  distance: 2.0,       // meters
  centered: true
});
scene.add(layout);
```

##### `update(deltaTime)`

Update UI positions (call in render loop).

```javascript
function animate() {
  const deltaTime = clock.getDelta();
  ergoUI.update(deltaTime);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

---

### VRComfortSystem

**File**: `assets/js/vr-comfort-system.js` (590 lines)

Motion sickness prevention and comfort features.

#### Constructor

```javascript
const comfortSystem = new VRComfortSystem();
```

#### Initialization

```javascript
comfortSystem.init(scene, camera);
```

#### Methods

##### `update(deltaTime)`

Update comfort system (call in render loop).

```javascript
function animate() {
  const deltaTime = clock.getDelta();
  comfortSystem.update(deltaTime);
}
```

##### `teleportTo(position, callback)`

Teleport to position with fade effect.

```javascript
const targetPos = new THREE.Vector3(5, 0, 5);
comfortSystem.teleportTo(targetPos, () => {
  console.log('Teleport complete');
});
```

##### `showTeleportTarget(position)`

Show teleport target marker.

```javascript
comfortSystem.showTeleportTarget(new THREE.Vector3(5, 0, 5));
```

##### `snapTurn(direction)`

Snap turn camera for comfort.

```javascript
comfortSystem.snapTurn(1);  // Turn right 30°
comfortSystem.snapTurn(-1); // Turn left 30°
```

##### `updateSettings(newSettings)`

Update comfort settings.

```javascript
comfortSystem.updateSettings({
  vignette: { enabled: true, intensity: 0.6 },
  locomotion: { mode: 'teleport', snapTurn: true },
  staticReference: { enabled: true, type: 'grid' }
});
```

**Settings**:
- `vignette`: Motion vignette effect
- `locomotion`: Movement mode ('teleport' | 'smooth' | 'dash')
- `frameRate`: Target FPS (90 optimal, 72 minimum)
- `staticReference`: Visual reference ('grid' | 'horizon' | 'nose')

---

### VRInputOptimizer

**File**: `assets/js/vr-input-optimizer.js` (680 lines)

Multi-modal input optimization (gaze, hand, controller).

#### Constructor

```javascript
const inputOptimizer = new VRInputOptimizer();
```

#### Initialization

```javascript
inputOptimizer.init(camera, scene, renderer, {
  mode: 'hybrid',        // 'gaze' | 'hand' | 'controller' | 'hybrid'
  dwellTime: 1000,       // ms for gaze selection
  enableHaptics: true
});
```

#### Methods

##### `registerInteractiveObject(object, callbacks)`

Register object for VR interaction.

```javascript
inputOptimizer.registerInteractiveObject(button, {
  onHover: () => console.log('Hovered'),
  onSelect: () => console.log('Selected'),
  onLongPress: () => console.log('Long pressed')
});
```

##### `unregisterInteractiveObject(object)`

Unregister interactive object.

```javascript
inputOptimizer.unregisterInteractiveObject(button);
```

##### `setInputMode(mode)`

Change input mode.

```javascript
inputOptimizer.setInputMode('hand'); // 'gaze' | 'hand' | 'controller' | 'hybrid'
```

##### `update(deltaTime)`

Update input system (call in render loop).

```javascript
function animate() {
  const deltaTime = clock.getDelta();
  inputOptimizer.update(deltaTime);
}
```

---

### VRAccessibilityEnhanced

**File**: `assets/js/vr-accessibility-enhanced.js` (720 lines)

Comprehensive accessibility features (WCAG AAA compliant).

#### Constructor

```javascript
const accessibility = new VRAccessibilityEnhanced();
```

#### Initialization

```javascript
accessibility.init();
```

#### Methods

##### `setTextScale(scale)`

Set text scaling factor.

```javascript
accessibility.setTextScale(1.5); // 0.5 - 2.0, minimum 48px
```

##### `setColorBlindnessFilter(type)`

Apply color blindness filter.

```javascript
accessibility.setColorBlindnessFilter('protanopia');
// Options: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'
```

##### `setHighContrastTheme(theme)`

Set high contrast theme.

```javascript
accessibility.setHighContrastTheme('dark');
// Options: 'none' | 'dark' | 'light' | 'yellow-black'
```

##### `enableVoiceControl(enabled)`

Enable/disable voice control.

```javascript
accessibility.enableVoiceControl(true);
```

**Voice Commands (Japanese)**:
- "戻る" (back)
- "進む" (forward)
- "更新" (refresh)
- "ホーム" (home)
- "検索" (search)
- "ブックマーク" (bookmark)

##### `enableReducedMotion(enabled)`

Enable/disable reduced motion mode.

```javascript
accessibility.enableReducedMotion(true);
```

---

## Advanced Features

### VREnvironmentCustomizer

**File**: `assets/js/vr-environment-customizer.js` (680 lines)

Environment and UI layout customization.

#### Constructor

```javascript
const envCustomizer = new VREnvironmentCustomizer();
```

#### Initialization

```javascript
envCustomizer.init(scene, camera);
```

#### Methods

##### `setEnvironmentPreset(presetName)`

Set environment preset.

```javascript
envCustomizer.setEnvironmentPreset('space');
// Options: 'space' | 'forest' | 'ocean' | 'minimal' | 'sunset' | 'cyberpunk'
```

**Presets**:
- **space**: Starfield, dark background, 5000 particles
- **forest**: Green fog, forest skybox
- **ocean**: Blue gradient, wave particles
- **minimal**: Clean white, no particles
- **sunset**: Orange gradient, warm lighting
- **cyberpunk**: Neon grid, purple/cyan particles

##### `setUILayoutPreset(presetName)`

Set UI layout preset.

```javascript
envCustomizer.setUILayoutPreset('comfortable');
// Options: 'default' | 'comfortable' | 'theater' | 'floating'
```

**Layouts**:
- **default**: Straight ahead, 2.0m distance
- **comfortable**: Slight angle down, 1.8m distance
- **theater**: Wide field, 3.0m distance
- **floating**: Above and around, 1.5m distance

##### `createCustomEnvironment(options)`

Create custom environment.

```javascript
envCustomizer.createCustomEnvironment({
  backgroundColor: 0x1a1a2e,
  fogColor: 0x444444,
  fogDensity: 0.1,
  particles: {
    enabled: true,
    count: 3000,
    color: 0xffffff,
    size: 0.05
  }
});
```

---

### VRGestureMacro

**File**: `assets/js/vr-gesture-macro.js` (790 lines)

Custom gesture macro recording and playback.

#### Constructor

```javascript
const gestureMacro = new VRGestureMacro();
```

#### Initialization

```javascript
gestureMacro.init(handTrackingSystem);
```

#### Methods

##### `startRecording(macroName)`

Start recording gesture macro.

```javascript
gestureMacro.startRecording('quick-nav');
// Perform gestures...
```

##### `stopRecording()`

Stop recording and save macro.

```javascript
const macro = gestureMacro.stopRecording();
// Returns: { name, gestures: [], duration }
```

##### `playMacro(macroName)`

Play recorded macro.

```javascript
gestureMacro.playMacro('quick-nav')
  .then(() => console.log('Macro completed'))
  .catch(err => console.error('Macro failed', err));
```

##### `createMacro(name, gestures, actions)`

Create macro programmatically.

```javascript
gestureMacro.createMacro('custom-nav', [
  { type: 'swipeRight', threshold: 0.3 },
  { type: 'pinch', threshold: 0.8 }
], [
  () => console.log('Swipe detected'),
  () => console.log('Pinch detected')
]);
```

**Gesture Patterns**:
- Swipe (4 directions)
- Circle
- Pinch
- Grab
- Point
- Wave
- Thumbs up
- Peace sign
- Fist

---

### VRContentOptimizer

**File**: `assets/js/vr-content-optimizer.js` (650 lines)

360° content and WebXR scene optimization.

#### Constructor

```javascript
const contentOptimizer = new VRContentOptimizer();
```

#### Initialization

```javascript
contentOptimizer.init(renderer);
```

#### Methods

##### `optimize360Video(videoElement, options)`

Optimize 360° video playback.

```javascript
contentOptimizer.optimize360Video(videoElement, {
  maxResolution: 4096,
  adaptiveBitrate: true,
  spatialAudio: true,
  bufferSize: 10 // seconds
});
```

##### `optimize360Image(imageUrl, options)`

Optimize 360° image loading.

```javascript
contentOptimizer.optimize360Image('/path/to/panorama.jpg', {
  maxResolution: 8192,
  progressiveLoad: true,
  generateMipmaps: true
})
.then(texture => {
  // Use texture
});
```

##### `optimizeWebXRScene(scene, options)`

Optimize WebXR scene for performance.

```javascript
contentOptimizer.optimizeWebXRScene(scene, {
  targetFPS: 90,
  enableLOD: true,
  frustumCulling: true,
  textureCompression: true
});
```

---

### VRPerformanceProfiler

**File**: `assets/js/vr-performance-profiler.js` (580 lines)

Comprehensive performance monitoring and profiling.

#### Constructor

```javascript
const profiler = new VRPerformanceProfiler();
```

#### Initialization

```javascript
profiler.init(renderer, scene);
```

#### Methods

##### `startProfiling()`

Start profiling session.

```javascript
profiler.startProfiling();
```

##### `stopProfiling()`

Stop profiling and get results.

```javascript
const results = profiler.stopProfiling();
// Returns: { fps, memory, cpu, gpu, bottlenecks, recommendations }
```

##### `getMetrics()`

Get current performance metrics.

```javascript
const metrics = profiler.getMetrics();
// Returns: {
//   fps: { current, average, min, max },
//   frameTime: { current, average },
//   memory: { used, total, heapPercentage },
//   gpu: { usage, memory },
//   rendering: { drawCalls, triangles, textures }
// }
```

##### `detectBottlenecks()`

Detect performance bottlenecks.

```javascript
const bottlenecks = profiler.detectBottlenecks();
// Returns: ['cpu' | 'gpu' | 'memory' | 'network']
```

##### `getRecommendations()`

Get optimization recommendations.

```javascript
const recommendations = profiler.getRecommendations();
// Returns: [{ type, priority, message, action }]
```

---

## 3D Visualization

### VRBookmark3D

**File**: `assets/js/vr-bookmark-3d.js` (590 lines)

3D bookmark visualization in VR space.

#### Constructor

```javascript
const bookmark3D = new VRBookmark3D();
```

#### Initialization

```javascript
bookmark3D.init(scene, camera);
```

#### Methods

##### `setLayout(layoutType)`

Set bookmark visualization layout.

```javascript
bookmark3D.setLayout('sphere');
// Options: 'grid' | 'sphere' | 'wall' | 'carousel'
```

##### `addBookmark(bookmark)`

Add bookmark to 3D visualization.

```javascript
bookmark3D.addBookmark({
  title: 'Example Site',
  url: 'https://example.com',
  favicon: '/path/to/icon.png',
  category: 'favorites'
});
```

##### `removeBookmark(id)`

Remove bookmark by ID.

```javascript
bookmark3D.removeBookmark('bookmark-123');
```

##### `show()`

Show bookmark visualization.

```javascript
bookmark3D.show();
```

##### `hide()`

Hide bookmark visualization.

```javascript
bookmark3D.hide();
```

---

### VRTabManager3D

**File**: `assets/js/vr-tab-manager-3d.js` (595 lines)

3D spatial tab management.

#### Constructor

```javascript
const tabManager3D = new VRTabManager3D();
```

#### Initialization

```javascript
tabManager3D.init(scene, camera);
```

#### Methods

##### `setLayout(layoutType)`

Set tab layout.

```javascript
tabManager3D.setLayout('arc');
// Options: 'arc' | 'stack' | 'grid' | 'cylinder'
```

##### `createTab(options)`

Create new tab.

```javascript
const tabId = tabManager3D.createTab({
  url: 'https://example.com',
  title: 'Example',
  active: true
});
```

##### `switchToTab(tabId)`

Switch to specific tab.

```javascript
tabManager3D.switchToTab('tab-123');
```

##### `closeTab(tabId)`

Close tab.

```javascript
tabManager3D.closeTab('tab-123');
```

**Keyboard Shortcuts**:
- `Ctrl + Tab`: Next tab
- `Ctrl + Shift + Tab`: Previous tab
- `Ctrl + T`: New tab
- `Ctrl + W`: Close current tab
- `1-9`: Quick switch to tab number

---

### VRSpatialAudio

**File**: `assets/js/vr-spatial-audio.js` (449 lines)

3D spatial audio system with HRTF.

#### Constructor

```javascript
const spatialAudio = new VRSpatialAudio();
```

#### Initialization

```javascript
spatialAudio.init(camera);
```

#### Methods

##### `playSound(soundName, position, options)`

Play spatial sound at position.

```javascript
spatialAudio.playSound('click', new THREE.Vector3(1, 1.6, -2), {
  volume: 0.8,
  loop: false
});
```

**Available Sounds**:
- `click`: UI click
- `hover`: UI hover
- `navigate`: Page navigation
- `notification`: Alert sound
- `error`: Error notification
- `success`: Success notification
- `tab-switch`: Tab change
- `menu-open`: Menu open
- `menu-close`: Menu close
- `typing`: Keyboard typing

##### `createAmbientSound(options)`

Create ambient background sound.

```javascript
const ambient = spatialAudio.createAmbientSound({
  type: 'white-noise',
  volume: 0.1,
  loop: true
});
ambient.play();
```

##### `updateListenerPosition(position, rotation)`

Update audio listener position (auto-synced with camera).

```javascript
spatialAudio.updateListenerPosition(
  camera.position,
  camera.quaternion
);
```

---

## Interaction Systems

### VRHandTracking

**File**: `assets/js/vr-hand-tracking.js` (450 lines)

WebXR hand tracking integration.

#### Constructor

```javascript
const handTracking = new VRHandTracking();
```

#### Initialization

```javascript
handTracking.init(xrSession, scene);
```

#### Methods

##### `enableHandModels(enabled)`

Show/hide visual hand models.

```javascript
handTracking.enableHandModels(true);
```

##### `onGesture(gestureName, callback)`

Register gesture callback.

```javascript
handTracking.onGesture('pinch', (hand, strength) => {
  console.log(`${hand} pinch: ${strength}`);
});
```

**Gestures**:
- `pinch`: Thumb + index finger
- `grab`: Closed fist
- `point`: Index finger extended
- `thumbsUp`: Thumb up

##### `getRaycast(hand)`

Get raycast from hand.

```javascript
const raycast = handTracking.getRaycast('right');
// Returns: { origin: Vector3, direction: Vector3 }
```

---

### VRGestureScroll

**File**: `assets/js/vr-gesture-scroll.js` (487 lines)

Natural hand gesture-based scrolling.

#### Constructor

```javascript
const gestureScroll = new VRGestureScroll();
```

#### Initialization

```javascript
gestureScroll.init(handTrackingSystem, {
  mode: 'grab',           // 'grab' | 'swipe' | 'point'
  hand: 'right',          // 'left' | 'right' | 'both'
  scrollSpeed: 1.0,
  enableHaptics: true
});
```

#### Methods

##### `setScrollMode(mode)`

Change scroll mode.

```javascript
gestureScroll.setScrollMode('swipe');
// Options: 'grab' | 'swipe' | 'point'
```

##### `setScrollTarget(element)`

Set scroll target element.

```javascript
gestureScroll.setScrollTarget(document.querySelector('.content'));
```

---

### VRKeyboard

**File**: `assets/js/vr-keyboard.js` (550 lines)

Virtual QWERTY keyboard for VR.

#### Constructor

```javascript
const vrKeyboard = new VRKeyboard();
```

#### Initialization

```javascript
vrKeyboard.init(scene, camera, inputOptimizer);
```

#### Methods

##### `show(inputField, options)`

Show keyboard for input.

```javascript
vrKeyboard.show(urlInputElement, {
  layout: 'url',          // 'qwerty' | 'url' | 'numeric'
  suggestions: true,
  autocomplete: true
});
```

##### `hide()`

Hide keyboard.

```javascript
vrKeyboard.hide();
```

##### `setLayout(layoutName)`

Change keyboard layout.

```javascript
vrKeyboard.setLayout('numeric');
// Options: 'qwerty' | 'url' | 'numeric'
```

---

### VRNavigation

**File**: `assets/js/vr-navigation.js` (550 lines)

VR navigation system with URL bar, history, bookmarks.

#### Constructor

```javascript
const vrNav = new VRNavigation();
```

#### Initialization

```javascript
vrNav.init(scene, camera);
```

#### Methods

##### `navigateTo(url)`

Navigate to URL.

```javascript
vrNav.navigateTo('https://example.com');
```

##### `goBack()`

Navigate back in history.

```javascript
vrNav.goBack();
```

##### `goForward()`

Navigate forward in history.

```javascript
vrNav.goForward();
```

##### `refresh()`

Refresh current page.

```javascript
vrNav.refresh();
```

##### `addToBookmarks()`

Add current page to bookmarks.

```javascript
vrNav.addToBookmarks();
```

##### `showURLBar()`

Show URL input bar.

```javascript
vrNav.showURLBar();
```

**Keyboard Shortcut**: `Ctrl + L`

---

## Media Handling

### VRVideoPlayer

**File**: `assets/js/vr-video-player.js` (600 lines)

360°/180° video player for VR.

#### Constructor

```javascript
const videoPlayer = new VRVideoPlayer();
```

#### Initialization

```javascript
videoPlayer.init(scene, camera);
```

#### Methods

##### `loadVideo(videoUrl, options)`

Load 360°/180° video.

```javascript
videoPlayer.loadVideo('/path/to/360video.mp4', {
  mode: '360',            // '360' | '180' | 'flat'
  autoplay: false,
  spatialAudio: true
});
```

##### `play()`

Play video.

```javascript
videoPlayer.play();
```

##### `pause()`

Pause video.

```javascript
videoPlayer.pause();
```

##### `seek(time)`

Seek to time.

```javascript
videoPlayer.seek(30); // Seek to 30 seconds
```

##### `setVolume(volume)`

Set volume (0.0 - 1.0).

```javascript
videoPlayer.setVolume(0.8);
```

##### `setVideoMode(mode)`

Change video projection mode.

```javascript
videoPlayer.setVideoMode('180');
// Options: '360' | '180' | 'flat'
```

##### `enterVRMode()`

Enter VR mode for video.

```javascript
videoPlayer.enterVRMode();
```

**Keyboard Controls**:
- `Space`: Play/Pause
- `←/→`: Seek backward/forward 10s
- `↑/↓`: Volume up/down
- `M`: Mute/Unmute
- `F`: Fullscreen

---

## Utility Functions

### Storage

```javascript
// Save to localStorage
window.vrUtils.saveToStorage('key', { data: 'value' });

// Load from localStorage
const data = window.vrUtils.loadFromStorage('key');

// Clear storage
window.vrUtils.clearStorage();
```

### Performance

```javascript
// Measure performance
const duration = window.vrUtils.measurePerformance('operation', () => {
  // Your code here
});
console.log(`Operation took ${duration}ms`);
```

### Debounce & Throttle

```javascript
// Debounce function
const debouncedFn = window.vrUtils.debounce(() => {
  console.log('Called after delay');
}, 500);

// Throttle function
const throttledFn = window.vrUtils.throttle(() => {
  console.log('Called at most once per interval');
}, 1000);
```

### Network Status

```javascript
// Check online status
const isOnline = window.vrUtils.isOnline();

// Listen for status changes
window.addEventListener('online', () => {
  console.log('Back online');
});

window.addEventListener('offline', () => {
  console.log('Went offline');
});
```

---

## Events Reference

### Global VR Events

```javascript
// VR session events
window.addEventListener('vr-session-started', (e) => {
  console.log('Session:', e.detail.session);
});

window.addEventListener('vr-session-ended', (e) => {
  console.log('Session ended');
});

// Performance events
window.addEventListener('vr-performance', (e) => {
  const { fps, frameTime, droppedFrames } = e.detail;
});

// Settings changed
window.addEventListener('vr-settings-changed', (e) => {
  console.log('New settings:', e.detail);
});

// Gesture detected
window.addEventListener('vr-gesture', (e) => {
  const { type, hand, strength } = e.detail;
});

// Navigation events
window.addEventListener('vr-navigate', (e) => {
  console.log('Navigating to:', e.detail.url);
});

window.addEventListener('vr-navigate-complete', (e) => {
  console.log('Navigation complete');
});
```

---

## Configuration Examples

### Basic VR Setup

```javascript
// Initialize VR browser
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Initialize systems
const launcher = new VRLauncher();
const textRenderer = new VRTextRenderer();
const ergoUI = new VRErgonomicUI();
const comfortSystem = new VRComfortSystem();
const inputOptimizer = new VRInputOptimizer();

// Setup
ergoUI.init(camera, scene);
comfortSystem.init(scene, camera);
inputOptimizer.init(camera, scene, renderer);

// Render loop
function animate() {
  const deltaTime = clock.getDelta();

  ergoUI.update(deltaTime);
  comfortSystem.update(deltaTime);
  inputOptimizer.update(deltaTime);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

### Complete Feature Setup

```javascript
// All systems
const systems = {
  textRenderer: new VRTextRenderer(),
  ergoUI: new VRErgonomicUI(),
  comfort: new VRComfortSystem(),
  input: new VRInputOptimizer(),
  accessibility: new VRAccessibilityEnhanced(),
  environment: new VREnvironmentCustomizer(),
  gestureMacro: new VRGestureMacro(),
  contentOptimizer: new VRContentOptimizer(),
  profiler: new VRPerformanceProfiler(),
  bookmark3D: new VRBookmark3D(),
  tabManager3D: new VRTabManager3D(),
  spatialAudio: new VRSpatialAudio(),
  handTracking: new VRHandTracking(),
  gestureScroll: new VRGestureScroll(),
  keyboard: new VRKeyboard(),
  navigation: new VRNavigation(),
  videoPlayer: new VRVideoPlayer()
};

// Initialize all
Object.values(systems).forEach(system => {
  if (system.init) {
    system.init(scene, camera, renderer);
  }
});
```

---

## TypeScript Definitions

For TypeScript projects, type definitions are available:

```typescript
declare class VRTextRenderer {
  calculateFontSize(distance?: number): number;
  createTextCanvas(text: string, options?: TextCanvasOptions): HTMLCanvasElement;
  createTextSprite(text: string, options?: TextSpriteOptions): THREE.Sprite;
  validateReadability(text: string, options?: ReadabilityOptions): ValidationResult;
}

interface TextCanvasOptions {
  fontSize?: number;
  maxWidth?: number;
  color?: string;
  backgroundColor?: string;
  padding?: number;
}

// ... (more definitions available)
```

---

## Best Practices

### Performance

1. **Call update() methods in render loop**:
   ```javascript
   function animate() {
     const deltaTime = clock.getDelta();
     ergoUI.update(deltaTime);
     comfortSystem.update(deltaTime);
     inputOptimizer.update(deltaTime);
   }
   ```

2. **Use lazy-follow for UI anchoring**:
   ```javascript
   ergoUI.positionInViewingZone(element, {
     anchorMode: 'lazy-follow' // Prevents motion sickness
   });
   ```

3. **Enable performance profiling in development**:
   ```javascript
   if (isDevelopment) {
     profiler.startProfiling();
   }
   ```

### Accessibility

1. **Always validate text readability**:
   ```javascript
   const validation = textRenderer.validateReadability(text, options);
   if (!validation.isValid) {
     console.warn('Text not readable:', validation.warnings);
   }
   ```

2. **Provide alternatives for gestures**:
   ```javascript
   // Always support both gesture and button controls
   inputOptimizer.registerInteractiveObject(element, {
     onSelect: handleAction // Works with gaze, hand, controller
   });
   ```

3. **Use high contrast for important UI**:
   ```javascript
   accessibility.setHighContrastTheme('dark');
   ```

### Comfort

1. **Use teleport for locomotion**:
   ```javascript
   comfortSystem.updateSettings({
     locomotion: { mode: 'teleport' } // Reduces motion sickness
   });
   ```

2. **Maintain 90 FPS target**:
   ```javascript
   contentOptimizer.optimizeWebXRScene(scene, {
     targetFPS: 90
   });
   ```

3. **Enable comfort features**:
   ```javascript
   comfortSystem.updateSettings({
     vignette: { enabled: true },
     staticReference: { enabled: true, type: 'grid' }
   });
   ```

---

## Troubleshooting

### Common Issues

**Issue**: Text is blurry in VR

```javascript
// Solution: Increase font size based on distance
const fontSize = textRenderer.calculateFontSize(viewDistance);
```

**Issue**: UI is uncomfortable to view

```javascript
// Solution: Use ergonomic positioning
ergoUI.positionInViewingZone(element, {
  zone: 'primary',
  verticalAngle: -10 // Slight downward angle
});
```

**Issue**: Performance drops below 72 FPS

```javascript
// Solution: Enable auto-optimization
profiler.detectBottlenecks(); // Identify issues
contentOptimizer.optimizeWebXRScene(scene, {
  targetFPS: 90,
  enableLOD: true
});
```

**Issue**: Hand tracking not working

```javascript
// Solution: Check WebXR support
const hasHandTracking = await navigator.xr?.isSessionSupported('immersive-vr', {
  requiredFeatures: ['hand-tracking']
});
```

---

## Support & Resources

- **GitHub Repository**: https://github.com/yourusername/qui-browser-vr
- **Issues**: https://github.com/yourusername/qui-browser-vr/issues
- **Documentation**: https://docs.qui-browser.example.com
- **Community Discord**: https://discord.gg/qui-browser

---

**Version**: 2.0.0
**Last Updated**: 2025-10-19
**License**: MIT
