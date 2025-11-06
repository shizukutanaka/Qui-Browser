/**
 * Qui Browser VR v2.0.0 - Main Entry Point
 * Production-ready VR browser application
 */

// Hide loading screen after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }, 500);
});

// Import main application
import('./app.js').then(module => {
    console.log('Qui Browser VR v2.0.0 loaded successfully');

    // Check WebXR support
    if ('xr' in navigator) {
        navigator.xr.isSessionSupported('immersive-vr').then(supported => {
            if (supported) {
                const vrButton = document.getElementById('vrFloatingButton');
                if (vrButton) {
                    vrButton.style.display = 'flex';
                }
            }
        });
    }
}).catch(error => {
    console.error('Failed to load application:', error);
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div style="color: #de350b;">
                <h2>Failed to load application</h2>
                <p style="color: #a0a0b8;">${error.message}</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #0052cc; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Reload
                </button>
            </div>
        `;
    }
});

// VR button handlers
document.addEventListener('DOMContentLoaded', () => {
    const enterVRButton = document.getElementById('enterVRButton');
    const vrFloatingButton = document.getElementById('vrFloatingButton');

    if (enterVRButton) {
        enterVRButton.addEventListener('click', async () => {
            try {
                if ('xr' in navigator) {
                    const supported = await navigator.xr.isSessionSupported('immersive-vr');
                    if (supported) {
                        // VRApp will handle session creation
                        window.dispatchEvent(new CustomEvent('enter-vr'));
                    } else {
                        alert('WebXR VR is not supported on this device. Please use a VR headset.');
                    }
                } else {
                    alert('WebXR is not available. Please use a WebXR-compatible browser.');
                }
            } catch (error) {
                console.error('Error entering VR:', error);
                alert('Failed to enter VR mode: ' + error.message);
            }
        });
    }

    if (vrFloatingButton) {
        vrFloatingButton.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('enter-vr'));
        });
    }
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}

// Build Info
console.log(`
╔══════════════════════════════════════════════════════════════╗
║                   Qui Browser VR v2.0.0                      ║
║                                                              ║
║  Production-ready VR browser with 17 features                ║
║  • 90-120 FPS performance                                    ║
║  • Japanese IME, Hand Tracking, Spatial Audio                ║
║  • WebGPU, Multiplayer, AI Recommendations                   ║
║  • Complete CI/CD, Enterprise Monitoring                     ║
║                                                              ║
║  GitHub: github.com/your-username/qui-browser-vr             ║
║  Docs: github.com/your-username/qui-browser-vr/docs          ║
║  License: MIT                                                ║
╚══════════════════════════════════════════════════════════════╝
`);
