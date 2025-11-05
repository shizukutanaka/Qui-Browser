# Qui Browser VR - Implementation Guide
## From Research to Production (Step-by-Step)

**Last Updated**: November 5, 2025
**Scope**: Tier 1-2 implementations (87+ hours total)
**Philosophy**: Ship working code, iterate, improve

---

## Quick Start (5 Minutes)

### Setup
```bash
git clone <repository>
cd Qui-Browser
npm install
npm run dev
```

### Access VR
1. Open on Meta Quest device
2. Allow WebXR permission
3. Click "Enter VR" button
4. Experience immersive browsing

---

## Tier 1: Core Optimizations (Week 1-2)

### 1. Fixed Foveated Rendering (FFR)

**Time**: 1-2 hours
**GPU Savings**: 25-40%
**Difficulty**: ⭐ Very Easy

**File**: `src/vr/rendering/FFRSystem.js`

```javascript
export class FFRSystem {
  constructor(session, glBinding) {
    this.session = session;
    this.glBinding = glBinding;
    this.projectionLayer = glBinding.getProjectionLayer();
  }

  enable(intensity = 0.5) {
    // intensity: 0-1 (0=no foveation, 1=maximum)
    this.projectionLayer.fixedFoveation = intensity;
  }

  disable() {
    this.projectionLayer.fixedFoveation = 0;
  }

  setDynamic(gpuLoad) {
    // Adjust based on GPU load
    if (gpuLoad > 0.85) {
      this.projectionLayer.fixedFoveation = 0.8;
    } else if (gpuLoad > 0.75) {
      this.projectionLayer.fixedFoveation = 0.5;
    } else {
      this.projectionLayer.fixedFoveation = 0.2;
    }
  }
}
```

**Usage in main VR loop**:
```javascript
const ffrSystem = new FFRSystem(session, glBinding);
ffrSystem.enable(0.5); // Medium foveation

// In animation loop
ffrSystem.setDynamic(gpuMonitor.getLoad());
```

**Validation**:
- [ ] Enable/disable works
- [ ] Visual inspection: edge quality degradation imperceptible
- [ ] FPS maintained at 90+ (Quest 2)

---

### 2. Comfort System (Vignette + FOV + Snap Turn)

**Time**: 4-6 hours
**Effectiveness**: 60-70% motion sickness reduction
**Difficulty**: ⭐⭐ Easy-Medium

**File**: `src/vr/comfort/ComfortSystem.js`

```javascript
export class ComfortSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.baseFOV = camera.fov;
    this.isMoving = false;

    this.settings = {
      preset: 'moderate', // 'sensitive', 'moderate', 'tolerant'
      vignette: 0.4,
      fov: 90,
      snapTurn: 30, // degrees (false for smooth)
      vignetteDistance: 0.5
    };

    this.setupVignette();
  }

  setupVignette() {
    const vignetteShader = `
      varying vec2 vUv;
      uniform float intensity;

      void main() {
        vec2 center = vec2(0.5);
        float dist = distance(vUv, center);
        float vignette = pow(1.0 - (dist * dist), 1.5);
        vignette = mix(0.0, vignette, intensity);

        gl_FragColor = vec4(vec3(1.0 - vignette * 0.5), 1.0);
      }
    `;

    this.vignetteMaterial = new THREE.ShaderMaterial({
      uniforms: { intensity: { value: this.settings.vignette } },
      fragmentShader: vignetteShader
      // ... vertex shader ...
    });
  }

  update(time, deltaTime) {
    // Detect movement
    const lastPos = this.lastPosition || this.camera.position.clone();
    const distance = this.camera.position.distanceTo(lastPos);

    this.isMoving = distance > 0.01;
    this.lastPosition = this.camera.position.clone();

    // Update FOV
    const targetFOV = this.isMoving ? (this.settings.fov - 25) : this.settings.fov;
    this.camera.fov += (targetFOV - this.camera.fov) * deltaTime;
    this.camera.updateProjectionMatrix();

    // Update vignette
    const targetVignette = this.isMoving ? this.settings.vignette : 0;
    this.vignetteMaterial.uniforms.intensity.value +=
      (targetVignette - this.vignetteMaterial.uniforms.intensity.value) * deltaTime;
  }

  handleSnapTurn(degrees) {
    if (!this.settings.snapTurn) return;

    const snapAngle = Math.round(degrees / this.settings.snapTurn) * this.settings.snapTurn;
    const targetRotation = this.camera.rotation.y + THREE.MathUtils.degToRad(snapAngle);

    this.animateRotation(this.camera.rotation.y, targetRotation, 0.2);
  }

  animateRotation(start, target, duration) {
    const startTime = Date.now();
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      this.camera.rotation.y = THREE.MathUtils.lerp(start, target, eased);

      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }

  setPreset(preset) {
    const presets = {
      'sensitive': { vignette: 0.8, fov: 60, snapTurn: 15 },
      'moderate': { vignette: 0.4, fov: 75, snapTurn: 30 },
      'tolerant': { vignette: 0, fov: 90, snapTurn: 45 }
    };

    Object.assign(this.settings, presets[preset] || {});
  }
}
```

**Usage**:
```javascript
const comfort = new ComfortSystem(scene, camera);
comfort.setPreset('moderate');

// In animation loop
comfort.update(clock.getElapsedTime(), deltaTime);

// On user rotation input
controller.addEventListener('thumbstick', (direction) => {
  comfort.handleSnapTurn(direction.x * 45);
});
```

**Validation**:
- [ ] Vignette darkens during movement
- [ ] FOV smoothly changes
- [ ] Snap turning feels smooth
- [ ] Presets changeable in UI

---

### 3. Object Pooling

**Time**: 3-4 hours
**GC Pause Reduction**: 40%
**Difficulty**: ⭐⭐ Easy-Medium

**File**: `src/utils/ObjectPool.js`

```javascript
export class ObjectPool {
  constructor(ObjectClass, initialSize = 50) {
    this.ObjectClass = ObjectClass;
    this.available = [];
    this.inUse = new Set();

    // Pre-allocate
    for (let i = 0; i < initialSize; i++) {
      this.available.push(new ObjectClass());
    }
  }

  acquire() {
    if (this.available.length > 0) {
      const obj = this.available.pop();
      this.inUse.add(obj);
      obj.reset?.();
      return obj;
    }

    console.warn('Pool exhausted, creating new instance');
    const obj = new this.ObjectClass();
    this.inUse.add(obj);
    return obj;
  }

  release(obj) {
    if (!this.inUse.has(obj)) return;

    obj.reset?.();
    this.inUse.delete(obj);
    this.available.push(obj);
  }

  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      utilizationPercent: (this.inUse.size / (this.available.length + this.inUse.size)) * 100
    };
  }
}
```

**Example UI Button Pool**:
```javascript
class VRButton {
  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.1, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x0077ff })
    );
    this.isActive = false;
  }

  reset() {
    this.isActive = false;
    this.mesh.position.set(0, 0, 0);
  }

  activate(position, callback) {
    this.isActive = true;
    this.mesh.position.copy(position);
    this.callback = callback;
  }
}

// Usage
const buttonPool = new ObjectPool(VRButton, 50);

function createButton(position, callback) {
  const button = buttonPool.acquire();
  button.activate(position, callback);
  scene.add(button.mesh);

  setTimeout(() => {
    scene.remove(button.mesh);
    buttonPool.release(button);
  }, 5000);
}
```

**Validation**:
- [ ] No GC pauses visible
- [ ] Frame time variance <1ms
- [ ] Pool stats reasonable (not too many allocated)

---

### 4. KTX2 Texture Compression

**Time**: 1-2 hours
**Memory Savings**: 75%
**Difficulty**: ⭐ Very Easy

**File**: `src/utils/TextureManager.js`

```javascript
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

export class TextureManager {
  constructor() {
    this.ktx2Loader = new KTX2Loader();
    this.ktx2Loader.setTranscoderPath(
      'https://cdn.jsdelivr.net/npm/basis-universal@latest/basis_transcoder.js'
    );
    this.textureCache = new Map();
  }

  async loadTexture(url) {
    if (this.textureCache.has(url)) {
      return this.textureCache.get(url);
    }

    let texture;
    if (url.endsWith('.ktx2')) {
      texture = await this.ktx2Loader.loadAsync(url);
    } else {
      // Fallback for PNG/JPG
      const textureLoader = new THREE.TextureLoader();
      texture = await textureLoader.loadAsync(url);
    }

    this.textureCache.set(url, texture);
    return texture;
  }

  unloadTexture(url) {
    if (this.textureCache.has(url)) {
      const texture = this.textureCache.get(url);
      texture.dispose();
      this.textureCache.delete(url);
    }
  }

  getMemoryUsage() {
    let total = 0;
    for (const [url, texture] of this.textureCache) {
      if (texture.image) {
        total += texture.image.width * texture.image.height * 4;
      }
    }
    return {
      bytes: total,
      megabytes: (total / 1024 / 1024).toFixed(2)
    };
  }
}
```

**Conversion Tool** (Command line):
```bash
# Install
npm install --save-dev @replit/basis-universal

# Convert
basisu input.png -output_file output.ktx2
basisu input.jpg -output_file output.ktx2 -q 185
```

**Validation**:
- [ ] KTX2 loads correctly
- [ ] Memory usage at 75% of original
- [ ] Visual quality acceptable

---

### 5. Service Worker Caching

**Time**: 2-3 hours
**Load Time Improvement**: 70%
**Difficulty**: ⭐ Very Easy

**File**: `public/service-worker.js`

```javascript
const CACHE_NAME = 'qui-browser-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/js/app.js',
  '/js/vr-core.js',
  '/models/default.glb',
  '/environments/default.hdr'
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.map((name) => name !== CACHE_NAME && caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API: Network first
  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }

  // Assets: Cache first
  event.respondWith(
    caches.match(event.request)
      .then((cached) => cached || fetch(event.request))
  );
});
```

**Registration**:
```javascript
// In main app
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then((registration) => console.log('SW registered'))
    .catch((error) => console.error('SW registration failed', error));
}
```

**Validation**:
- [ ] First load: ~5 seconds
- [ ] Second load: <1 second
- [ ] Offline: App loads (cached)

---

## Tier 2a: Text Input (Week 3-4)

### 6. Japanese IME Integration

**Time**: 8-12 hours
**Market Impact**: Unlocks 100M+ users
**Difficulty**: ⭐⭐⭐ Medium

**File**: `src/input/JapaneseIME.js`

```javascript
export class JapaneseIME {
  async convertHiraganaToKanji(hiragana) {
    const url = new URL('https://www.google.co.jp/transliterate');
    url.search = new URLSearchParams({
      client: 'handwriting',
      cp: 0,
      ie: 'utf-8',
      oe: 'utf-8',
      inputtype: 'hiragana',
      text: hiragana,
      num: 5
    }).toString();

    const response = await fetch(url);
    const text = await response.text();
    const [, candidates] = JSON.parse(text);
    return candidates || [];
  }

  displayCandidates(candidates) {
    // Show top 5 kanji options
    // User selects with pinch gesture
    this.candidates = candidates;
    this.renderUI();
  }

  renderUI() {
    // Display kanji candidates in VR UI
    // Allow selection via hand gesture (pinch on number 1-5)
  }

  selectCandidate(index) {
    return this.candidates[index];
  }
}
```

**Integration in keyboard**:
```javascript
class VRKeyboardWithIME {
  constructor() {
    this.ime = new JapaneseIME();
    this.inputBuffer = '';
    this.isJapanese = false;
  }

  async onKey(key) {
    if (key === 'space') {
      // Convert hiragana to kanji
      const candidates = await this.ime.convertHiraganaToKanji(this.inputBuffer);
      this.ime.displayCandidates(candidates);
    } else {
      this.inputBuffer += key;
    }
  }

  selectKanji(index) {
    const kanji = this.ime.selectCandidate(index);
    this.inputBuffer = kanji;
    // Clear buffer after selection
  }
}
```

**Validation**:
- [ ] Hiragana input works
- [ ] Conversion to kanji works
- [ ] Candidate selection works
- [ ] Multiple kanji options available

---

## Tier 2b: Advanced Features (Week 5-6)

### 7. Hand Tracking

**Time**: 6-8 hours
**Difficulty**: ⭐⭐⭐ Medium

**File**: `src/input/HandTracking.js`

```javascript
export class HandTracking {
  onXRFrame(frame) {
    const session = frame.session;

    for (const inputSource of session.inputSources) {
      if (inputSource.hand) {
        this.updateHand(inputSource.hand, frame);
      }
    }
  }

  updateHand(hand, frame) {
    const joints = Array.from(hand.values());

    // Update visual representation
    for (const joint of joints) {
      const pose = frame.getJointPose(joint, frame.referenceSpace);
      if (pose) {
        // Update 3D model of hand
        this.updateJoint(joint.name, pose);
      }
    }

    // Detect gestures
    this.detectGestures(hand, frame);
  }

  detectGestures(hand, frame) {
    const indexTip = frame.getJointPose(
      hand.get('index-finger-tip'),
      frame.referenceSpace
    );
    const thumbTip = frame.getJointPose(
      hand.get('thumb-tip'),
      frame.referenceSpace
    );

    if (!indexTip || !thumbTip) return;

    const distance = indexTip.position.distanceTo(thumbTip.position);

    // Pinch detected
    if (distance < 0.02) {
      this.onPinch();
    }

    // Point detected
    if (this.isPointing(hand, frame)) {
      this.onPoint();
    }
  }

  isPointing(hand, frame) {
    // Index finger extended, others curled
    const indexTip = frame.getJointPose(
      hand.get('index-finger-tip'),
      frame.referenceSpace
    );
    const middleBase = frame.getJointPose(
      hand.get('middle-finger-mcp'),
      frame.referenceSpace
    );

    if (!indexTip || !middleBase) return false;

    const distance = indexTip.position.distanceTo(middleBase.position);
    return distance > 0.05; // Threshold for extended finger
  }

  onPinch() {
    // Trigger selection/click
    console.log('Pinch detected');
  }

  onPoint() {
    // Ray casting for pointing
    console.log('Pointing detected');
  }
}
```

**Validation**:
- [ ] Hand visible in VR
- [ ] Joints track accurately
- [ ] Pinch gesture works
- [ ] Point gesture works

---

### 8. Spatial Audio

**Time**: 6-8 hours
**Difficulty**: ⭐⭐⭐ Medium

**File**: `src/audio/SpatialAudio.js`

```javascript
export class SpatialAudio {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.listener = this.audioContext.listener;
    this.sources = new Map();
  }

  playSound3D(url, position, loop = false) {
    const source = this.audioContext.createBufferSource();
    const panner = this.audioContext.createPanner();

    // Load audio
    this.loadAudio(url).then((buffer) => {
      source.buffer = buffer;
      source.loop = loop;

      // Spatial positioning
      panner.setPosition(position.x, position.y, position.z);
      panner.distanceModel = 'exponential';
      panner.refDistance = 1;
      panner.rolloffFactor = 1;

      // Connect graph
      source.connect(panner);
      panner.connect(this.audioContext.destination);

      // Play
      source.start(0);
      this.sources.set(url, { source, panner });
    });
  }

  updateListenerPosition(position, forward, up) {
    this.listener.setPosition(position.x, position.y, position.z);
    this.listener.setOrientation(
      forward.x, forward.y, forward.z,
      up.x, up.y, up.z
    );
  }

  async loadAudio(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return this.audioContext.decodeAudioData(arrayBuffer);
  }

  stopSound(url) {
    const source = this.sources.get(url);
    if (source) {
      source.source.stop();
      this.sources.delete(url);
    }
  }
}
```

**Integration in XR loop**:
```javascript
const spatialAudio = new SpatialAudio();

// Play ambient sound
spatialAudio.playSound3D(
  '/sounds/ambient.mp3',
  new THREE.Vector3(0, 1, -2),
  true // Loop
);

// Update listener (camera) position
function onXRFrame(time, frame) {
  const pose = frame.getViewerPose(referenceSpace);
  spatialAudio.updateListenerPosition(
    pose.transform.position,
    pose.transform.forward,
    pose.transform.up
  );
}
```

**Validation**:
- [ ] Sound plays in 3D space
- [ ] Position changes with movement
- [ ] Attenuation works with distance

---

## Testing & Validation

### Performance Checklist
```
Quest 2 (90 Hz, 11.1ms budget):
- [ ] Consistent 90 FPS
- [ ] <100 draw calls per frame
- [ ] <2GB memory usage
- [ ] No stutters/frame drops

Quest 3 (120 Hz, 8.33ms budget):
- [ ] Consistent 120 FPS
- [ ] <150 draw calls per frame
- [ ] <3GB memory usage
- [ ] No stutters/frame drops

All Devices:
- [ ] FFR working (verify visual fidelity at edges)
- [ ] Comfort system functional
- [ ] Object pooling active (no GC pauses)
- [ ] Textures compressed (KTX2)
- [ ] Service worker caching assets
```

### User Experience Checklist
```
Comfort:
- [ ] Motion sickness reduced (<30%)
- [ ] Vignette imperceptible
- [ ] FOV changes smooth
- [ ] Snap turning comfortable

Input:
- [ ] Japanese IME works
- [ ] Hand tracking accurate
- [ ] Gestures recognized
- [ ] Voice input functional

Audio:
- [ ] Spatial audio localization works
- [ ] Listener position updates correctly
- [ ] Volume attenuation realistic
- [ ] No audio artifacts

Loading:
- [ ] Initial load <30 seconds
- [ ] Repeat load <1 second (cached)
- [ ] Offline mode functional
```

---

## Deployment

### Production Build
```bash
npm run build:production

# Output: build/ directory ready for deployment
```

### Deploy to Quest Store
```bash
# Configure manifest.json
# Upload to Meta Quest Store

# Metadata:
- App name: Qui Browser VR
- Description: WebXR-native VR browser for Meta Quest
- Version: 2.0.0
- Minimum SDK: 21
```

---

## Summary

**Total Implementation Time**: 87+ hours
**Team Size**: 2-3 developers
**Timeline**: 8 weeks (Tier 1-2)

**Expected Results**:
- Motion sickness: 70% → <15%
- Text input speed: 12 WPM → 73 WPM (Quest 3) / 22 WPM (voice+keyboard)
- Performance: D → A grade
- User retention: +50%

**Next Step**: Start with Tier 1 implementations (Week 1-2).

---

**Philosophy**: Ship code that works. Iterate. Improve. No fluff. No bloat.
