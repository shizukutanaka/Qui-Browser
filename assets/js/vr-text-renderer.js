/**
 * VR Text Renderer
 * Optimized text rendering for VR devices with readability focus
 * Based on Meta Quest and WebXR best practices
 * @version 2.0.0
 */

class VRTextRenderer {
    constructor() {
        // Text sizing constants (based on research)
        this.MINIMUM_FONT_SIZE = 1.33; // degrees visual angle
        this.RECOMMENDED_FONT_SIZE = 3.45; // degrees visual angle
        this.OPTIMAL_VIEW_DISTANCE = 2.0; // meters (comfortable viewing)
        this.MAX_LINE_LENGTH = 40; // characters per line
        this.MIN_LINE_LENGTH = 20; // characters per line

        // Text scaling at different distances
        this.distanceScaling = {
            close: { distance: 0.5, scale: 1.0 },
            comfortable: { distance: 2.0, scale: 1.5 },
            far: { distance: 5.0, scale: 3.0 }
        };

        // Typography settings
        this.typography = {
            fontFamily: 'Arial, Helvetica, sans-serif', // Sans-serif for VR
            fontWeight: 500, // Medium weight (avoid thin)
            lineHeight: 1.4,
            letterSpacing: 0.02, // Slight spacing for clarity
            textAlign: 'left',
            wordWrap: 'break-word'
        };

        // Color contrast ratios (WCAG AAA for VR)
        this.contrast = {
            text: '#FFFFFF',
            background: '#1a1a2e',
            accent: '#00ffff',
            error: '#ff4444',
            success: '#44ff44',
            minContrastRatio: 7.0 // AAA level
        };

        // Canvas cache for performance
        this.canvasCache = new Map();
        this.maxCacheSize = 100;
    }

    /**
     * Calculate optimal font size for VR based on viewing distance
     * @param {number} distance - Distance from viewer in meters
     * @returns {number} Font size in pixels
     */
    calculateFontSize(distance = this.OPTIMAL_VIEW_DISTANCE) {
        // Convert visual angle to physical size at distance
        // Formula: size = 2 * distance * tan(angle/2)
        const angleRadians = (this.RECOMMENDED_FONT_SIZE * Math.PI) / 180;
        const physicalSize = 2 * distance * Math.tan(angleRadians / 2);

        // Convert to pixels (approximate: 1cm = 37.8 pixels at 96 DPI)
        const pixelSize = physicalSize * 100 * 37.8;

        // Clamp to reasonable range
        return Math.max(32, Math.min(128, Math.round(pixelSize)));
    }

    /**
     * Calculate angular size for object at distance
     * @param {number} objectHeight - Height in meters
     * @param {number} distance - Distance in meters
     * @returns {number} Angular size in degrees
     */
    calculateAngularSize(objectHeight, distance) {
        const angleRadians = 2 * Math.atan(objectHeight / (2 * distance));
        return (angleRadians * 180) / Math.PI;
    }

    /**
     * Create readable text canvas for VR
     * @param {string} text - Text content
     * @param {Object} options - Rendering options
     * @returns {HTMLCanvasElement}
     */
    createTextCanvas(text, options = {}) {
        const {
            fontSize = this.calculateFontSize(),
            maxWidth = 1024,
            color = this.contrast.text,
            backgroundColor = this.contrast.background,
            padding = 20,
            fontWeight = this.typography.fontWeight,
            textAlign = this.typography.textAlign,
            lineHeight = this.typography.lineHeight
        } = options;

        // Check cache
        const cacheKey = JSON.stringify({ text, fontSize, maxWidth, color });
        if (this.canvasCache.has(cacheKey)) {
            return this.canvasCache.get(cacheKey);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set font for measurement
        ctx.font = `${fontWeight} ${fontSize}px ${this.typography.fontFamily}`;

        // Calculate line breaks
        const lines = this.wrapText(ctx, text, maxWidth - padding * 2);

        // Calculate canvas size
        const lineHeightPx = fontSize * lineHeight;
        canvas.width = maxWidth;
        canvas.height = Math.ceil(lines.length * lineHeightPx + padding * 2);

        // Fill background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Configure text rendering
        ctx.font = `${fontWeight} ${fontSize}px ${this.typography.fontFamily}`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'top';
        ctx.textAlign = textAlign;

        // Anti-aliasing for better readability
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Render text lines
        const startX = textAlign === 'center' ? canvas.width / 2 : padding;
        let y = padding;

        lines.forEach(line => {
            ctx.fillText(line, startX, y);
            y += lineHeightPx;
        });

        // Cache the result
        this.cacheCanvas(cacheKey, canvas);

        return canvas;
    }

    /**
     * Wrap text to fit within max width
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} text - Text to wrap
     * @param {number} maxWidth - Maximum width
     * @returns {string[]} Array of text lines
     */
    wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    }

    /**
     * Create Three.js text texture
     * @param {string} text - Text content
     * @param {Object} options - Rendering options
     * @returns {THREE.Texture}
     */
    createTextTexture(text, options = {}) {
        const canvas = this.createTextCanvas(text, options);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * Create Three.js text sprite
     * @param {string} text - Text content
     * @param {Object} options - Rendering options
     * @returns {THREE.Sprite}
     */
    createTextSprite(text, options = {}) {
        const {
            scale = 1.0,
            distance = this.OPTIMAL_VIEW_DISTANCE
        } = options;

        const texture = this.createTextTexture(text, options);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: true
        });

        const sprite = new THREE.Sprite(material);

        // Calculate scale based on angular size
        const canvas = texture.image;
        const aspect = canvas.width / canvas.height;
        const height = this.calculateOptimalHeight(distance) * scale;

        sprite.scale.set(height * aspect, height, 1);

        return sprite;
    }

    /**
     * Calculate optimal height for object at distance
     * @param {number} distance - Distance in meters
     * @returns {number} Height in scene units
     */
    calculateOptimalHeight(distance) {
        // Target angular size of 3.45 degrees
        const angleRadians = (this.RECOMMENDED_FONT_SIZE * Math.PI) / 180;
        return 2 * distance * Math.tan(angleRadians / 2);
    }

    /**
     * Create multi-line text panel
     * @param {string} text - Text content
     * @param {Object} options - Panel options
     * @returns {THREE.Mesh}
     */
    createTextPanel(text, options = {}) {
        const {
            width = 2.0,
            padding = 0.1,
            distance = this.OPTIMAL_VIEW_DISTANCE
        } = options;

        const canvas = this.createTextCanvas(text, {
            ...options,
            maxWidth: 1024
        });

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const aspect = canvas.width / canvas.height;
        const height = width / aspect;

        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        return mesh;
    }

    /**
     * Create button with text
     * @param {string} text - Button text
     * @param {Object} options - Button options
     * @returns {THREE.Group}
     */
    createButton(text, options = {}) {
        const {
            width = 0.4,
            height = 0.15,
            padding = 0.02,
            backgroundColor = this.contrast.accent,
            textColor = '#000000',
            fontSize = 48
        } = options;

        const group = new THREE.Group();

        // Button background
        const bgGeometry = new THREE.PlaneGeometry(width, height);
        const bgMaterial = new THREE.MeshBasicMaterial({
            color: backgroundColor,
            transparent: true,
            opacity: 0.9
        });
        const background = new THREE.Mesh(bgGeometry, bgMaterial);
        group.add(background);

        // Button text
        const textSprite = this.createTextSprite(text, {
            fontSize,
            color: textColor,
            backgroundColor: 'transparent',
            maxWidth: (width - padding * 2) * 512
        });
        textSprite.position.z = 0.01;
        group.add(textSprite);

        // Store metadata
        group.userData.isButton = true;
        group.userData.text = text;

        return group;
    }

    /**
     * Calculate contrast ratio between two colors
     * @param {string} color1 - First color (hex)
     * @param {string} color2 - Second color (hex)
     * @returns {number} Contrast ratio
     */
    calculateContrastRatio(color1, color2) {
        const lum1 = this.getRelativeLuminance(color1);
        const lum2 = this.getRelativeLuminance(color2);
        const lighter = Math.max(lum1, lum2);
        const darker = Math.min(lum1, lum2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    /**
     * Get relative luminance of color
     * @param {string} color - Color (hex)
     * @returns {number} Relative luminance
     */
    getRelativeLuminance(color) {
        const rgb = this.hexToRgb(color);
        const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
            val = val / 255;
            return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    /**
     * Convert hex color to RGB
     * @param {string} hex - Hex color
     * @returns {Object} RGB values
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * Cache canvas for reuse
     * @param {string} key - Cache key
     * @param {HTMLCanvasElement} canvas - Canvas to cache
     */
    cacheCanvas(key, canvas) {
        if (this.canvasCache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.canvasCache.keys().next().value;
            this.canvasCache.delete(firstKey);
        }
        this.canvasCache.set(key, canvas);
    }

    /**
     * Clear canvas cache
     */
    clearCache() {
        this.canvasCache.clear();
    }

    /**
     * Get recommended font size for distance
     * @param {number} distance - Distance in meters
     * @returns {Object} Font size recommendations
     */
    getFontSizeRecommendations(distance) {
        return {
            minimum: this.calculateFontSize(distance) * 0.7,
            recommended: this.calculateFontSize(distance),
            large: this.calculateFontSize(distance) * 1.5,
            distance
        };
    }

    /**
     * Validate text readability
     * @param {string} text - Text to validate
     * @param {Object} options - Validation options
     * @returns {Object} Validation results
     */
    validateReadability(text, options = {}) {
        const {
            fontSize = this.calculateFontSize(),
            distance = this.OPTIMAL_VIEW_DISTANCE,
            textColor = this.contrast.text,
            backgroundColor = this.contrast.background
        } = options;

        const results = {
            isValid: true,
            warnings: [],
            recommendations: []
        };

        // Check font size
        const minSize = this.calculateFontSize(distance) * 0.7;
        if (fontSize < minSize) {
            results.isValid = false;
            results.warnings.push(`Font size too small (${fontSize}px < ${minSize.toFixed(0)}px)`);
        }

        // Check line length
        const lineLength = text.split('\n')[0]?.length || 0;
        if (lineLength > this.MAX_LINE_LENGTH) {
            results.warnings.push(`Line too long (${lineLength} > ${this.MAX_LINE_LENGTH} chars)`);
            results.recommendations.push('Break text into shorter lines');
        }

        // Check contrast
        const contrastRatio = this.calculateContrastRatio(textColor, backgroundColor);
        if (contrastRatio < this.contrast.minContrastRatio) {
            results.isValid = false;
            results.warnings.push(`Insufficient contrast (${contrastRatio.toFixed(2)} < ${this.contrast.minContrastRatio})`);
        }

        return results;
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VRTextRenderer = VRTextRenderer;
}
