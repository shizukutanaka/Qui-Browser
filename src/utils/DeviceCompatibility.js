/**
 * NFR-2: Device tier detection.
 * Maps the user-agent to a device tier (Quest 2 / 3, Pico 4, Android XR,
 * desktop, unknown) so VRApp can pick a target frame rate without hard-coded
 * device guards.
 *
 * Session support itself is probed separately by the entry layer
 * (main.js/app.js call navigator.xr.isSessionSupported directly) — a second
 * probe here would be a wasted round-trip on every VR boot.
 */

export class DeviceCompatibility {
  constructor() {
    // Resolved once check() completes.
    this.report = null;
  }

  /**
   * Detect the device tier and cache the report.
   * Safe to call multiple times — caches the result after the first run.
   *
   * @returns {Promise<{deviceTier: string}>}
   */
  async check() {
    if (this.report) {
      return this.report;
    }

    const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
    this.report = { deviceTier: this._detectTier(ua) };

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
    case 'quest3':   return 120;
    case 'quest2':   return 90;
    case 'pico4':    return 90;
    default:         return 72;
    }
  }
}
