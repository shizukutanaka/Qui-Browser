# Qui Browser VR - Quick Start Guide

**Get started with Qui Browser VR in 5 minutes! 🚀**

Version: 4.9.0
Last Updated: 2025-10-25

---

## Table of Contents

1. [Installation](#installation)
2. [Basic Setup](#basic-setup)
3. [Quick Start (Easiest)](#quick-start-easiest)
4. [Advanced Setup](#advanced-setup)
5. [Configuration Presets](#configuration-presets)
6. [Common Use Cases](#common-use-cases)
7. [Troubleshooting](#troubleshooting)
8. [Next Steps](#next-steps)

---

## Installation

### Option 1: CDN (Recommended for Quick Start)

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>My VR Browser</title>
</head>
<body>
  <!-- Include Qui VR SDK -->
  <script src="https://cdn.jsdelivr.net/gh/your-repo/qui-browser-vr@4.9.0/assets/js/qui-vr-sdk.js"></script>

  <script>
    // Your VR app code here
  </script>
</body>
</html>
```

### Option 2: NPM (For Build Tools)

```bash
npm install qui-browser-vr
```

```javascript
import QuiVRSDK from 'qui-browser-vr';
```

### Option 3: Local Development

```bash
git clone https://github.com/your-repo/qui-browser-vr.git
cd qui-browser-vr
npm install
npm start
```

---

## Basic Setup

### Minimum Requirements

- **Browser:** Chrome 113+ / Meta Quest Browser 40.4+ / Edge 113+
- **Device:** Meta Quest 2/3/Pro, Pico 4, or any WebXR-compatible headset
- **Connection:** HTTPS (required for WebXR)

### HTML Template

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Qui VR Browser</title>
  <style>
    body {
      margin: 0;
      overflow: hidden;
      font-family: 'Segoe UI', sans-serif;
    }
    #vr-button {
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 15px 30px;
      font-size: 18px;
      background: #2196F3;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <button id="vr-button">Enter VR</button>

  <!-- Qui VR SDK -->
  <script src="assets/js/qui-vr-sdk.js"></script>

  <script>
    // Your code here (see examples below)
  </script>
</body>
</html>
```

---

## Quick Start (Easiest)

### 1-Line Setup

The absolute fastest way to get started:

```javascript
// This is all you need!
const vr = await QuiVRSDK.quickStart('balanced');

// Enter VR when button clicked
document.getElementById('vr-button').addEventListener('click', async () => {
  await vr.enterVR();
});
```

**That's it!** This gives you:
- ✅ 90 FPS target
- ✅ WebGPU rendering (if available)
- ✅ SIMD acceleration
- ✅ Hand tracking
- ✅ Depth sensing
- ✅ Battery optimization
- ✅ All features enabled

---

## Advanced Setup

### Custom Configuration

For more control, use the standard initialization:

```javascript
// Create SDK instance with options
const vr = new QuiVRSDK({
  preset: 'performance',     // 'performance', 'quality', 'balanced', 'battery'
  targetFPS: 120,            // Target framerate
  enableWebGPU: true,        // Enable WebGPU renderer
  enableSIMD: true,          // Enable WebAssembly SIMD
  enableMultiThreading: true,// Enable multi-threading
  enableDepthSensing: true,  // Enable depth sensing
  enableHandTracking: true,  // Enable hand tracking
  enableFoveatedRendering: true, // Enable foveated rendering
  pricing: 'free',           // 'free', 'premium', 'business'
  language: 'ja',            // 'ja', 'en'
  theme: 'space',            // 'space', 'ocean', 'forest', etc.
  debug: true                // Enable debug logging
});

// Initialize
await vr.initialize();

// Enter VR
document.getElementById('vr-button').addEventListener('click', async () => {
  try {
    const session = await vr.enterVR();
    console.log('VR session started:', session);
  } catch (error) {
    console.error('Failed to enter VR:', error);
  }
});
```

---

## Configuration Presets

The SDK includes 4 optimized presets:

### 1. Performance Mode

**Best for:** Gaming, fast interactions, high-end headsets (Quest 3, Pico 4)

```javascript
const vr = await QuiVRSDK.quickStart('performance');
```

**Specs:**
- 🎯 Target: 120 FPS
- 🚀 WebGPU: Enabled
- ⚡ SIMD: Enabled
- 🧵 Multi-threading: Enabled
- 🎨 Quality: Medium
- 💡 Foveated Rendering: Enabled

### 2. Quality Mode

**Best for:** Media viewing, high-quality visuals

```javascript
const vr = await QuiVRSDK.quickStart('quality');
```

**Specs:**
- 🎯 Target: 90 FPS
- 🚀 WebGPU: Enabled
- ⚡ SIMD: Enabled
- 🎨 Quality: Ultra
- 📺 Video: 8K@30fps

### 3. Balanced Mode (Default)

**Best for:** General use, recommended for most users

```javascript
const vr = await QuiVRSDK.quickStart('balanced');
// or simply:
const vr = await QuiVRSDK.quickStart();
```

**Specs:**
- 🎯 Target: 90 FPS
- 🚀 WebGPU: Enabled
- ⚡ SIMD: Enabled
- 🎨 Quality: High
- 🔋 Battery: Normal

### 4. Battery Mode

**Best for:** Extended sessions, Quest 2, low battery situations

```javascript
const vr = await QuiVRSDK.quickStart('battery');
```

**Specs:**
- 🎯 Target: 72 FPS
- 🚀 WebGPU: Disabled (WebGL fallback)
- 🎨 Quality: Low
- 🔋 Battery: Optimized (+50% battery life)

---

## Common Use Cases

### Example 1: Simple VR Browser

```javascript
const vr = await QuiVRSDK.quickStart('balanced');

// Listen to VR events
vr.on('initialized', (event) => {
  console.log('VR initialized:', event.detail);
  console.log('Features:', event.detail.features);
});

vr.on('vr-started', (event) => {
  console.log('Entered VR mode');
});

vr.on('vr-ended', () => {
  console.log('Exited VR mode');
});

vr.on('error', (event) => {
  console.error('VR error:', event.detail.error);
});

// Enter VR button
document.getElementById('vr-button').addEventListener('click', async () => {
  await vr.enterVR();
});
```

### Example 2: Performance Monitoring

```javascript
const vr = await QuiVRSDK.quickStart('performance');

// Get real-time metrics
setInterval(() => {
  const metrics = vr.getMetrics();
  console.log('FPS:', metrics.fps);
  console.log('Frame Time:', metrics.frameTime, 'ms');
  console.log('Memory:', metrics.memoryUsage, 'MB');
  console.log('Battery:', metrics.batteryLevel, '%');
}, 1000);

// Get system info
const info = vr.getSystemInfo();
console.log('Version:', info.version);
console.log('Renderer:', info.renderer); // 'WebGPU' or 'WebGL'
console.log('SIMD Support:', info.performance.simd);
console.log('Multi-threading:', info.performance.multiThreading);
```

### Example 3: Premium Features (¥200/月)

```javascript
const vr = new QuiVRSDK({
  preset: 'quality',
  pricing: 'premium' // Unlock premium features
});

await vr.initialize();

// Premium features now available:
// - Advanced hand gestures (15+ gestures)
// - Text input (Swype keyboard)
// - 8K@30fps video
// - ETFR (Eye-tracked foveated rendering)
// - AI recommendations
```

### Example 4: Error Handling

```javascript
const vr = new QuiVRSDK({
  preset: 'balanced',
  debug: true
});

try {
  const initialized = await vr.initialize();

  if (!initialized) {
    throw new Error('SDK initialization failed');
  }

  // Check feature support
  const info = vr.getSystemInfo();

  if (!info.features.webxr) {
    alert('WebXR not supported in this browser');
    return;
  }

  if (!info.features.webgpu) {
    console.warn('WebGPU not available, using WebGL fallback');
  }

  // Enter VR
  document.getElementById('vr-button').addEventListener('click', async () => {
    try {
      await vr.enterVR();
    } catch (error) {
      if (error.name === 'NotSupportedError') {
        alert('VR headset not connected');
      } else if (error.name === 'NotAllowedError') {
        alert('VR access denied');
      } else {
        alert('Failed to enter VR: ' + error.message);
      }
    }
  });

} catch (error) {
  console.error('Setup failed:', error);
}
```

### Example 5: Battery Optimization

```javascript
const vr = new QuiVRSDK({
  preset: 'balanced',
  enableBatteryOptimization: true
});

await vr.initialize();

// SDK will automatically:
// - Switch to 72 FPS when battery < 20%
// - Enable power save mode when battery < 10%
// - Adjust quality settings dynamically
// - Monitor charging state

vr.on('battery-low', (event) => {
  console.log('Battery low:', event.detail.level, '%');
  console.log('Switched to power save mode');
});
```

---

## Troubleshooting

### VR Button Not Working

**Problem:** Button click doesn't enter VR

**Solution:**
```javascript
// Check if WebXR is supported
if (!navigator.xr) {
  console.error('WebXR not supported');
  alert('Please use a WebXR-compatible browser (Chrome 113+)');
}

// Check if page is HTTPS
if (location.protocol !== 'https:') {
  console.error('WebXR requires HTTPS');
  alert('Please access this page via HTTPS');
}
```

### Performance Issues

**Problem:** Low FPS, stuttering

**Solutions:**

1. **Use Performance Preset:**
```javascript
const vr = await QuiVRSDK.quickStart('performance');
```

2. **Enable WebGPU:**
```javascript
const vr = new QuiVRSDK({
  enableWebGPU: true,
  enableSIMD: true,
  enableMultiThreading: true,
  enableFoveatedRendering: true
});
```

3. **Check System Capabilities:**
```javascript
const info = vr.getSystemInfo();
console.log('WebGPU:', info.features.webgpu);
console.log('SIMD:', info.features.simd);
console.log('Multi-threading:', info.features.sharedArrayBuffer);
```

### WebGPU Not Available

**Problem:** WebGPU renderer not working

**Solution:**
```javascript
// Enable Chrome flags (chrome://flags):
// - #enable-unsafe-webgpu
// - #enable-webgpu-developer-features

// Or use WebGL fallback (automatic):
const vr = new QuiVRSDK({
  enableWebGPU: false // Force WebGL
});
```

### Hand Tracking Not Working

**Problem:** Hand tracking not detected

**Solution:**
```javascript
// Check if hand tracking is available
const session = await vr.enterVR();
if (session.enabledFeatures.includes('hand-tracking')) {
  console.log('Hand tracking enabled');
} else {
  console.warn('Hand tracking not available');
  console.warn('Check headset settings and browser permissions');
}
```

### Memory Leaks

**Problem:** Memory usage increasing over time

**Solution:**
```javascript
// Always dispose SDK when done
window.addEventListener('beforeunload', async () => {
  await vr.dispose();
});

// Or manually:
await vr.exitVR();
await vr.dispose();
```

---

## Next Steps

### 1. Explore Advanced Features

- **Depth Sensing:** [docs/DEPTH_SENSING.md](DEPTH_SENSING.md)
- **Hand Tracking:** [docs/HAND_TRACKING.md](HAND_TRACKING.md)
- **WebGPU Rendering:** [docs/WEBGPU.md](WEBGPU.md)
- **Performance Optimization:** [docs/PERFORMANCE.md](PERFORMANCE.md)

### 2. Premium Subscription (¥200/月)

Unlock advanced features:
- 15+ hand gestures
- Swype text input
- 8K@30fps video
- Eye-tracked foveated rendering
- AI recommendations

```javascript
const vr = new QuiVRSDK({
  pricing: 'premium'
});
```

### 3. Build Custom Modules

Extend the SDK with your own modules:

```javascript
// Your custom module
class MyVRFeature {
  constructor(sdk) {
    this.sdk = sdk;
  }

  async initialize() {
    // Your initialization code
  }
}

// Register with SDK
vr.registerPlugin('myFeature', MyVRFeature);
```

### 4. Join the Community

- **GitHub:** [github.com/your-repo/qui-browser-vr](https://github.com)
- **Discord:** [discord.gg/qui-vr](https://discord.gg)
- **Documentation:** [docs.qui-browser.dev](https://docs.qui-browser.dev)
- **Support:** support@qui-browser.example.com

---

## API Reference

### QuiVRSDK Class

#### Constructor

```javascript
new QuiVRSDK(options)
```

**Options:**
- `preset` (string): 'performance', 'quality', 'balanced', 'battery'
- `targetFPS` (number): Target framerate (72, 90, 120)
- `enableWebGPU` (boolean): Enable WebGPU renderer
- `enableSIMD` (boolean): Enable WebAssembly SIMD
- `enableMultiThreading` (boolean): Enable worker threads
- `enableDepthSensing` (boolean): Enable depth sensing
- `enableHandTracking` (boolean): Enable hand tracking
- `enableFoveatedRendering` (boolean): Enable foveated rendering
- `enableBatteryOptimization` (boolean): Enable battery optimization
- `pricing` (string): 'free', 'premium', 'business'
- `language` (string): 'ja', 'en'
- `theme` (string): Environment theme
- `debug` (boolean): Enable debug logging

#### Methods

**`async initialize()`**
Initialize the SDK.

**`async enterVR()`**
Enter VR mode. Returns XRSession.

**`async exitVR()`**
Exit VR mode.

**`getMetrics()`**
Get performance metrics (FPS, frame time, memory, battery).

**`getSystemInfo()`**
Get system information (version, features, renderer).

**`on(event, callback)`**
Listen to events.

**`off(event, callback)`**
Remove event listener.

**`async dispose()`**
Cleanup and dispose SDK.

#### Events

- `initialized` - SDK initialized
- `vr-started` - VR session started
- `vr-ended` - VR session ended
- `error` - Error occurred
- `battery-low` - Battery level low (<20%)
- `disposed` - SDK disposed

#### Static Methods

**`QuiVRSDK.quickStart(preset)`**
Quick start helper. Returns initialized SDK instance.

**`QuiVRSDK.version`**
SDK version string.

**`QuiVRSDK.features`**
Array of feature descriptions.

---

## License

MIT License - See [LICENSE](../LICENSE) file for details.

---

## Support

- **Email:** support@qui-browser.example.com
- **Security:** security@qui-browser.example.com
- **GitHub Issues:** [github.com/your-repo/qui-browser-vr/issues](https://github.com)

---

**Happy VR Browsing! 🥽✨**
