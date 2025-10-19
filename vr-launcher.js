/**
 * VR Launcher - Quick WebXR VR Mode Launcher
 * Adds a VR mode button to any page and handles WebXR session management
 */

class VRLauncher {
  constructor() {
    this.xrSession = null;
    this.xrRefSpace = null;
    this.isVRSupported = false;
    this.init();
  }

  async init() {
    // Check WebXR support
    if ('xr' in navigator) {
      this.isVRSupported = await navigator.xr.isSessionSupported('immersive-vr');
      if (this.isVRSupported) {
        this.addVRButton();
      } else {
        console.log('WebXR VR not supported on this device');
      }
    } else {
      console.log('WebXR not available');
    }
  }

  addVRButton() {
    // Create VR button
    const vrButton = document.createElement('button');
    vrButton.id = 'vr-button';
    vrButton.textContent = '🥽 Enter VR';
    vrButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 15px 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 50px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      transition: all 0.3s ease;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    vrButton.addEventListener('mouseenter', () => {
      vrButton.style.transform = 'translateY(-2px)';
      vrButton.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
    });

    vrButton.addEventListener('mouseleave', () => {
      vrButton.style.transform = 'translateY(0)';
      vrButton.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
    });

    vrButton.addEventListener('click', () => {
      if (this.xrSession) {
        this.exitVR();
      } else {
        this.enterVR();
      }
    });

    document.body.appendChild(vrButton);
    this.vrButton = vrButton;
  }

  async enterVR() {
    try {
      this.vrButton.textContent = '⏳ Starting VR...';
      this.vrButton.disabled = true;

      // Request VR session
      this.xrSession = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking', 'eye-tracking']
      });

      // Set up reference space
      this.xrRefSpace = await this.xrSession.requestReferenceSpace('local-floor');

      // Handle session end
      this.xrSession.addEventListener('end', () => {
        this.onSessionEnded();
      });

      // Update button
      this.vrButton.textContent = '🚪 Exit VR';
      this.vrButton.disabled = false;

      // Start render loop
      this.xrSession.requestAnimationFrame((time, frame) => {
        this.onXRFrame(time, frame);
      });

      console.log('VR session started successfully');

      // Optional: Navigate to VR browser page
      if (window.location.pathname !== '/public/vr-browser.html') {
        // Store current URL for return
        sessionStorage.setItem('vr-return-url', window.location.href);
        window.location.href = '/public/vr-browser.html';
      }

    } catch (error) {
      console.error('Failed to enter VR:', error);
      this.vrButton.textContent = '❌ VR Failed';
      this.vrButton.disabled = false;

      setTimeout(() => {
        this.vrButton.textContent = '🥽 Enter VR';
      }, 2000);

      // Show user-friendly error
      this.showError(error.message);
    }
  }

  async exitVR() {
    if (this.xrSession) {
      await this.xrSession.end();
    }
  }

  onSessionEnded() {
    this.xrSession = null;
    this.xrRefSpace = null;

    if (this.vrButton) {
      this.vrButton.textContent = '🥽 Enter VR';
      this.vrButton.disabled = false;
    }

    console.log('VR session ended');

    // Return to previous URL if available
    const returnUrl = sessionStorage.getItem('vr-return-url');
    if (returnUrl && window.location.pathname === '/public/vr-browser.html') {
      sessionStorage.removeItem('vr-return-url');
      window.location.href = returnUrl;
    }
  }

  onXRFrame(time, frame) {
    if (!this.xrSession) return;

    // Request next frame
    this.xrSession.requestAnimationFrame((t, f) => {
      this.onXRFrame(t, f);
    });

    // Get viewer pose
    const pose = frame.getViewerPose(this.xrRefSpace);
    if (!pose) return;

    // Render VR scene here
    // This is a placeholder - actual rendering would be implemented
    // in the VR browser page
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff4444;
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(255, 68, 68, 0.4);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 80%;
      text-align: center;
    `;
    errorDiv.textContent = `VR Error: ${message}`;

    document.body.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.style.transition = 'opacity 0.3s ease';
      errorDiv.style.opacity = '0';
      setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.vrLauncher = new VRLauncher();
  });
} else {
  window.vrLauncher = new VRLauncher();
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRLauncher;
}
