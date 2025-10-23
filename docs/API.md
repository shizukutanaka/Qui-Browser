# API Documentation

## Unified Performance System

### Initialize
```javascript
const perfSystem = new UnifiedPerformanceSystem();
await perfSystem.initialize();
```

### Methods

#### `setQualityLevel(level)`
Adjust rendering quality.
- `level`: 'low' | 'medium' | 'high' | 'ultra'

#### `getStatus()`
Get current performance metrics.
```javascript
const status = perfSystem.getStatus();
// Returns: { fps, frameTime, memory, optimizations }
```

#### `profile(name, fn)`
Profile function execution.
```javascript
const result = await perfSystem.profile('render', renderFunction);
```

## Unified Security System

### Initialize
```javascript
const security = new UnifiedSecuritySystem();
await security.initialize();
```

### Methods

#### `encrypt(data)`
Encrypt sensitive data using Web Crypto API.
```javascript
const encrypted = await security.encrypt({ user: 'data' });
```

#### `decrypt(data)`
Decrypt encrypted data.
```javascript
const decrypted = await security.decrypt(encrypted);
```

#### `validate(type, value)`
Validate input against security rules.
```javascript
const result = security.validate('url', userInput);
// Returns: { valid: boolean, error?: string }
```

## Unified Error Handler

### Initialize
```javascript
const errorHandler = new UnifiedErrorHandler();
await errorHandler.initialize();
```

### Methods

#### `handleError(errorInfo)`
Handle application errors.
```javascript
errorHandler.handleError({
  message: 'Error message',
  category: 'network',
  severity: 3
});
```

#### `handleVRError(vrError)`
Handle VR-specific errors.
```javascript
errorHandler.handleVRError({
  code: 'VR_SESSION_LOST',
  message: 'Session terminated'
});
```

## Unified VR Extension System

### Initialize
```javascript
const extensions = new UnifiedVRExtensionSystem();
await extensions.initialize();
```

### Methods

#### `loadExtension(manifest)`
Load a VR extension.
```javascript
await extensions.loadExtension({
  id: 'my-extension',
  name: 'My Extension',
  version: '1.0.0',
  main: '/extensions/my-ext.js'
});
```

#### `activateExtension(id)`
Activate loaded extension.
```javascript
await extensions.activateExtension('my-extension');
```

## Events

### Performance Events
```javascript
unifiedPerformance.on('performance:critical', (data) => {
  console.log('Critical performance:', data);
});

unifiedPerformance.on('performance:optimal', (data) => {
  console.log('Optimal performance:', data);
});
```

### Security Events
```javascript
unifiedSecurity.on('security:violation', (event) => {
  console.log('Security violation:', event);
});
```

### Error Events
```javascript
errorHandler.on('error:recovered', (info) => {
  console.log('Error recovered:', info);
});
```

### Extension Events
```javascript
extensions.on('extension:loaded', (data) => {
  console.log('Extension loaded:', data);
});
```

## WebXR Integration

### Start VR Session
```javascript
async function startVR() {
  const session = await navigator.xr.requestSession('immersive-vr', {
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['hand-tracking']
  });

  window.xrSession = session;
}
```

### Hand Tracking
```javascript
if (window.xrSession.inputSources) {
  for (const source of window.xrSession.inputSources) {
    if (source.hand) {
      // Process hand data
      const joints = source.hand.values();
    }
  }
}
```

## Module Loading

### Progressive Loading
```javascript
// Load core modules first
await moduleLoader.load(['unified-performance-system']);

// Load VR modules on demand
if (navigator.xr) {
  await moduleLoader.load(['vr-launcher', 'vr-navigation']);
}
```

## Configuration

### Performance Config
```javascript
window.performanceConfig = {
  targetFPS: 90,
  minFPS: 72,
  maxMemoryMB: 2048,
  enableAutoOptimization: true
};
```

### Security Config
```javascript
window.securityConfig = {
  enforceHTTPS: true,
  enableCSP: true,
  sessionTimeout: 30 * 60 * 1000
};
```

## Best Practices

1. **Always initialize systems before use**
2. **Handle async operations with try-catch**
3. **Clean up resources on page unload**
4. **Monitor performance metrics regularly**
5. **Validate all user inputs**
6. **Use encryption for sensitive data**
7. **Implement proper error handling**
8. **Test on actual VR devices**