# Setup Guide

## Prerequisites

- Node.js 14+
- npm or yarn
- Modern browser with WebXR support
- VR headset (Meta Quest or Pico recommended)

## Installation

### 1. Clone Repository
```bash
git clone https://github.com/your-org/qui-browser-vr.git
cd qui-browser-vr
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Development Setup
```bash
# Start development server
npm run dev

# Open http://localhost:8080 in your browser
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
3. Navigate to `http://YOUR-IP:8080` in Quest Browser

### Pico
1. Enable Developer Options
2. Allow WebXR permissions
3. Access via Pico Browser

## Configuration

### Environment Variables
Create `.env` file:
```env
NODE_ENV=development
VR_DEFAULT_FPS_TARGET=90
VR_MIN_FPS_TARGET=72
VR_MEMORY_LIMIT_MB=2048
```

### Webpack Configuration
Modify `webpack.config.js` for custom builds:
```javascript
module.exports = {
  // Custom configuration
}
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
npm test unified-systems.test.js

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

### Bundle Analysis
```bash
npm run build:analyze
# Check bundle-report.html
```

### Code Splitting
- Lazy load VR modules
- Use dynamic imports
- Implement progressive enhancement

## Support

For issues, visit: https://github.com/your-org/qui-browser-vr/issues