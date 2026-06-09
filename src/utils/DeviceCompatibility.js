/**
 * NFR-2: Device compatibility feature-detection matrix.
 * Probes the WebXR runtime for features available on the current device
 * (Quest 2 / 3, Pico 4, desktop) so VRApp can enable/disable subsystems
 * without hard-coded device guards.
 */

export class DeviceCompatibility {
  constructor() {
    // Resolved once check() completes.
    this.report = null;
  }

  /**
   * Run all feature probes and return a capability report object.
   * Safe to call multiple times — caches the result after the first run.
   *
   * @returns {Promise<CompatibilityReport>}
   */
  async check() {
    if (this.report) return this.report;

    const xr = typeof navigator !== 'undefined' ? navigator.xr : null;

    const [vrSupported, arSupported] = await Promise.all([
      xr ? xr.isSessionSupported('immersive-vr').catch(() => false) : Promise.resolve(false),
      xr ? xr.isSessionSupported('immersive-ar').catch(() => false) : Promise.resolve(false)
    ]);

    // Detect device tier from user-agent hints.
    const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
    const deviceTier = this._detectTier(ua);

    // Probe optional WebXR features (supported = the runtime accepts them in
    // requestSession; actual availability depends on hardware). Reuse the
    // already-detected tier rather than recomputing it.
    const optionalFeatures = await this._probeOptionalFeatures(xr, vrSupported, deviceTier);

    this.report = {
      vrSupported,
      arSupported,
      deviceTier,          // 'quest3' | 'quest2' | 'pico4' | 'desktop' | 'unknown'
      webgpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
      webgl2: this._hasWebGL2(),
      ...optionalFeatures,
      timestamp: Date.now()
    };

    console.log('DeviceCompatibility: report', this.report);
    return this.report;
  }

  /**
   * Identify the device tier from the user-agent string.
   * Quest 3 / Quest 2 / Pico 4 each have distinctive UA substrings in the
   * Meta Browser and Pico Browser respectively.
   */
  _detectTier(ua) {
    if (/Quest 3/.test(ua) || /Quest\/3/.test(ua)) return 'quest3';
    if (/Quest 2/.test(ua) || /Quest\/2/.test(ua)) return 'quest2';
    if (/Pico Neo 4/.test(ua) || /PicoNeo4/.test(ua) || /Pico 4/.test(ua)) return 'pico4';
    if (/Android/.test(ua) && /XR/.test(ua)) return 'android-xr';
    if (typeof navigator !== 'undefined' && navigator.xr) return 'desktop-xr';
    return 'unknown';
  }

  /**
   * Attempt to probe optional WebXR features without actually opening a
   * session.  The only reliable method is trying requestSession with the
   * feature as optional and checking enabledFeatures, but that requires a
   * user gesture.  Instead we rely on the device tier as a heuristic, which
   * is accurate for all shipping consumer devices.
   */
  async _probeOptionalFeatures(xr, vrSupported, tier) {
    // These are available on all devices that support immersive-vr.
    const base = {
      handTracking:  vrSupported,
      hitTest:       false,
      anchors:       false,
      planeDetection: false,
      eyeTracking:   false,
      foveatedRendering: vrSupported
    };

    if (!xr || !vrSupported) return base;

    // Quest 3 / Quest Pro support additional features. Fall back to detecting
    // the tier here if the caller didn't supply it.
    if (!tier) {
      tier = this._detectTier(
        typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
      );
    }

    return {
      ...base,
      hitTest:        tier !== 'unknown' && tier !== 'desktop-xr',
      anchors:        tier !== 'unknown' && tier !== 'desktop-xr',
      planeDetection: tier === 'quest3' || tier === 'android-xr',
      eyeTracking:    false // Quest Pro only; Quest 2/3/Pico 4 = false
    };
  }

  _hasWebGL2() {
    if (typeof document === 'undefined') return false;
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2'));
    } catch {
      return false;
    }
  }

  /**
   * Return the recommended target FPS for the detected device.
   */
  targetFPS() {
    if (!this.report) return 72;
    switch (this.report.deviceTier) {
      case 'quest3':   return 120;
      case 'quest2':   return 90;
      case 'pico4':    return 90;
      default:         return 72;
    }
  }
}
