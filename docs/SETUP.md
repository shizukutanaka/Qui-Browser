# Setup Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- Modern browser with WebXR support
- VR headset (Meta Quest or Pico recommended)

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/shizukutanaka/qui-browser.git
cd qui-browser
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Development Setup

```bash
# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

### 4. Production Build

```bash
# Create optimized build
npm run build

# Serve production build
npm run serve
```

## VR Device Setup

### Meta Quest

1. Enable Developer Mode in Oculus app
2. Enable WebXR in browser flags
3. Navigate to `http://YOUR-IP:5173` in Quest Browser

### Pico

1. Enable Developer Options
2. Allow WebXR permissions
3. Access via Pico Browser

## Configuration

### Environment Variables

Copy `.env.example` to `.env` to override the optional `VITE_*` keys
(Sentry DSN, GA measurement ID, version/build stamps). Unset keys simply
disable the corresponding integration.

### Vite Configuration

Modify `vite.config.js` for custom builds (chunks, dev-server, proxy):

```javascript
export default defineConfig({
  // Custom configuration
});
```

## Troubleshooting

### Issue: Low FPS

- Check Performance Monitor (F12)
- Reduce quality settings
- Close background applications

### Issue: WebXR Not Available

- Ensure HTTPS connection
- Check browser compatibility
- Enable WebXR flags

### Issue: Build Failures

```bash
# Clear cache
rm -rf node_modules dist
npm install
npm run build
```

## Testing

### Local Testing

```bash
# Run all tests
npm test

# Run specific test
npm test a11y.test.js

# Coverage report
npm run test:coverage
```

### VR Testing

1. Build project: `npm run build`
2. Serve locally: `npm run serve`
3. Connect VR headset to same network
4. Navigate to local IP address

## Deployment

### GitHub Pages

```bash
# Build and deploy
npm run build
git add dist
git commit -m "Deploy to GitHub Pages"
git push
```

### Netlify

1. Connect GitHub repository
2. Build command: `npm run build`
3. Publish directory: `dist`

### Docker

```bash
# Build image
docker build -t qui-browser-vr .

# Run container
docker run -p 8080:80 qui-browser-vr
```

## Performance Optimization

### Code Splitting

- Lazy load VR modules
- Use dynamic imports
- Implement progressive enhancement

## Support

For issues, visit: https://github.com/shizukutanaka/qui-browser/issues
