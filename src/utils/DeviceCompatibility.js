/**
 * NFR-2: Device compatibility detection.
 * Probes whether the runtime supports immersive-vr and identifies the
 * device tier (Quest 2 / 3, Pico 4, desktop) so VRApp can pick its
 * frame-rate target without hard-coded device guards.
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
    if (this.report) {
      return this.report;
    }

    const xr = typeof navigator !== 'undefined' ? navigator.xr : null;

    const vrSupported = xr ? await xr.isSessionSupported('immersive-vr').catch(() => false) : false;

    // Detect device tier from user-agent hints.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const deviceTier = this._detectTier(ua);

    this.report = {
      vrSupported,
      deviceTier // 'quest3' | 'quest2' | 'pico4' | 'android-xr' | 'desktop-xr' | 'unknown'
    };

    console.debug('DeviceCompatibility: report', this.report);
    return this.report;
  }

  /**
   * Identify the device tier from the user-agent string.
   * Quest 3 / Quest 2 / Pico 4 each have distinctive UA substrings in the
   * Meta Browser and Pico Browser respectively.
   */
  _detectTier(ua) {
    if (/Quest 3/.test(ua) || /Quest\/3/.test(ua)) {
      return 'quest3';
    }
    if (/Quest 2/.test(ua) || /Quest\/2/.test(ua)) {
      return 'quest2';
    }
    if (/Pico Neo 4/.test(ua) || /PicoNeo4/.test(ua) || /Pico 4/.test(ua)) {
      return 'pico4';
    }
    if (/Android/.test(ua) && /XR/.test(ua)) {
      return 'android-xr';
    }
    if (typeof navigator !== 'undefined' && navigator.xr) {
      return 'desktop-xr';
    }
    return 'unknown';
  }

  /**
   * Return the recommended target FPS for the detected device.
   */
  targetFPS() {
    if (!this.report) {
      return 72;
    }
    switch (this.report.deviceTier) {
      case 'quest3':
        return 120;
      case 'quest2':
        return 90;
      case 'pico4':
        return 90;
      default:
        return 72;
    }
  }
}
