/**
 * VR Utils - Common utilities and helpers for VR functionality
 * Provides shared functions for vector math, VR calculations, and utilities
 * @version 3.2.0
 */

class VRUtils {
    constructor() {
        this.DEG2RAD = Math.PI / 180;
        this.RAD2DEG = 180 / Math.PI;

        // Common VR constants
        this.COMFORT_ZONE = {
            near: 0.5,  // 0.5m minimum comfortable distance
            far: 20,    // 20m maximum render distance
            fov: 110    // Field of view in degrees
        };

        this.DEVICE_PROFILES = {
            'Quest 3': { fov: 110, ipd: 63, resolution: [2064, 2208] },
            'Quest 2': { fov: 90, ipd: 63, resolution: [1832, 1920] },
            'Pico 4': { fov: 105, ipd: 62, resolution: [2160, 2160] },
            'default': { fov: 90, ipd: 63, resolution: [1920, 1920] }
        };
    }

    // Vector Math Utilities
    vec3 = {
        create: () => new Float32Array(3),

        add: (out, a, b) => {
            out[0] = a[0] + b[0];
            out[1] = a[1] + b[1];
            out[2] = a[2] + b[2];
            return out;
        },

        subtract: (out, a, b) => {
            out[0] = a[0] - b[0];
            out[1] = a[1] - b[1];
            out[2] = a[2] - b[2];
            return out;
        },

        multiply: (out, a, scalar) => {
            out[0] = a[0] * scalar;
            out[1] = a[1] * scalar;
            out[2] = a[2] * scalar;
            return out;
        },

        normalize: (out, a) => {
            const len = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
            if (len > 0) {
                const invLen = 1 / len;
                out[0] = a[0] * invLen;
                out[1] = a[1] * invLen;
                out[2] = a[2] * invLen;
            }
            return out;
        },

        distance: (a, b) => {
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const dz = b[2] - a[2];
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        },

        dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],

        cross: (out, a, b) => {
            out[0] = a[1] * b[2] - a[2] * b[1];
            out[1] = a[2] * b[0] - a[0] * b[2];
            out[2] = a[0] * b[1] - a[1] * b[0];
            return out;
        },

        lerp: (out, a, b, t) => {
            out[0] = a[0] + (b[0] - a[0]) * t;
            out[1] = a[1] + (b[1] - a[1]) * t;
            out[2] = a[2] + (b[2] - a[2]) * t;
            return out;
        }
    };

    // Quaternion utilities
    quat = {
        create: () => new Float32Array([0, 0, 0, 1]),

        fromEuler: (out, x, y, z) => {
            const halfX = x * 0.5;
            const halfY = y * 0.5;
            const halfZ = z * 0.5;

            const cosX = Math.cos(halfX);
            const sinX = Math.sin(halfX);
            const cosY = Math.cos(halfY);
            const sinY = Math.sin(halfY);
            const cosZ = Math.cos(halfZ);
            const sinZ = Math.sin(halfZ);

            out[0] = sinX * cosY * cosZ - cosX * sinY * sinZ;
            out[1] = cosX * sinY * cosZ + sinX * cosY * sinZ;
            out[2] = cosX * cosY * sinZ - sinX * sinY * cosZ;
            out[3] = cosX * cosY * cosZ + sinX * sinY * sinZ;

            return out;
        },

        slerp: (out, a, b, t) => {
            let ax = a[0], ay = a[1], az = a[2], aw = a[3];
            let bx = b[0], by = b[1], bz = b[2], bw = b[3];

            let dot = ax * bx + ay * by + az * bz + aw * bw;

            if (dot < 0) {
                bx = -bx;
                by = -by;
                bz = -bz;
                bw = -bw;
                dot = -dot;
            }

            if (dot > 0.999) {
                out[0] = ax + (bx - ax) * t;
                out[1] = ay + (by - ay) * t;
                out[2] = az + (bz - az) * t;
                out[3] = aw + (bw - aw) * t;
                return this.normalize(out, out);
            }

            const theta = Math.acos(dot);
            const sinTheta = Math.sin(theta);
            const scale0 = Math.sin((1 - t) * theta) / sinTheta;
            const scale1 = Math.sin(t * theta) / sinTheta;

            out[0] = ax * scale0 + bx * scale1;
            out[1] = ay * scale0 + by * scale1;
            out[2] = az * scale0 + bz * scale1;
            out[3] = aw * scale0 + bw * scale1;

            return out;
        },

        normalize: (out, a) => {
            const len = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3]);
            if (len > 0) {
                const invLen = 1 / len;
                out[0] = a[0] * invLen;
                out[1] = a[1] * invLen;
                out[2] = a[2] * invLen;
                out[3] = a[3] * invLen;
            }
            return out;
        }
    };

    // Matrix utilities
    mat4 = {
        create: () => new Float32Array(16),

        identity: (out) => {
            out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
            out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
            out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
            out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
            return out;
        },

        perspective: (out, fovy, aspect, near, far) => {
            const f = 1.0 / Math.tan(fovy / 2);
            const nf = 1 / (near - far);

            out[0] = f / aspect;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            out[4] = 0;
            out[5] = f;
            out[6] = 0;
            out[7] = 0;
            out[8] = 0;
            out[9] = 0;
            out[10] = (far + near) * nf;
            out[11] = -1;
            out[12] = 0;
            out[13] = 0;
            out[14] = 2 * far * near * nf;
            out[15] = 0;

            return out;
        }
    };

    // VR-specific utilities
    calculateIPD(customIPD) {
        // Inter-pupillary distance in mm
        return customIPD || 63; // Default average IPD
    }

    calculateFOV(device = 'default') {
        const profile = this.DEVICE_PROFILES[device] || this.DEVICE_PROFILES.default;
        return profile.fov * this.DEG2RAD;
    }

    getDeviceProfile(deviceName) {
        for (const key in this.DEVICE_PROFILES) {
            if (deviceName && deviceName.includes(key)) {
                return this.DEVICE_PROFILES[key];
            }
        }
        return this.DEVICE_PROFILES.default;
    }

    // Comfort and ergonomics
    isInComfortZone(distance) {
        return distance >= this.COMFORT_ZONE.near && distance <= this.COMFORT_ZONE.far;
    }

    calculateOptimalDistance(objectSize) {
        // Calculate optimal viewing distance based on object size
        // Using visual angle of ~30 degrees for comfortable viewing
        return objectSize / (2 * Math.tan(15 * this.DEG2RAD));
    }

    // Ray casting utilities
    createRay(origin, direction) {
        return {
            origin: new Float32Array(origin),
            direction: this.vec3.normalize(new Float32Array(3), direction)
        };
    }

    rayIntersectsSphere(ray, sphereCenter, sphereRadius) {
        const oc = this.vec3.subtract(new Float32Array(3), ray.origin, sphereCenter);
        const a = this.vec3.dot(ray.direction, ray.direction);
        const b = 2.0 * this.vec3.dot(oc, ray.direction);
        const c = this.vec3.dot(oc, oc) - sphereRadius * sphereRadius;
        const discriminant = b * b - 4 * a * c;

        return discriminant >= 0;
    }

    rayIntersectsBox(ray, boxMin, boxMax) {
        let tmin = (boxMin[0] - ray.origin[0]) / ray.direction[0];
        let tmax = (boxMax[0] - ray.origin[0]) / ray.direction[0];

        if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

        for (let i = 1; i < 3; i++) {
            let tymin = (boxMin[i] - ray.origin[i]) / ray.direction[i];
            let tymax = (boxMax[i] - ray.origin[i]) / ray.direction[i];

            if (tymin > tymax) [tymin, tymax] = [tymax, tymin];

            if (tymin > tmin) tmin = tymin;
            if (tymax < tmax) tmax = tymax;

            if (tmin > tmax) return false;
        }

        return true;
    }

    // Performance utilities
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;

        return function(...args) {
            const currentTime = Date.now();

            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }

    debounce(func, delay) {
        let timeoutId;

        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    // Object pooling for performance
    createObjectPool(createFn, resetFn, initialSize = 10) {
        const pool = [];
        const active = new Set();

        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            pool.push(createFn());
        }

        return {
            get() {
                let obj = pool.pop();
                if (!obj) {
                    obj = createFn();
                }
                active.add(obj);
                return obj;
            },

            release(obj) {
                if (active.has(obj)) {
                    active.delete(obj);
                    if (resetFn) resetFn(obj);
                    pool.push(obj);
                }
            },

            releaseAll() {
                active.forEach(obj => {
                    if (resetFn) resetFn(obj);
                    pool.push(obj);
                });
                active.clear();
            },

            getActiveCount() {
                return active.size;
            },

            getPoolSize() {
                return pool.length;
            }
        };
    }

    // Texture/Canvas utilities
    createGradientTexture(width, height, colors) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        colors.forEach((color, index) => {
            gradient.addColorStop(index / (colors.length - 1), color);
        });

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        return canvas;
    }

    // Format utilities
    formatDistance(meters) {
        if (meters < 1) {
            return `${Math.round(meters * 100)}cm`;
        } else if (meters < 1000) {
            return `${meters.toFixed(1)}m`;
        } else {
            return `${(meters / 1000).toFixed(2)}km`;
        }
    }

    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Color utilities
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : null;
    }

    rgbToHex(r, g, b) {
        const toHex = (c) => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return '#' + toHex(r) + toHex(g) + toHex(b);
    }

    // Easing functions
    easing = {
        linear: t => t,
        easeInQuad: t => t * t,
        easeOutQuad: t => t * (2 - t),
        easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        easeInCubic: t => t * t * t,
        easeOutCubic: t => (--t) * t * t + 1,
        easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
        easeInElastic: t => {
            if (t === 0 || t === 1) return t;
            const p = 0.3;
            return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 2 * Math.PI / p);
        },
        easeOutElastic: t => {
            if (t === 0 || t === 1) return t;
            const p = 0.3;
            return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 2 * Math.PI / p) + 1;
        }
    };

    // Animation helper
    animate(from, to, duration, easingFn, onUpdate, onComplete) {
        const startTime = performance.now();
        const ease = this.easing[easingFn] || this.easing.linear;

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = ease(progress);

            const value = from + (to - from) * easedProgress;
            onUpdate(value, easedProgress);

            if (progress < 1) {
                requestAnimationFrame(update);
            } else if (onComplete) {
                onComplete();
            }
        };

        requestAnimationFrame(update);
    }
}

// Create and export singleton instance
window.VRUtils = new VRUtils();

console.log('✅ VR Utils loaded');