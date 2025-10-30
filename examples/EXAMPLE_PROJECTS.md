# Qui Browser VR - Example Projects & Getting Started

**Purpose:** Provide ready-to-use example projects for learning and experimentation
**Status:** Available for v5.7.0+
**Difficulty Levels:** Beginner, Intermediate, Advanced

---

## Overview

This directory contains example projects demonstrating various Qui Browser VR capabilities:

1. **Hand Tracking Basic** - Simple hand position tracking
2. **Gesture Recognition** - Detect and respond to hand gestures
3. **Spatial Anchors Demo** - Create persistent 3D anchors
4. **Performance Monitoring** - Real-time performance metrics
5. **Custom Scene Builder** - Interactive 3D scene creation
6. **Game Example** - Simple gesture-controlled game
7. **Accessibility Demo** - Eye tracking & accessibility features

---

## Example 1: Hand Tracking Basic

**File:** `examples/01-hand-tracking-basic.html`
**Difficulty:** Beginner
**Time:** 5-10 minutes

### What You'll Learn
- How to initialize WebXR
- Access hand tracking data
- Render hands in VR

### Code Structure

```html
<!DOCTYPE html>
<html>
<head>
    <title>Qui Browser - Hand Tracking Basic</title>
    <script src="https://cdn.jsdelivr.net/npm/three@r152/build/three.min.js"></script>
    <script src="../assets/js/vr-launcher.js"></script>
</head>
<body>
    <div id="canvas-container"></div>
    <script>
        // Initialize WebXR session
        const launcher = new VRLauncher({
            requiredFeatures: ['hand-tracking'],
            optionalFeatures: ['hit-test']
        });

        launcher.on('session-start', async (session, frame) => {
            console.log('WebXR session started');
            console.log('Hand tracking available:',
                session.inputSources.length > 0);
        });

        launcher.on('hand-update', (hand) => {
            // hand = { left: joints, right: joints }
            // joints[i] = { position, orientation, radius }
            console.log('Left hand position:',
                hand.left[9].position); // Palm joint
        });

        launcher.start();
    </script>
</body>
</html>
```

### Try It
1. Open in Meta Quest Browser or Pico Browser
2. Allow hand tracking when prompted
3. Open browser console (Ctrl+Shift+K)
4. Move hands and see position data logged

### Next Steps
- Modify colors based on hand height
- Add visual feedback for hand movements
- Create hand animations

---

## Example 2: Gesture Recognition

**File:** `examples/02-gesture-recognition.html`
**Difficulty:** Intermediate
**Time:** 15-20 minutes

### What You'll Learn
- Initialize gesture recognition
- Detect specific gestures
- Respond to gesture events

### Code Structure

```html
<!DOCTYPE html>
<html>
<head>
    <title>Qui Browser - Gesture Recognition</title>
    <script src="https://cdn.jsdelivr.net/npm/three@r152/build/three.min.js"></script>
    <script src="../assets/js/vr-ml-gesture-recognition.js"></script>
    <script src="../assets/js/vr-launcher.js"></script>
</head>
<body>
    <div id="gesture-display">No gesture detected</div>
    <script>
        const launcher = new VRLauncher({
            requiredFeatures: ['hand-tracking']
        });

        const gestureEngine = new VRMLGestureRecognition({
            confidenceThreshold: 0.8
        });

        launcher.on('session-start', async (session) => {
            await gestureEngine.initialize(session);
            console.log('Gesture recognition initialized');

            // Available gestures
            const gestures = gestureEngine.getAvailableGestures();
            console.log('Available gestures:', gestures);
        });

        // Listen for recognized gestures
        gestureEngine.on('gesture', (event) => {
            const { gesture, hand, confidence } = event;

            console.log(`Gesture: ${gesture.name}`);
            console.log(`Hand: ${hand}`);
            console.log(`Confidence: ${confidence}`);

            // Update display
            document.getElementById('gesture-display').textContent =
                `${gesture.name} (${(confidence * 100).toFixed(0)}%)`;

            // Trigger action
            switch(gesture.name) {
                case 'thumbs-up':
                    onThumbsUp();
                    break;
                case 'peace':
                    onPeace();
                    break;
                case 'open-hand':
                    onOpenHand();
                    break;
            }
        });

        function onThumbsUp() {
            console.log('Thumbs up detected!');
            // Play sound, animation, etc.
        }

        function onPeace() {
            console.log('Peace sign detected!');
        }

        function onOpenHand() {
            console.log('Open hand detected!');
        }

        launcher.start();
    </script>
</body>
</html>
```

### Gesture Types Available

**Static Gestures (hand position-based):**
- Open hand
- Fist/closed hand
- Thumbs up
- Thumbs down
- Point (index)
- Peace sign

**Dynamic Gestures (motion-based):**
- Swipe (left, right, up, down)
- Grab (closing)
- Push
- Pinch

### Try It
1. Load in VR browser
2. Perform various gestures
3. Watch console and display update
4. Experiment with different gestures

### Extensions
- Add audio feedback for gestures
- Track gesture frequency
- Create gesture macros
- Log gesture statistics

---

## Example 3: Spatial Anchors

**File:** `examples/03-spatial-anchors.html`
**Difficulty:** Intermediate
**Time:** 20-25 minutes

### What You'll Learn
- Create persistent 3D anchors
- Save/load anchor positions
- Track anchor updates

### Code Structure

```html
<!DOCTYPE html>
<html>
<head>
    <title>Qui Browser - Spatial Anchors</title>
    <script src="https://cdn.jsdelivr.net/npm/three@r152/build/three.min.js"></script>
    <script src="../assets/js/vr-spatial-anchors-system.js"></script>
</head>
<body>
    <div id="anchor-list"></div>
    <script>
        const anchors = new VRSpatialAnchorsSystem();

        // Wait for WebXR session
        navigator.xr.requestSession('immersive-vr', {
            requiredFeatures: ['hit-test', 'dom-overlay'],
            domOverlay: { root: document.body }
        }).then(async (session) => {
            await anchors.initialize(session);

            // Create anchor at origin
            const anchor1 = await anchors.createAnchor(
                new THREE.Vector3(0, 0, 0),
                'bookmark-1'
            );
            console.log('Anchor created:', anchor1.id);

            // List all anchors
            const allAnchors = anchors.getPersistentAnchors();
            console.log('Persistent anchors:', allAnchors);

            // Save to localStorage
            anchors.savePersistentAnchors();

            // Update anchor
            await anchors.updateAnchor(anchor1.id,
                new THREE.Vector3(1, 1, 1));

            // Track anchor updates
            anchors.on('anchor-updated', (anchor) => {
                console.log('Anchor updated:', anchor.id);
                updateAnchorDisplay();
            });
        });

        function updateAnchorDisplay() {
            const list = document.getElementById('anchor-list');
            const allAnchors = anchors.getPersistentAnchors();

            list.innerHTML = '<h3>Anchors:</h3>';
            allAnchors.forEach((anchor, idx) => {
                const item = document.createElement('div');
                item.textContent = `${idx + 1}. ${anchor.id} - ` +
                    `(${anchor.position.x.toFixed(2)}, ` +
                    `${anchor.position.y.toFixed(2)}, ` +
                    `${anchor.position.z.toFixed(2)})`;
                list.appendChild(item);
            });
        }
    </script>
</body>
</html>
```

### Features
- Create up to 8 persistent anchors per session
- Save anchors to device storage
- Restore anchors across sessions
- Query anchor positions
- Delete anchors

### Try It
1. Create anchors by interacting in VR
2. Note their positions
3. Exit VR
4. Re-enter and see anchors restored

---

## Example 4: Performance Monitoring

**File:** `examples/04-performance-monitoring.html`
**Difficulty:** Intermediate
**Time:** 15-20 minutes

### What You'll Learn
- Initialize performance monitor
- Track real-time metrics
- Create performance dashboard

### Code Structure

```html
<!DOCTYPE html>
<html>
<head>
    <title>Qui Browser - Performance Monitoring</title>
    <script src="../assets/js/vr-performance-monitor.js"></script>
    <style>
        #metrics-panel {
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            color: #0f0;
            font-family: monospace;
            padding: 10px;
            border: 2px solid #0f0;
            width: 300px;
        }
    </style>
</head>
<body>
    <div id="metrics-panel">
        <h3>Performance Metrics</h3>
        <div id="fps">FPS: --</div>
        <div id="frame-time">Frame Time: --</div>
        <div id="memory">Memory: --</div>
        <div id="grade">Grade: --</div>
    </div>

    <script>
        const monitor = new VRPerformanceMonitor();

        // Initialize
        monitor.initialize();
        console.log('Performance monitor started');

        // Record sample every frame
        function recordFrame() {
            monitor.recordSample({
                fps: performance.now(),
                frameTime: 1000 / 60, // 60 FPS
                memoryUsage: performance.memory?.usedJSHeapSize || 0
            });

            // Update display
            updateMetrics();

            requestAnimationFrame(recordFrame);
        }

        function updateMetrics() {
            const metrics = monitor.getMetrics();

            document.getElementById('fps').textContent =
                `FPS: ${metrics.fps.toFixed(1)}`;
            document.getElementById('frame-time').textContent =
                `Frame Time: ${metrics.frameTime.toFixed(1)}ms`;
            document.getElementById('memory').textContent =
                `Memory: ${(metrics.memory / 1024 / 1024).toFixed(0)}MB`;
            document.getElementById('grade').textContent =
                `Grade: ${monitor.getPerformanceGrade()}`;
        }

        recordFrame();

        // Alert if performance degrades
        monitor.on('performance-warning', (event) => {
            console.warn('Performance warning:', event.message);
        });

        monitor.on('performance-critical', (event) => {
            console.error('Critical performance issue:', event.message);
        });
    </script>
</body>
</html>
```

### Metrics Tracked
- Average FPS
- Frame time (ms)
- Memory usage (MB)
- GPU usage (if available)
- Battery impact
- Thermal state

### Dashboard Features
- Live graph of FPS over time
- Memory usage trend
- Performance grade (A+ to D)
- Alert system
- Export metrics

---

## Example 5: Custom Scene Builder

**File:** `examples/05-scene-builder.html`
**Difficulty:** Advanced
**Time:** 30-45 minutes

### What You'll Learn
- Create 3D objects dynamically
- Interact with objects via gestures
- Build persistent scenes
- Use performance optimization

### Code Structure

```javascript
// Scene builder with gesture control
class VRSceneBuilder {
    constructor() {
        this.objects = [];
        this.selectedObject = null;
    }

    addBox(position, size) {
        const geometry = new THREE.BoxGeometry(...size);
        const material = new THREE.MeshPhongMaterial({
            color: Math.random() * 0xffffff
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);

        this.objects.push({
            mesh: mesh,
            type: 'box',
            position: position,
            size: size
        });

        return mesh;
    }

    addSphere(position, radius) {
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: Math.random() * 0xffffff
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);

        this.objects.push({
            mesh: mesh,
            type: 'sphere',
            position: position,
            radius: radius
        });

        return mesh;
    }

    deleteSelected() {
        if (this.selectedObject) {
            const idx = this.objects.indexOf(this.selectedObject);
            this.objects.splice(idx, 1);
            this.selectedObject = null;
        }
    }

    moveSelected(direction) {
        if (this.selectedObject) {
            this.selectedObject.position.add(direction);
        }
    }

    saveScene() {
        const data = this.objects.map(obj => ({
            type: obj.type,
            position: obj.position.toArray(),
            size: obj.size || obj.radius,
            color: obj.mesh.material.color.getHex()
        }));

        localStorage.setItem('scene-data', JSON.stringify(data));
        console.log('Scene saved');
    }

    loadScene() {
        const data = JSON.parse(
            localStorage.getItem('scene-data') || '[]'
        );

        data.forEach(objData => {
            const pos = new THREE.Vector3(...objData.position);
            if (objData.type === 'box') {
                this.addBox(pos, [objData.size, objData.size, objData.size]);
            } else if (objData.type === 'sphere') {
                this.addSphere(pos, objData.size);
            }
        });

        console.log('Scene loaded');
    }
}

// Usage
const builder = new VRSceneBuilder();

// Respond to gestures
gestureEngine.on('gesture', (event) => {
    switch(event.gesture.name) {
        case 'open-hand':
            builder.addBox(
                new THREE.Vector3(0, 0, -1),
                [0.1, 0.1, 0.1]
            );
            break;
        case 'fist':
            builder.addSphere(
                new THREE.Vector3(0, 0, -1),
                0.05
            );
            break;
        case 'peace':
            builder.deleteSelected();
            break;
    }
});

// Save scene periodically
setInterval(() => builder.saveScene(), 10000);
```

---

## Example 6: Simple Game

**File:** `examples/06-gesture-game.html`
**Difficulty:** Advanced
**Time:** 45-60 minutes

### What You'll Learn
- Create game mechanics
- Detect and track gestures
- Implement scoring system
- Create game UI

### Game Concept
"Gesture Master" - Match displayed gestures as quickly as possible

### Features
- Random gesture display
- Timer for each gesture
- Score tracking
- Difficulty levels
- Sound effects

---

## Example 7: Accessibility Features

**File:** `examples/07-accessibility.html`
**Difficulty:** Intermediate
**Time:** 20-30 minutes

### What You'll Learn
- Implement eye tracking
- Add text scaling
- Create high contrast mode
- Support keyboard/controller fallback

### Features Demonstrated
- Eye gaze tracking for menu control
- Text size adjustment
- Color blind friendly palette
- Hand tracking optional (not required)
- Full keyboard navigation

---

## Running Examples

### Setup

```bash
# Navigate to project
cd qui-browser-vr

# Start local server
npx http-server -p 8080

# Or use Python
python -m http.server 8080

# Or use Node with Express
node -e "require('express')().use(require('express').static('.')).listen(8080)"
```

### Access in VR

**Meta Quest:**
1. Open Chromium browser
2. Navigate to: `http://<your-ip>:8080/examples/01-hand-tracking-basic.html`
3. Click "Enter VR" or allow VR mode
4. Follow on-screen instructions

**Pico:**
1. Open Pico Browser
2. Navigate to example URL
3. Allow required permissions
4. Interact with hands

---

## Example Project Structure

```
examples/
├── 01-hand-tracking-basic.html
├── 02-gesture-recognition.html
├── 03-spatial-anchors.html
├── 04-performance-monitoring.html
├── 05-scene-builder.html
├── 06-gesture-game.html
├── 07-accessibility.html
├── common/
│   ├── three-setup.js       # Three.js initialization
│   ├── xr-setup.js          # WebXR setup
│   └── ui-helpers.js        # Common UI utilities
└── assets/
    ├── models/              # 3D models
    ├── textures/            # Textures
    └── sounds/              # Audio files
```

---

## Common Patterns

### Pattern 1: Initialize with Error Handling

```javascript
async function initializeVR() {
    try {
        const session = await navigator.xr.requestSession('immersive-vr', {
            requiredFeatures: ['hand-tracking'],
            optionalFeatures: ['hit-test']
        });
        console.log('VR session started');
    } catch (err) {
        console.error('VR initialization failed:', err.message);
        showFallbackUI();
    }
}
```

### Pattern 2: Gesture Event Handler

```javascript
gestureEngine.on('gesture', (event) => {
    const { gesture, hand, confidence } = event;

    if (confidence < 0.8) {
        console.log('Low confidence gesture, ignoring');
        return;
    }

    handleGesture(gesture.name, hand);
});
```

### Pattern 3: Performance Monitoring Loop

```javascript
let frameCount = 0;
const startTime = performance.now();

function updateLoop() {
    frameCount++;

    if (frameCount % 60 === 0) {
        const elapsed = performance.now() - startTime;
        const fps = (frameCount / elapsed) * 1000;
        console.log(`Current FPS: ${fps.toFixed(1)}`);
    }

    requestAnimationFrame(updateLoop);
}
```

---

## Troubleshooting Examples

### Hand Tracking Not Working

```javascript
// Check if hand tracking is supported
navigator.xr.isSessionSupported('immersive-vr').then(supported => {
    if (!supported) {
        console.error('VR not supported');
        return;
    }

    // Check specific features
    const requiredFeatures = ['hand-tracking'];
    // ... create session
});
```

### Gesture Recognition Low Accuracy

```javascript
// Adjust confidence threshold
const gestureEngine = new VRMLGestureRecognition({
    confidenceThreshold: 0.6  // Lower = more sensitive but less accurate
});

// Recalibrate by recording custom gesture
await gestureEngine.recordCustomGesture('my-gesture', {
    samples: 100,              // More samples = better accuracy
    timeout: 60000             // 60 second recording window
});
```

### Performance Issues

```javascript
// Enable performance monitoring
const monitor = new VRPerformanceMonitor();
monitor.initialize();

monitor.on('performance-warning', (event) => {
    // Reduce quality when FPS drops
    if (event.fps < 72) {
        reduceFidelity();
    }
});
```

---

## Next Steps

1. **Choose an example** based on your interest level
2. **Run it locally** following the setup instructions
3. **Test in VR** on your device
4. **Modify and experiment** with the code
5. **Share your creation** in the Showcase discussion!
6. **Ask questions** in Q&A if you get stuck

---

## Additional Resources

- [Full API Documentation](../API_DOCUMENTATION.md)
- [Performance Optimization Guide](../PERFORMANCE_OPTIMIZATION_REPORT.md)
- [Troubleshooting Guide](../TESTING.md)
- [Architecture Guide](../ARCHITECTURE.md)
- [Community Discussions](https://github.com/your-repo/discussions)

---

## Support

Have questions about examples?
- Check the [Community Discussions Q&A](https://github.com/your-repo/discussions)
- Post on [Stack Overflow](https://stackoverflow.com) with tag `qui-browser-vr`
- Create an [Issue](https://github.com/your-repo/issues) if you find a bug

---

**Happy coding! 🚀**

🤖 *Generated with [Claude Code](https://claude.com/claude-code)*
