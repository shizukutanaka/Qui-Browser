# User Guide

**Version**: 1.1.0
**Last Updated**: 2025-10-12

Welcome to Qui Browser! This guide will help you get started and make the most of all features.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Basic Usage](#basic-usage)
- [Advanced Features](#advanced-features)
- [VR Mode](#vr-mode)
- [AI Assistant](#ai-assistant)
- [Privacy Features](#privacy-features)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Getting Started

### Installation

#### Quick Start (Recommended)

The easiest way to get started is using our automated setup:

**Linux/macOS**:
```bash
git clone <repository-url>
cd qui-browser
chmod +x scripts/setup-production.sh
./scripts/setup-production.sh
```

**Windows PowerShell**:
```powershell
git clone <repository-url>
cd qui-browser
.\scripts\setup-production.ps1
```

The setup script will:
- ✅ Install dependencies
- ✅ Create required directories
- ✅ Generate security keys
- ✅ Create `.env` configuration file
- ✅ Run tests to verify installation

#### Manual Installation

If you prefer manual setup:

```bash
# Clone repository
git clone <repository-url>
cd qui-browser

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Generate security keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Edit .env file with your configuration
nano .env

# Start server
npm start
```

### First Launch

After installation, start the server:

```bash
npm start
```

You should see:

```
✨ Qui Browser Server Starting...
✅ Server running on http://localhost:8000
✅ Health check: http://localhost:8000/health
```

Open your browser and visit:
- **Application**: http://localhost:8000
- **Health Status**: http://localhost:8000/health
- **Metrics**: http://localhost:8000/metrics

---

## Basic Usage

### Navigating the Interface

#### Homepage

The homepage provides quick access to all features:

```
┌─────────────────────────────────────────┐
│         Qui Browser v1.1.0              │
├─────────────────────────────────────────┤
│                                         │
│  📊 System Status: ●  Healthy           │
│  ⚡ Response Time: 12ms                 │
│  🔒 Security: Active                    │
│  🤖 AI Assistant: Available             │
│                                         │
│  [Browse]  [VR Mode]  [Settings]        │
│                                         │
└─────────────────────────────────────────┘
```

#### Navigation Bar

- **Home**: Return to homepage
- **VR Mode**: Enter immersive VR experience
- **AI Assistant**: Open AI copilot panel
- **Privacy**: View privacy dashboard
- **Settings**: Configure preferences
- **Help**: Access this guide

### Making Requests

#### Standard Browsing

Simply enter a URL or search term in the address bar. Qui Browser will:

1. **Validate Input**: Check for malicious patterns
2. **Check Cache**: Return cached content if available (faster!)
3. **Fetch Content**: Retrieve from source if needed
4. **Optimize**: Compress and optimize delivery
5. **Protect Privacy**: Block trackers and fingerprinting

#### Advanced Search

Use search operators for better results:

```
"exact phrase"      - Search exact phrase
site:example.com    - Search specific site
-exclude            - Exclude words
```

### Session Management

#### Creating a Session

Sessions are created automatically when you visit the site. You'll see:

```
✅ Session created
🔒 Expires in: 1 hour
```

#### Session Security

All sessions are:
- ✅ Encrypted with HMAC-SHA256
- ✅ Tamper-proof (detects modifications)
- ✅ Auto-expiring (1 hour default)
- ✅ Secure cookies (HttpOnly, Secure, SameSite)

#### Viewing Session Info

Click your profile icon to see session details:

```json
{
  "sessionId": "sess_abc123",
  "userId": "user123",
  "expiresAt": "2025-10-12T11:00:00.000Z",
  "timeRemaining": "55 minutes"
}
```

---

## Advanced Features

### Performance Monitoring

#### Viewing Metrics

Access real-time metrics at `/metrics`:

```bash
curl http://localhost:8000/metrics | jq
```

**Key Metrics**:
- **Cache Hit Rate**: How often cache is used (target: >80%)
- **Response Time**: Average request duration (target: <50ms)
- **Error Rate**: Percentage of failed requests (target: <1%)
- **Memory Usage**: Current memory consumption

#### Performance Dashboard

Visual dashboard showing:

```
┌─────────────────────────────────────────┐
│        Performance Dashboard            │
├─────────────────────────────────────────┤
│                                         │
│  Cache Hit Rate                         │
│  ██████████████░░░░░ 90.9%             │
│                                         │
│  Response Time (P95)                    │
│  ████░░░░░░░░░░░░ 35ms                  │
│                                         │
│  Requests/Second                        │
│  ████████░░░░░░░ 8.3/s                  │
│                                         │
└─────────────────────────────────────────┘
```

### Cache Management

#### Understanding Cache Strategies

Qui Browser uses adaptive caching:

**LRU (Least Recently Used)**:
- Best for: Time-sensitive data
- Removes: Oldest accessed items
- Use when: Recency matters

**LFU (Least Frequently Used)**:
- Best for: Popular content
- Removes: Least accessed items
- Use when: Popularity matters

**TTL (Time To Live)**:
- Best for: Expiring content
- Removes: Expired items
- Use when: Freshness critical

**Adaptive (Recommended)**:
- Auto-selects best strategy
- Monitors access patterns
- Optimizes automatically

#### Manual Cache Control

Clear cache when needed:

```bash
curl -X POST \
  -H "Authorization: Bearer your-admin-token" \
  http://localhost:8000/admin/cache/clear
```

### Audit Logging

#### Viewing Audit Logs

All actions are logged with cryptographic signatures:

```bash
curl -H "Authorization: Bearer admin-token" \
  "http://localhost:8000/admin/audit/logs?category=security_violation"
```

**Response**:

```json
{
  "logs": [
    {
      "id": "log_abc123",
      "timestamp": "2025-10-12T09:30:00.000Z",
      "category": "security_violation",
      "action": "rate_limit_exceeded",
      "userId": "user123",
      "ip": "192.168.1.100",
      "metadata": {
        "endpoint": "/api/data",
        "requestCount": 150
      },
      "signature": "a1b2c3d4..." // Tamper-proof signature
    }
  ]
}
```

#### Log Categories

- `security_violation`: Security issues (rate limiting, blacklisting)
- `data_access`: Data read/write operations
- `config_change`: Configuration modifications
- `admin_action`: Administrative actions
- `user_action`: User activities

---

## VR Mode

### Entering VR Mode

#### Prerequisites

- VR headset (Quest 3, Pico 4, or WebXR-compatible device)
- Chrome/Edge browser (WebXR support)
- Stable connection (recommended: 5G/WiFi)

#### Starting VR Session

1. Click **VR Mode** button
2. Put on headset
3. Click "Enter VR" in headset
4. Grant permissions (if prompted)

```javascript
// Check VR availability
const vrSupported = await navigator.xr?.isSessionSupported('immersive-vr');

if (vrSupported) {
  // Enter VR
  const session = await navigator.xr.requestSession('immersive-vr');
}
```

### VR Controls

#### Controller Input

**Trigger (Index Finger)**:
- Single click: Select
- Hold: Grab/drag
- Double click: Open menu

**Grip (Middle Fingers)**:
- Hold: Move object
- Release: Drop object

**Joystick**:
- Up/Down: Move forward/backward
- Left/Right: Turn
- Click: Sprint

#### Hand Tracking (No Controllers)

Enable hand tracking for controller-free operation:

**Pinch Gesture** (Thumb + Index):
- Single pinch: Select
- Pinch + move: Drag
- Double pinch: Context menu

**Point Gesture**:
- Point at UI: Highlight
- Dwell (0.8s): Select

**Palm Up**:
- Shows menu
- Voice command ready

### VR Performance

#### Target Frame Rates

- **Quest 3**: 90fps (11ms frame budget)
- **High-End PC VR**: 120fps (8.3ms frame budget)
- **Mobile VR**: 72fps (13.8ms frame budget)

#### Optimization Features

**Foveated Rendering**:
- Reduces peripheral resolution
- Maintains center sharpness
- 30-40% performance boost

**Quad Views**:
- 4 rendering zones per eye
- Dynamic quality adjustment
- Prevents motion sickness

**LOD (Level of Detail)**:
- Near objects: High detail
- Far objects: Low detail
- Automatic distance-based switching

### VR UI Layout

#### Ergonomic Positioning

```
        User
         │
         │ 1.5m (optimal distance)
         │
         ▼
    ┌────────┐
    │  Main  │  60° horizontal FOV
    │  Panel │  40° vertical FOV
    └────────┘
```

**Recommendations**:
- **Distance**: 0.5m - 3m (optimal: 1.5m)
- **Angle**: Eye level ± 20°
- **Width**: Maximum 60° FOV
- **Curved**: Panels curve to reduce neck strain

---

## AI Assistant

### Overview

Qui Browser includes an AI-powered copilot for intelligent assistance.

### Supported Providers

- **Local** (Privacy-focused): No data leaves your device
- **OpenAI** (GPT-4): Most capable, requires API key
- **Anthropic** (Claude): Balanced, requires API key
- **Google** (Gemini): Fast, requires API key

### Configuration

Set your AI provider in `.env`:

```bash
# AI Configuration
AI_PROVIDER=local              # or 'openai', 'anthropic', 'google'
AI_MODEL=gpt-4                 # Model name
OPENAI_API_KEY=sk-...          # API key (if using cloud)
```

### Features

#### Page Summarization

Summarize long articles in 3 sentences:

```javascript
// Click "Summarize" button or use API
const summary = await fetch('/api/ai/summarize', {
  method: 'POST',
  body: JSON.stringify({
    content: pageContent,
    maxLength: 3
  })
});
```

**Example**:

```
Original: 2000-word article about quantum computing

Summary: Quantum computing uses quantum mechanics to solve
complex problems faster than classical computers. Companies
like IBM and Google have built quantum processors with 100+
qubits. Practical applications include cryptography, drug
discovery, and optimization.
```

#### Question Answering

Ask questions about page content:

```javascript
const answer = await fetch('/api/ai/question', {
  method: 'POST',
  body: JSON.stringify({
    question: "What are the main benefits?",
    context: pageContent
  })
});
```

**Example**:

```
Q: What are the main benefits of quantum computing?

A: The main benefits include exponentially faster calculations
for specific problems, ability to simulate quantum systems
accurately, and potential breakthroughs in cryptography and
optimization.
```

#### Voice Commands

Enable voice control:

1. Click microphone icon
2. Grant microphone permission
3. Say command:

```
"Summarize this page"
"Translate to Spanish"
"Read this aloud"
"Search for quantum computing"
```

#### Translation

Translate content to any language:

```javascript
const translation = await fetch('/api/ai/translate', {
  method: 'POST',
  body: JSON.stringify({
    text: selectedText,
    targetLanguage: 'Spanish'
  })
});
```

#### Smart Form Fill

AI suggests form values based on context:

```javascript
// Detects form fields automatically
const suggestions = await fetch('/api/ai/form-fill', {
  method: 'POST',
  body: JSON.stringify({
    formFields: ['name', 'email', 'company'],
    context: userProfile
  })
});
```

### Privacy Controls

#### Local Processing

For maximum privacy, use local AI:

```bash
AI_PROVIDER=local
AI_LOCAL_PROCESSING=true
```

**Benefits**:
- ✅ No data sent to cloud
- ✅ Works offline
- ✅ No API costs

**Trade-offs**:
- ⚠️ Lower accuracy than cloud models
- ⚠️ Slower processing
- ⚠️ Limited capabilities

#### Data Anonymization

Enable automatic data anonymization:

```bash
AI_ANONYMIZE_DATA=true
```

Removes:
- Personal names
- Email addresses
- Phone numbers
- IP addresses
- Sensitive keywords

---

## Privacy Features

### Privacy Dashboard

Access at `/privacy/dashboard`:

```
┌─────────────────────────────────────────┐
│        Privacy Dashboard                │
├─────────────────────────────────────────┤
│                                         │
│  Privacy Score: 85/100 (A)              │
│                                         │
│  Protection Status:                     │
│  ✅ Canvas Fingerprinting: Blocked      │
│  ✅ WebGL Fingerprinting: Blocked       │
│  ✅ Trackers: 150 blocked               │
│  ✅ Third-Party Cookies: Blocked        │
│  ⚠️  User Agent: Not randomized         │
│                                         │
│  Recommendations:                       │
│  • Enable user agent randomization      │
│    Impact: Medium privacy improvement   │
│                                         │
└─────────────────────────────────────────┘
```

### Anti-Fingerprinting

#### Canvas Fingerprinting Protection

Qui Browser adds subtle noise to canvas rendering:

```javascript
// Brave method - randomize 1% of pixels
for (let i = 0; i < pixels.length; i += 4) {
  if (Math.random() < 0.01) {
    pixels[i] = pixels[i] ^ 1;     // Flip last bit (R)
    pixels[i+1] = pixels[i+1] ^ 1; // Flip last bit (G)
    pixels[i+2] = pixels[i+2] ^ 1; // Flip last bit (B)
  }
}
```

**Result**: Unique fingerprint changes on each visit, making tracking impossible.

#### WebGL Fingerprinting Protection

Spoofs GPU information:

```javascript
// Real GPU: "NVIDIA GeForce RTX 3080"
// Reported: "Google Inc. - ANGLE (Unknown)"
```

#### User Agent Randomization

Rotates between common user agents:

```javascript
const userAgents = [
  'Chrome/131.0.0.0 (Windows)',
  'Chrome/131.0.0.0 (macOS)',
  'Firefox/132.0 (Windows)',
  'Safari/18.0 (macOS)'
];

// Changes every session
```

### Tracker Blocking

#### Blocked Trackers

Qui Browser blocks known trackers:

```
Google Analytics ❌
DoubleClick ❌
Facebook Pixel ❌
Google Tag Manager ❌
Scorecard Research ❌
```

#### Custom Tracker Lists

Add your own tracker domains:

```javascript
// In .env or config
BLOCKED_TRACKERS=custom-tracker.com,another-tracker.net
```

### Cookie Controls

#### Third-Party Cookie Blocking

Automatically blocks third-party cookies:

```javascript
// First-party: example.com sets cookie for example.com ✅
// Third-party: example.com sets cookie for tracker.com ❌
```

#### Cookie Dashboard

View and manage cookies:

```bash
curl http://localhost:8000/privacy/cookies
```

```json
{
  "total": 15,
  "firstParty": 12,
  "thirdParty": 0,
  "blocked": 25,
  "cookies": [
    {
      "name": "session",
      "domain": "localhost",
      "expires": "2025-10-12T11:00:00.000Z",
      "secure": true,
      "httpOnly": true
    }
  ]
}
```

---

## Troubleshooting

### Common Issues

#### Issue: "Port 8000 already in use"

**Solution**:
```bash
# Find process using port 8000
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Kill process or use different port
PORT=9000 npm start
```

---

#### Issue: "Session expired"

**Cause**: Sessions expire after 1 hour of inactivity.

**Solution**:
```bash
# Increase session timeout in .env
SESSION_TIMEOUT=7200000  # 2 hours
```

---

#### Issue: High memory usage

**Solution**:
```bash
# Reduce cache size in .env
CACHE_MAX_SIZE=1000  # Down from 10000

# Disable profiling if enabled
ENABLE_PROFILING=false
```

---

#### Issue: VR mode not working

**Checklist**:
1. ✅ WebXR-compatible browser (Chrome/Edge)
2. ✅ HTTPS enabled (required for WebXR)
3. ✅ VR headset connected
4. ✅ Permissions granted

**Test VR support**:
```javascript
const supported = await navigator.xr?.isSessionSupported('immersive-vr');
console.log('VR supported:', supported);
```

---

#### Issue: AI features not responding

**Checklist**:
1. ✅ API key configured (if using cloud)
2. ✅ Network connectivity
3. ✅ API quota not exceeded

**Test AI connection**:
```bash
curl -X POST http://localhost:8000/api/ai/summarize \
  -H "Content-Type: application/json" \
  -d '{"content":"Test content","maxLength":1}'
```

---

### Getting Help

#### Check Logs

```bash
# PM2 logs
pm2 logs qui-browser-production

# Docker logs
docker-compose logs -f

# File logs
tail -f logs/application.log
```

#### Enable Debug Mode

```bash
NODE_ENV=development DEBUG=* npm start
```

#### Health Check

```bash
curl http://localhost:8000/health | jq
```

Look for:
- `status: "healthy"`
- All dependencies showing `true`
- Low event loop lag (<10ms)

---

## FAQ

### General Questions

**Q: Is Qui Browser free?**
A: Yes, Qui Browser is open source under MIT license.

**Q: What browsers are supported?**
A: Any modern browser (Chrome, Firefox, Safari, Edge). VR features require WebXR support (Chrome/Edge).

**Q: Can I use Qui Browser commercially?**
A: Yes, MIT license allows commercial use.

### Technical Questions

**Q: What's the difference between cache strategies?**
A:
- **LRU**: Removes oldest accessed items
- **LFU**: Removes least frequently accessed items
- **TTL**: Removes expired items
- **Adaptive**: Auto-selects best strategy

**Q: How secure are sessions?**
A: Sessions use HMAC-SHA256 encryption (NIST-approved), making them cryptographically tamper-proof.

**Q: Can sessions be revoked?**
A: Sessions auto-expire after configured timeout. For immediate revocation, clear session storage.

### VR Questions

**Q: What VR headsets are supported?**
A: Any WebXR-compatible headset (Quest 3, Quest 2, Pico 4, PSVR2, PC VR).

**Q: Do I need controllers?**
A: No, hand tracking is supported for controller-free operation.

**Q: Why is VR performance poor?**
A:
- Enable foveated rendering
- Lower render scale
- Reduce object count
- Use LOD (level of detail)

### Privacy Questions

**Q: Does Qui Browser collect data?**
A: No. All data processing happens locally. No telemetry or tracking.

**Q: Can websites still fingerprint me?**
A: Qui Browser makes fingerprinting significantly harder through randomization, but 100% protection is impossible.

**Q: What's the privacy score calculation?**
A:
```
Score = 100 points
- 15 for no canvas randomization
- 15 for no WebGL randomization
- 20 for allowing third-party cookies
- 25 for not blocking trackers
- 10 for no user agent randomization
- 10 for no DNS-over-HTTPS
- 5 for no WebRTC blocking
```

---

## Best Practices

### Performance

1. **Enable caching**: Keep `CACHE_MAX_SIZE` at 10000 or higher
2. **Use adaptive strategy**: Best all-around performance
3. **Enable compression**: Reduces bandwidth by 70%+
4. **Use PM2 clustering**: 1 worker per CPU core

### Security

1. **Always use HTTPS**: Required for WebXR and secure cookies
2. **Rotate secrets**: Change `AUDIT_SIGNATURE_KEY` periodically
3. **Review audit logs**: Check for suspicious activity
4. **Keep dependencies updated**: Run `npm audit` regularly

### Privacy

1. **Enable all protections**: Canvas, WebGL, tracker blocking
2. **Block third-party cookies**: Prevents cross-site tracking
3. **Randomize user agent**: Makes fingerprinting harder
4. **Use local AI**: Keeps data on your device

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open search |
| `Ctrl+Shift+P` | Open privacy dashboard |
| `Ctrl+Shift+M` | Open metrics |
| `Ctrl+Shift+V` | Enter VR mode |
| `Ctrl+Shift+A` | Open AI assistant |
| `Ctrl+/` | Show shortcuts |

---

## Next Steps

- ✅ [API Reference](API-REFERENCE.md) - Integrate with APIs
- ✅ [Architecture Guide](ARCHITECTURE-C4.md) - Understand system design
- ✅ [Production Deployment](PRODUCTION-DEPLOYMENT.md) - Deploy to production
- ✅ [Contributing Guide](CONTRIBUTING.md) - Contribute to project

---

**Need more help?** Check our [GitHub Discussions](https://github.com/your-org/qui-browser/discussions) or open an [issue](https://github.com/your-org/qui-browser/issues).

---

**Last Updated**: 2025-10-12
**Version**: 1.1.0
