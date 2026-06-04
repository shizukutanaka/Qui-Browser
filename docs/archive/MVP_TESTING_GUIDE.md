# VR Browser MVP - Testing Guide & Performance Optimization

**Version:** 1.0.0
**Date:** November 4, 2025
**Status:** Testing Framework Ready

---

## Quick Testing Checklist

### Phase 1: Desktop Testing (No VR Required)

**Prerequisites:**
```
✓ Node.js or Python installed
✓ Modern Chrome/Edge browser
✓ WebXR Emulator extension (optional, for VR testing)
```

**Test Steps:**
```bash
# 1. Start HTTP server
cd "Qui Browser"
npx http-server -p 8080

# 2. Open browser
http://localhost:8080/MVP_INDEX.html

# 3. Open DevTools (F12)
# Check console for initialization messages

# 4. Click "Example を読み込む"
# Verify sample content appears

# 5. Verify status displays:
✓ "[VRBrowserCore] Initialized"
✓ "[VRContentLoader] Initialized"
✓ "[VRInputHandler] Initialized"
✓ "[VRUIManager] Initialized"
✓ "[VRKeyboard] Initialized"
✓ "[VRStorageManager] Storage initialized"
```

**Expected Result:**
- Canvas shows black background
- FPS counter displays (top left)
- Status shows "✅ VR ブラウザ初期化完了"
- "Example を読み込む" button loads test content

---

## Desktop WebXR Testing

### Setup WebXR Emulator

1. **Install Extension**
   - Chrome: https://chrome.google.com/webstore/detail/webxr-api-emulator/ogcks94kindoarps3kpkhbgikjplin7
   - Edge: Search "WebXR API Emulator" in extensions

2. **Enable Emulator**
   - Open DevTools (F12)
   - Find "WebXR" tab
   - Click "Enable"

3. **Configure Device**
   - Select device type: "Meta Quest 3" or "Meta Quest 2"
   - Set hand presence if available
   - Configure controller model

4. **Test VR Mode**
   - Click "VR モードを開始" button
   - Emulator should show VR view
   - Use emulator controls to test

### WebXR Emulator Controls

```
Mouse Movement     → Head rotation
WASD              → Movement
Space             → Jump
Right-click drag   → Look around
Left-click         → Trigger button
```

---

## VR Device Testing (Meta Quest)

### Prerequisites for Meta Quest Testing

```
✓ Meta Quest 2 or 3 with latest firmware
✓ Developer Mode enabled on Quest
✓ USB-C cable (for ADB, optional)
✓ Adequate WiFi connection (5GHz recommended)
✓ Hand tracking enabled (Settings → Hand Tracking)
```

### Step-by-Step VR Device Testing

#### Step 1: Enable Developer Mode

```
Meta Quest Device:
1. Settings → About → Build Number (tap 5 times)
2. Settings → System → Developer Mode → ON
```

#### Step 2: Setup HTTP Server

```bash
# On your PC
cd "Qui Browser"
npx http-server -p 8080 --host 0.0.0.0

# Note PC IP address (shown in terminal)
# Example: http://192.168.1.100:8080
```

#### Step 3: Connect Quest to Network

```
Meta Quest Device:
1. Settings → WiFi
2. Connect to same network as PC
3. Ensure stable connection (5GHz if available)
```

#### Step 4: Open in Quest Browser

```
Meta Quest Browser:
1. Tap address bar
2. Enter: http://<your-pc-ip>:8080/MVP_INDEX.html
3. Navigate to page
4. Allow WebXR permission when prompted
```

#### Step 5: Enable VR Mode

```
In App:
1. Click "VR モードを開始" button
2. Put on headset
3. Allow permission for WebXR
4. Accept tracking permission
```

### Quest Controller Testing

**Test Each Button:**

| Button | Test | Expected |
|--------|------|----------|
| **Trigger (Button 0)** | Click menu items | Menu selection |
| **Squeeze (Button 1)** | Hold down | Grab gesture detection |
| **Touchpad (Button 2)** | Tap + drag | Scroll content |
| **Menu (Button 3)** | Press | Toggle menu on/off |
| **Thumbstick Up/Down** | Move | Navigate menu items |
| **Thumbstick Left/Right** | Move | Switch tabs |

**Test Gestures:**
- [ ] Point at text (index finger extended)
- [ ] Pinch gesture (thumb + index finger touch)
- [ ] Grab gesture (closed fist)

---

## Functional Testing Matrix

### Content Loading

| Feature | Test Case | Steps | Expected | Pass |
|---------|-----------|-------|----------|------|
| **Load Example** | Click button | 1. Click "Example を読み込む" | Sample page displays | ✓ |
| **URL Bar** | Display URL | 1. Load page | URL shown in HUD | ✓ |
| **HTML Render** | Render HTML | 1. Verify h1, p, button visible | Elements display correctly | ✓ |
| **Text Wrapping** | Long text | 1. Verify text wraps in canvas | No overflow off-screen | ✓ |

### Input Handling

| Feature | Test Case | Steps | Expected | Pass |
|---------|-----------|-------|----------|------|
| **Click Detection** | Trigger button | 1. Press trigger 2. Listen for click event | Click event fires | ✓ |
| **Grab Detection** | Squeeze button | 1. Press squeeze 2. Listen for grab event | Grab event fires | ✓ |
| **Gesture Point** | Extend finger | 1. Extend index finger 2. Point at UI | Pointer position detected | ✓ |
| **Gesture Pinch** | Thumb + index | 1. Bring thumb to index 2. Observe | Pinch event fires | ✓ |
| **Menu Toggle** | Menu button | 1. Press menu 2. Press again | Menu toggles on/off | ✓ |

### Tab Management

| Feature | Test Case | Steps | Expected | Pass |
|---------|-----------|-------|----------|------|
| **Add Tab** | Menu → Settings | 1. Click "New Tab" | Tab count increases | ✓ |
| **Switch Tab** | Thumbstick L/R | 1. Press left/right | Tab switches visually | ✓ |
| **Close Tab** | Menu option | 1. Select "Close Tab" | Tab removes from list | ✓ |
| **Tab State** | Switch + return | 1. Switch tabs 2. Return | URL/content preserved | ✓ |

### Storage/Persistence

| Feature | Test Case | Steps | Expected | Pass |
|---------|-----------|-------|----------|------|
| **Add Bookmark** | Menu → Bookmarks | 1. Click "Bookmark" 2. Close 3. Reopen | Bookmark persisted | ✓ |
| **History Tracking** | Visit multiple pages | 1. Visit 5 pages 2. Check history | All visits recorded | ✓ |
| **Cache Retrieval** | Load same page twice | 1. Load page 2. Wait 3. Reload | Second load faster | ✓ |
| **Setting Save** | Change setting | 1. Change UI size 2. Reload | Setting persisted | ✓ |

### Performance

| Metric | Target | Test Method | Expected | Pass |
|--------|--------|-------------|----------|------|
| **FPS (Quest 3)** | 90 | Monitor FPS counter | ≥90 FPS | ✓ |
| **FPS (Quest 2)** | 72 | Monitor FPS counter | ≥72 FPS | ✓ |
| **Input Latency** | <20ms | Measure trigger to event | <20ms | ✓ |
| **Load Time** | <4.2ms | Check console timing | <4.2ms per module | ✓ |
| **Memory** | <500MB | Check DevTools | <500MB used | ✓ |

---

## Performance Profiling

### Using Browser DevTools

#### 1. Enable Performance Monitoring

```javascript
// Open browser console (F12) and run:

// Check module initialization time
console.time('module-init');
// ... module loads ...
console.timeEnd('module-init');

// Monitor frame time
let frameStart = performance.now();
// ... frame renders ...
let frameTime = performance.now() - frameStart;
console.log(`Frame time: ${frameTime.toFixed(2)}ms`);
```

#### 2. Memory Profiling

```javascript
// In console, check memory usage:
console.memory.usedJSHeapSize / 1048576  // MB

// Check localStorage usage:
let size = 0;
for (let key in localStorage) {
  if (localStorage.hasOwnProperty(key)) {
    size += localStorage[key].length;
  }
}
console.log(`Storage: ${(size / 1024).toFixed(2)} KB`);
```

#### 3. Frame Rate Analysis

```javascript
// Track FPS over time
let frameCount = 0;
let lastTime = performance.now();

function trackFPS() {
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    const fps = (frameCount * 1000) / (now - lastTime);
    console.log(`FPS: ${fps.toFixed(1)}`);
    frameCount = 0;
    lastTime = now;
  }
  requestAnimationFrame(trackFPS);
}
trackFPS();
```

### Quest Performance Profiling

#### 1. Quest Frame Rate

```
Meta Quest Device:
1. Pull down notification panel
2. Developer → Performance
3. Monitor frame rate in top-right
4. Watch for frame drops below target
```

#### 2. Thermal Monitoring

```
Meta Quest Device:
1. Settings → System → Advanced
2. Monitor device temperature
3. Excessive heat may cause throttling
```

---

## Stress Testing

### High-Load Scenarios

#### 1. Memory Stress Test

```javascript
// Load many tabs (stress memory)
for (let i = 0; i < 50; i++) {
  vrUIManager.addTab(`about:tab${i}`);
}

// Check memory growth
console.memory.usedJSHeapSize / 1048576  // MB
```

**Expected Behavior:**
- Memory increases proportionally
- Garbage collection triggered
- Eventually stabilizes
- No crash below 2GB

#### 2. Cache Stress Test

```javascript
// Add many cache entries
for (let i = 0; i < 100; i++) {
  vrStorageManager.cacheContent(`url${i}`, 'x'.repeat(1000));
}

// Check cache performance
const start = performance.now();
const cached = vrStorageManager.getCachedContent('url50');
const time = performance.now() - start;
console.log(`Cache lookup: ${time.toFixed(3)}ms`);
```

**Expected Behavior:**
- Lookup time consistent (~0.1ms)
- No performance degradation
- Cache limit enforced

#### 3. Rapid Input Test

```javascript
// Simulate rapid button presses
const inputHandler = window.vrInputHandler;

for (let i = 0; i < 100; i++) {
  inputHandler.processGamepad({
    buttons: [{ pressed: true, value: 1 }],
    axes: [Math.random(), Math.random()]
  });
}

// Verify no input queue overflow
console.log('Input processing: OK');
```

**Expected Behavior:**
- No input lag
- No memory leaks
- Smooth processing

#### 4. Content Rendering Stress

```javascript
// Render large HTML content
const largeHTML = `
  <h1>Stress Test</h1>
  ${'<p>Long content paragraph</p>'.repeat(500)}
  <ul>
    ${'<li>List item</li>'.repeat(200)}
  </ul>
`;

const start = performance.now();
vrContentLoader.loadHTML(largeHTML);
const time = performance.now() - start;
console.log(`Render time: ${time.toFixed(2)}ms`);
```

**Expected Behavior:**
- Render completes <100ms
- No frame drops during render
- Content displays correctly

---

## Regression Testing

### After Each Code Change

```
□ Module Initialization
  - All modules log "Initialized" message
  - No console errors
  - FPS counter displays

□ Content Loading
  - Example page loads
  - HTML renders correctly
  - Text is readable

□ Input Handling
  - Buttons register clicks
  - Menu navigation works
  - Gestures detected

□ Persistence
  - Bookmarks save/load
  - History records visits
  - Cache works

□ Performance
  - FPS ≥ target (90 or 72)
  - No memory leaks
  - Input latency < 20ms
```

---

## Continuous Integration Testing

### Automated Test Script

```bash
#!/bin/bash

echo "VR Browser MVP - Automated Testing"

# 1. Syntax check
echo "Checking JavaScript syntax..."
for file in mvp/*.js; do
  node -c "$file" || exit 1
done
echo "✓ Syntax OK"

# 2. Module loading test
echo "Testing module loading..."
node -e "
  const core = require('./mvp/vr-browser-core.js');
  const loader = require('./mvp/vr-content-loader.js');
  const input = require('./mvp/vr-input-handler.js');
  const ui = require('./mvp/vr-ui-manager.js');
  const keyboard = require('./mvp/vr-keyboard.js');
  const storage = require('./mvp/vr-storage-manager.js');
  console.log('✓ All modules load successfully');
" || exit 1

# 3. File integrity check
echo "Checking file sizes..."
wc -l mvp/*.js MVP_INDEX.html | tail -1
echo "✓ All files present"

# 4. Summary
echo ""
echo "✅ All tests passed!"
```

---

## Device-Specific Testing

### Meta Quest 2 Specific

**Known Characteristics:**
- 90 Hz display, but 72 FPS nominal
- 3GB RAM (allocate <500MB for browser)
- Hand tracking: 2-3 meters max distance
- Controller range: ~10 meters

**Testing Points:**
```
□ Maintain 72 FPS minimum
□ Monitor memory (max 500MB)
□ Test hand tracking at 2m distance
□ Verify controller range at 5m
```

### Meta Quest 3 Specific

**Improvements over Quest 2:**
- 120 Hz display, 90 FPS capable
- 8GB RAM (more headroom)
- Better hand tracking (sharper gestures)
- Improved passthrough camera
- Faster processor (better performance)

**Testing Points:**
```
□ Achieve 90 FPS target
□ Utilize better hand tracking
□ Test with heavier content
□ Monitor lower memory pressure
```

### Pico 4 Specific (if available)

**Characteristics:**
- Similar to Quest 3 (90 Hz, 90 FPS)
- Uses different browser
- May have different CORS behavior
- Chinese market focus

**Testing Points:**
```
□ 90 FPS target
□ CORS handling
□ Hand tracking
□ Controller input mapping
```

---

## Accessibility Testing

### Visual Accessibility

```
□ Text size readable from 1 meter distance
  - Normal distance for VR browsing
  - Test both h1 (large) and p (body text)

□ Color contrast sufficient
  - White text on dark background ✓
  - Check for colorblind users

□ Element spacing adequate
  - Button clickable area sufficient
  - No overlapping interactive elements

□ No flashing/strobing content
  - Avoid rapid FPS changes
  - Smooth transitions
```

### Input Accessibility

```
□ Multiple input methods supported
  - Controller buttons ✓
  - Hand gestures ✓
  - Voice input (Phase 2)

□ Customizable controls
  - Button mapping flexible
  - Gesture sensitivity adjustable

□ Accessible menu navigation
  - Clear visual feedback
  - Logical menu flow
  - Avoid deep hierarchies
```

### Text Input Accessibility

```
□ Virtual keyboard usable
  - Letters, numbers, symbols ✓
  - Backspace for correction ✓
  - Space for words ✓
  - Clear key labeling ✓

□ Alternatives considered (Phase 2)
  - Voice input
  - Physical keyboard
  - Predictive text
```

---

## Error Scenario Testing

### Network Errors

| Scenario | Test Method | Expected Behavior |
|----------|-------------|-------------------|
| **No Internet** | Disconnect WiFi | Error message, not crash |
| **CORS Error** | Load restricted domain | Fallback error page |
| **Timeout** | Slow server | Loading indication, timeout |
| **404 Error** | Request missing page | 404 error page |
| **SSL Error** | Self-signed cert | Clear error message |

### Resource Errors

| Scenario | Test Method | Expected Behavior |
|----------|-------------|-------------------|
| **Out of Memory** | Load huge content | Graceful degradation |
| **Missing Module** | Delete JS file | Clear error message |
| **Corrupted Data** | Clear localStorage | Reinitialize defaults |
| **Invalid JSON** | Corrupt bookmark file | Error recovery |

### User Error

| Scenario | Test Method | Expected Behavior |
|----------|-------------|-------------------|
| **Invalid URL** | Type garbage URL | Error or fallback |
| **Empty Search** | Submit empty text | No action or message |
| **Rapid Clicks** | Click repeatedly | Debounced processing |
| **Out-of-range Gesture** | Point off-screen | Ignored gracefully |

---

## Performance Optimization Tips

### If FPS is Low

**Diagnosis:**
```javascript
// Check what's taking time
console.time('content-render');
vrContentLoader.render();
console.timeEnd('content-render');

// Monitor individual system times
console.log('VRBrowserCore timing:', vrBrowserCore.frameTime);
console.log('Input processing:', vrInputHandler.processingTime);
```

**Solutions:**
1. **Reduce content complexity**
   - Fewer HTML elements
   - Simpler CSS
   - Smaller images

2. **Optimize rendering**
   - Cache rendered content
   - Reduce update frequency
   - Use simpler scenes

3. **Check device capacity**
   - Close other apps
   - Check device temperature
   - Restart if needed

### If Memory is High

**Diagnosis:**
```javascript
// Check source of memory usage
console.memory.usedJSHeapSize / 1048576  // MB

// Check localStorage
let storageSize = 0;
for (let key in localStorage) {
  storageSize += localStorage[key].length;
}
console.log(`Storage: ${storageSize / 1024 / 1024} MB`);
```

**Solutions:**
1. **Clear unused data**
   - Delete old bookmarks
   - Clear history
   - Clean cache

2. **Reduce cache size**
   - Limit cached URLs (currently 50)
   - Reduce expiry time
   - Clear expired entries

3. **Close unused tabs**
   - Each tab holds content
   - Close when not needed
   - Reduces memory footprint

### If Input is Laggy

**Diagnosis:**
```javascript
// Check input processing time
const before = performance.now();
vrInputHandler.update();
const after = performance.now();
console.log(`Input time: ${(after - before).toFixed(2)}ms`);
```

**Solutions:**
1. **Reduce input polling frequency**
   - Currently 120Hz (8ms)
   - Can reduce to 60Hz (16ms)
   - Minimal user-facing impact

2. **Optimize event handlers**
   - Avoid expensive calculations
   - Use event debouncing
   - Minimize allocations

3. **Check hardware**
   - Controller pairing
   - Hand tracking distance
   - Wireless interference

---

## Post-Test Checklist

After completing all tests:

```
□ All functional tests passed
□ Performance targets met (FPS, latency, memory)
□ No console errors or warnings
□ All devices tested (if available)
□ Regression testing completed
□ Edge cases handled
□ Error scenarios tested
□ Accessibility verified
□ Performance optimized
□ Documentation updated
□ Ready for production release
```

---

## Reporting Issues

### Bug Report Template

```
Device: Meta Quest 3 (or PC with Emulator)
OS Version: v68 (or browser version)
MVP Version: 1.0.0

Issue:
[Description of problem]

Steps to Reproduce:
1. [First step]
2. [Second step]
3. [Etc.]

Expected Behavior:
[What should happen]

Actual Behavior:
[What actually happened]

Console Output:
[Any error messages]

Additional Info:
[Screenshots, videos, or other details]
```

### Performance Issue Report

```
Issue: Low FPS

Device: Meta Quest 2
FPS Measurement: 45 FPS (target: 72)
Content Type: [Describe page loaded]
Memory Usage: [From DevTools]

Console Output:
[Relevant logs]

Steps to Reproduce:
1. [Steps]
```

---

## Summary

**Testing Scope:**
✅ Desktop WebXR Emulator - Quick validation
✅ VR Device Testing - Primary testing
✅ Functional Testing - All features
✅ Performance Testing - FPS, latency, memory
✅ Stress Testing - Edge cases
✅ Regression Testing - Code changes
✅ Accessibility Testing - User experience
✅ Error Scenario Testing - Robustness

**Success Criteria:**
- ✅ FPS meets targets (90 or 72)
- ✅ All functional tests pass
- ✅ No console errors
- ✅ Input latency <20ms
- ✅ Memory <500MB
- ✅ Accessible input methods
- ✅ Graceful error handling

**Status: Ready for Testing** ✅

---

**Created:** November 4, 2025
**Last Updated:** November 4, 2025
**Test Version:** 1.0.0
