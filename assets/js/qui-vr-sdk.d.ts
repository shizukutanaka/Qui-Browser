/**
 * Type definitions for Qui Browser VR SDK
 * Version: 4.9.0
 *
 * Unified TypeScript definitions for all VR features
 *
 * @author Qui Browser Team
 * @license MIT
 */

// Configuration Types

export type PresetType = 'performance' | 'quality' | 'balanced' | 'battery';
export type PricingTier = 'free' | 'premium' | 'business';
export type Language = 'ja' | 'en';
export type ThemeName = 'space' | 'ocean' | 'forest' | 'desert' | 'city' | 'minimal';

export interface QuiVRSDKOptions {
  /** Preset configuration (overrides individual settings) */
  preset?: PresetType;

  /** Performance settings */
  targetFPS?: number;
  enableWebGPU?: boolean;
  enableSIMD?: boolean;
  enableMultiThreading?: boolean;

  /** Feature toggles */
  enableDepthSensing?: boolean;
  enableHandTracking?: boolean;
  enableFoveatedRendering?: boolean;
  enableBatteryOptimization?: boolean;

  /** Monetization */
  pricing?: PricingTier;

  /** UI settings */
  language?: Language;
  theme?: ThemeName;

  /** Debug */
  debug?: boolean;
  verbose?: boolean;

  /** Additional options */
  [key: string]: any;
}

// Feature Support Types

export interface CompatibilityInfo {
  webxr: boolean;
  webgpu: boolean;
  simd: boolean;
  sharedArrayBuffer: boolean;
  batteryAPI: boolean;
}

export interface PerformanceInfo {
  simd: boolean;
  multiThreading: boolean;
  targetFPS: number;
}

export interface SystemInfo {
  version: string;
  preset: PresetType;
  features: CompatibilityInfo;
  renderer: 'WebGPU' | 'WebGL';
  performance: PerformanceInfo;
  pricing: PricingTier;
}

// Metrics Types

export interface VRMetrics {
  fps: number;
  frameTime: number;
  drawCalls: number;
  memoryUsage: number;
  batteryLevel: number;
  version: string;
  initialized: boolean;
  inVR: boolean;
  features: CompatibilityInfo;
}

// Event Types

export interface InitializedEventDetail {
  version: string;
  features: CompatibilityInfo;
}

export interface VRStartedEventDetail {
  session: XRSession;
}

export interface ErrorEventDetail {
  type: 'initialization' | 'vr-start' | 'renderer' | 'feature';
  error: Error;
}

export type SDKEventType =
  | 'initialized'
  | 'vr-started'
  | 'vr-ended'
  | 'error'
  | 'battery-low'
  | 'disposed';

export interface SDKEventMap {
  'initialized': CustomEvent<InitializedEventDetail>;
  'vr-started': CustomEvent<VRStartedEventDetail>;
  'vr-ended': CustomEvent<void>;
  'error': CustomEvent<ErrorEventDetail>;
  'battery-low': CustomEvent<{ level: number }>;
  'disposed': CustomEvent<void>;
}

// Main SDK Class

export class QuiVRSDK {
  /** SDK version */
  readonly version: string;

  /** Configuration options */
  readonly options: QuiVRSDKOptions;

  /** Initialization state */
  readonly initialized: boolean;

  /** VR mode state */
  readonly inVR: boolean;

  /** Feature support */
  readonly features: CompatibilityInfo;

  /** Current metrics */
  readonly metrics: VRMetrics;

  /**
   * Create new Qui VR SDK instance
   * @param options Configuration options
   */
  constructor(options?: QuiVRSDKOptions);

  /**
   * Initialize SDK - One call to rule them all
   * @returns Promise<boolean> Success status
   */
  initialize(): Promise<boolean>;

  /**
   * Enter VR mode
   * @returns Promise<XRSession> XR session
   * @throws Error if SDK not initialized or VR not available
   */
  enterVR(): Promise<XRSession>;

  /**
   * Exit VR mode
   * @returns Promise<void>
   */
  exitVR(): Promise<void>;

  /**
   * Get current metrics
   * @returns VRMetrics Current performance and system metrics
   */
  getMetrics(): VRMetrics;

  /**
   * Get system info
   * @returns SystemInfo System capabilities and configuration
   */
  getSystemInfo(): SystemInfo;

  /**
   * Listen to SDK event
   * @param event Event name
   * @param callback Event callback
   */
  on<K extends SDKEventType>(
    event: K,
    callback: (event: SDKEventMap[K]) => void
  ): void;

  /**
   * Remove event listener
   * @param event Event name
   * @param callback Event callback
   */
  off<K extends SDKEventType>(
    event: K,
    callback: (event: SDKEventMap[K]) => void
  ): void;

  /**
   * Cleanup and dispose SDK
   * @returns Promise<void>
   */
  dispose(): Promise<void>;

  // Internal methods (not exposed in public API)
  private applyPreset(): void;
  private checkCompatibility(): Promise<CompatibilityInfo>;
  private initializeRenderer(): Promise<void>;
  private initializePerformance(): Promise<void>;
  private initializeFeatures(): Promise<void>;
  private initializeBilling(): Promise<void>;
  private emit(event: SDKEventType, detail?: any): void;
  private log(...args: any[]): void;
  private error(...args: any[]): void;
}

// Static Properties

export namespace QuiVRSDK {
  /**
   * Quick start helper - Create and initialize SDK in one call
   * @param preset Configuration preset
   * @returns Promise<QuiVRSDK> Initialized SDK instance
   */
  export function quickStart(preset?: PresetType): Promise<QuiVRSDK>;

  /** SDK version string */
  export const version: string;

  /** Feature list */
  export const features: string[];
}

// WebXR Types (Extended)

declare global {
  interface Navigator {
    xr?: XRSystem;
    gpu?: GPU;
    getBattery?(): Promise<BatteryManager>;
  }

  interface XRSystem {
    isSessionSupported(mode: XRSessionMode): Promise<boolean>;
    requestSession(
      mode: XRSessionMode,
      options?: XRSessionInit
    ): Promise<XRSession>;
  }

  interface XRSession {
    enabledFeatures?: string[];
    depthDataFormat?: string;
    depthUsage?: string;
    requestHitTestSource(options: any): Promise<XRHitTestSource>;
  }

  interface XRFrame {
    getDepthInformation(view: XRView): XRDepthInformation | null;
    getHitTestResults(source: XRHitTestSource): XRHitTestResult[];
  }

  interface XRView {
    eye: 'left' | 'right' | 'none';
  }

  interface XRDepthInformation {
    width: number;
    height: number;
    data?: ArrayBuffer;
    normDepthBufferFromNormView?: XRRigidTransform;
    getDepth(x: number, y: number): number;
  }

  interface XRHitTestSource {
    cancel(): void;
  }

  interface XRHitTestResult {
    getPose(baseSpace: XRReferenceSpace): XRPose | null;
  }

  interface XRPose {
    transform: XRRigidTransform;
  }

  interface XRRigidTransform {
    position: DOMPointReadOnly;
    orientation: DOMPointReadOnly;
    matrix: Float32Array;
  }

  interface GPU {
    requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
  }

  interface GPUAdapter {
    requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
  }

  interface BatteryManager extends EventTarget {
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
    level: number;
    onchargingchange: ((this: BatteryManager, ev: Event) => any) | null;
    onchargingtimechange: ((this: BatteryManager, ev: Event) => any) | null;
    ondischargingtimechange: ((this: BatteryManager, ev: Event) => any) | null;
    onlevelchange: ((this: BatteryManager, ev: Event) => any) | null;
  }
}

// Module System Support

export default QuiVRSDK;

// AMD Support
declare module 'qui-browser-vr' {
  export = QuiVRSDK;
}
