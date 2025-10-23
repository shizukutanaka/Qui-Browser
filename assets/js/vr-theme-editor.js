/**
 * VR Theme Editor
 * Create and edit custom themes for the VR browser
 * @version 2.0.0
 */

class VRThemeEditor {
    constructor() {
        // Current theme data
        this.currentTheme = {};
        this.originalTheme = {};

        // Theme properties
        this.themeProperties = {
            // Color scheme
            primaryColor: { type: 'color', default: '#0052cc', category: 'colors' },
            secondaryColor: { type: 'color', default: '#6c757d', category: 'colors' },
            accentColor: { type: 'color', default: '#28a745', category: 'colors' },
            backgroundColor: { type: 'color', default: '#ffffff', category: 'colors' },
            surfaceColor: { type: 'color', default: '#f8f9fa', category: 'colors' },
            textColor: { type: 'color', default: '#212529', category: 'colors' },
            textSecondaryColor: { type: 'color', default: '#6c757d', category: 'colors' },

            // VR specific colors
            vrBackgroundColor: { type: 'color', default: '#000000', category: 'vr-colors' },
            vrUiColor: { type: 'color', default: '#ffffff', category: 'vr-colors' },
            vrAccentColor: { type: 'color', default: '#00ff88', category: 'vr-colors' },

            // Typography
            fontFamily: { type: 'select', options: ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'], default: 'Arial', category: 'typography' },
            fontSize: { type: 'range', min: 12, max: 24, default: 16, category: 'typography' },
            lineHeight: { type: 'range', min: 1, max: 2, step: 0.1, default: 1.5, category: 'typography' },

            // VR UI settings
            vrFontSize: { type: 'range', min: 0.8, max: 2.0, step: 0.1, default: 1.2, category: 'vr-ui' },
            vrElementSpacing: { type: 'range', min: 0.5, max: 2.0, step: 0.1, default: 1.0, category: 'vr-ui' },
            vrBorderRadius: { type: 'range', min: 0, max: 1.0, step: 0.1, default: 0.2, category: 'vr-ui' },

            // Environment settings
            environmentTheme: { type: 'select', options: ['space', 'forest', 'ocean', 'minimal', 'sunset', 'cyberpunk'], default: 'space', category: 'environment' },
            environmentBrightness: { type: 'range', min: 0.1, max: 2.0, step: 0.1, default: 1.0, category: 'environment' },

            // Animation settings
            animationSpeed: { type: 'range', min: 0.1, max: 3.0, step: 0.1, default: 1.0, category: 'animations' },
            transitionDuration: { type: 'range', min: 0.1, max: 1.0, step: 0.1, default: 0.3, category: 'animations' }
        };

        // Presets for quick themes
        this.themePresets = {
            default: {
                name: 'デフォルト',
                description: '標準的なテーマ',
                properties: {}
            },
            dark: {
                name: 'ダークモード',
                description: '暗い背景と明るいテキスト',
                properties: {
                    backgroundColor: '#121212',
                    surfaceColor: '#1e1e1e',
                    textColor: '#ffffff',
                    textSecondaryColor: '#b3b3b3',
                    vrBackgroundColor: '#000000',
                    vrUiColor: '#ffffff',
                    vrAccentColor: '#bb86fc'
                }
            },
            highContrast: {
                name: 'ハイコントラスト',
                description: '視認性の高いコントラスト',
                properties: {
                    backgroundColor: '#000000',
                    textColor: '#ffffff',
                    primaryColor: '#ffff00',
                    accentColor: '#00ffff',
                    vrUiColor: '#ffffff',
                    vrAccentColor: '#ffff00'
                }
            },
            nature: {
                name: 'ネイチャー',
                description: '自然をイメージした緑系カラー',
                properties: {
                    primaryColor: '#2d5016',
                    secondaryColor: '#4a7c59',
                    accentColor: '#7cb342',
                    backgroundColor: '#f1f8e9',
                    vrAccentColor: '#8bc34a',
                    environmentTheme: 'forest'
                }
            },
            cyberpunk: {
                name: 'サイバーパンク',
                description: '未来的なネオンカラー',
                properties: {
                    primaryColor: '#ff0080',
                    secondaryColor: '#00ffff',
                    accentColor: '#8000ff',
                    backgroundColor: '#0a0a0a',
                    vrAccentColor: '#ff0080',
                    environmentTheme: 'cyberpunk'
                }
            }
        };

        // Event callbacks
        this.callbacks = {};

        this.loadCurrentTheme();
    }

    /**
     * Create new theme
     * @param {string} name - Theme name
     * @param {string} description - Theme description
     * @returns {string} Theme ID
     */
    createTheme(name, description = '') {
        const themeId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const theme = {
            id: themeId,
            name,
            description,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            properties: {}
        };

        this.currentTheme = theme;
        this.originalTheme = { ...theme };

        this.triggerCallback('themeCreated', theme);
        return themeId;
    }

    /**
     * Load theme for editing
     * @param {string} themeId - Theme ID
     */
    loadTheme(themeId) {
        let theme;

        if (themeId.startsWith('preset_')) {
            const presetName = themeId.replace('preset_', '');
            theme = this.themePresets[presetName];
            if (theme) {
                theme = {
                    id: themeId,
                    name: theme.name,
                    description: theme.description,
                    properties: { ...theme.properties }
                };
            }
        } else {
            // Load from storage
            theme = this.getStoredTheme(themeId);
        }

        if (theme) {
            this.currentTheme = { ...theme };
            this.originalTheme = { ...theme };
            this.applyThemePreview();
            this.triggerCallback('themeLoaded', theme);
        }
    }

    /**
     * Save current theme
     */
    saveTheme() {
        if (!this.currentTheme.id) return;

        this.currentTheme.modified = new Date().toISOString();
        this.saveThemeToStorage(this.currentTheme);

        // Apply the theme
        this.applyTheme(this.currentTheme);

        this.triggerCallback('themeSaved', this.currentTheme);
    }

    /**
     * Update theme property
     * @param {string} property - Property name
     * @param {*} value - Property value
     */
    updateProperty(property, value) {
        if (!this.currentTheme.properties) {
            this.currentTheme.properties = {};
        }

        this.currentTheme.properties[property] = value;
        this.applyThemePreview();

        this.triggerCallback('propertyUpdated', { property, value });
    }

    /**
     * Reset property to default
     * @param {string} property - Property name
     */
    resetProperty(property) {
        const defaultValue = this.themeProperties[property].default;
        this.updateProperty(property, defaultValue);
    }

    /**
     * Reset all properties to defaults
     */
    resetAllProperties() {
        for (const [property, config] of Object.entries(this.themeProperties)) {
            this.updateProperty(property, config.default);
        }
    }

    /**
     * Apply theme preview (temporary)
     */
    applyThemePreview() {
        const properties = {
            ...this.getDefaultProperties(),
            ...this.currentTheme.properties
        };

        this.setCSSProperties(properties);
    }

    /**
     * Apply theme permanently
     * @param {Object} theme - Theme object
     */
    applyTheme(theme) {
        const properties = {
            ...this.getDefaultProperties(),
            ...theme.properties
        };

        this.setCSSProperties(properties);

        // Save as active theme
        localStorage.setItem('vr-active-theme', JSON.stringify(theme));

        // Update environment if changed
        if (theme.properties.environmentTheme) {
            this.updateEnvironment(theme.properties.environmentTheme);
        }

        this.triggerCallback('themeApplied', theme);
    }

    /**
     * Set CSS custom properties
     * @param {Object} properties - Theme properties
     */
    setCSSProperties(properties) {
        const root = document.documentElement;

        for (const [property, value] of Object.entries(properties)) {
            const cssVar = `--${property.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            root.style.setProperty(cssVar, value);
        }
    }

    /**
     * Update VR environment
     * @param {string} environment - Environment name
     */
    updateEnvironment(environment) {
        // This would integrate with vr-environment-customizer.js
        if (typeof VREnvironmentCustomizer !== 'undefined') {
            VREnvironmentCustomizer.setEnvironment(environment);
        }
    }

    /**
     * Export theme as JSON
     * @returns {string} Theme JSON
     */
    exportTheme() {
        return JSON.stringify(this.currentTheme, null, 2);
    }

    /**
     * Import theme from JSON
     * @param {string} themeJson - Theme JSON string
     * @returns {boolean} Import success
     */
    importTheme(themeJson) {
        try {
            const theme = JSON.parse(themeJson);
            this.validateTheme(theme);

            this.currentTheme = theme;
            this.applyThemePreview();

            this.triggerCallback('themeImported', theme);
            return true;
        } catch (error) {
            console.error('[VR Theme Editor] Import failed:', error);
            return false;
        }
    }

    /**
     * Validate theme object
     * @param {Object} theme - Theme object
     * @throws {Error} Validation error
     */
    validateTheme(theme) {
        if (!theme.name || !theme.properties) {
            throw new Error('Invalid theme format');
        }

        // Validate properties
        for (const [property, value] of Object.entries(theme.properties)) {
            if (!this.themeProperties[property]) {
                console.warn(`Unknown theme property: ${property}`);
                continue;
            }

            const config = this.themeProperties[property];

            if (config.type === 'color' && !this.isValidColor(value)) {
                throw new Error(`Invalid color value for ${property}: ${value}`);
            }

            if (config.type === 'range') {
                if (value < config.min || value > config.max) {
                    throw new Error(`Invalid range value for ${property}: ${value}`);
                }
            }

            if (config.type === 'select' && config.options && !config.options.includes(value)) {
                throw new Error(`Invalid select value for ${property}: ${value}`);
            }
        }
    }

    /**
     * Check if value is valid color
     * @param {string} value - Color value
     * @returns {boolean}
     */
    isValidColor(value) {
        const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        return colorRegex.test(value);
    }

    /**
     * Get default properties
     * @returns {Object} Default theme properties
     */
    getDefaultProperties() {
        const defaults = {};
        for (const [property, config] of Object.entries(this.themeProperties)) {
            defaults[property] = config.default;
        }
        return defaults;
    }

    /**
     * Get theme properties by category
     * @param {string} category - Category name
     * @returns {Object} Properties in category
     */
    getPropertiesByCategory(category) {
        const properties = {};
        for (const [property, config] of Object.entries(this.themeProperties)) {
            if (config.category === category) {
                properties[property] = config;
            }
        }
        return properties;
    }

    /**
     * Get available presets
     * @returns {Array} Preset list
     */
    getPresets() {
        return Object.entries(this.themePresets).map(([id, preset]) => ({
            id: `preset_${id}`,
            name: preset.name,
            description: preset.description,
            preview: preset.properties
        }));
    }

    /**
     * Load current theme from storage or use default
     */
    loadCurrentTheme() {
        try {
            const saved = localStorage.getItem('vr-active-theme');
            if (saved) {
                const theme = JSON.parse(saved);
                this.applyTheme(theme);
            }
        } catch (error) {
            console.error('[VR Theme Editor] Failed to load current theme:', error);
        }
    }

    /**
     * Save theme to storage
     * @param {Object} theme - Theme object
     */
    saveThemeToStorage(theme) {
        try {
            const themes = this.getStoredThemes();
            themes[theme.id] = theme;
            localStorage.setItem('vr-custom-themes', JSON.stringify(themes));
        } catch (error) {
            console.error('[VR Theme Editor] Failed to save theme:', error);
        }
    }

    /**
     * Get stored theme
     * @param {string} themeId - Theme ID
     * @returns {Object|null} Theme object
     */
    getStoredTheme(themeId) {
        try {
            const themes = this.getStoredThemes();
            return themes[themeId] || null;
        } catch (error) {
            console.error('[VR Theme Editor] Failed to get stored theme:', error);
            return null;
        }
    }

    /**
     * Get all stored themes
     * @returns {Object} Themes object
     */
    getStoredThemes() {
        try {
            const saved = localStorage.getItem('vr-custom-themes');
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('[VR Theme Editor] Failed to get stored themes:', error);
            return {};
        }
    }

    /**
     * Delete stored theme
     * @param {string} themeId - Theme ID
     */
    deleteStoredTheme(themeId) {
        try {
            const themes = this.getStoredThemes();
            delete themes[themeId];
            localStorage.setItem('vr-custom-themes', JSON.stringify(themes));

            this.triggerCallback('themeDeleted', themeId);
        } catch (error) {
            console.error('[VR Theme Editor] Failed to delete theme:', error);
        }
    }

    /**
     * Get editor statistics
     * @returns {Object} Editor stats
     */
    getStats() {
        const storedThemes = this.getStoredThemes();

        return {
            currentTheme: this.currentTheme.name || 'なし',
            totalCustomThemes: Object.keys(storedThemes).length,
            availablePresets: Object.keys(this.themePresets).length,
            propertiesCount: Object.keys(this.themeProperties).length,
            categories: Object.keys(this.themeProperties).reduce((acc, prop) => {
                const category = this.themeProperties[prop].category;
                acc[category] = (acc[category] || 0) + 1;
                return acc;
            }, {})
        };
    }

    /**
     * Add event callback
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    /**
     * Trigger callback
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    triggerCallback(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(data));
        }
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        // Reset to default theme
        this.applyTheme({ properties: this.getDefaultProperties() });
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VRThemeEditor = VRThemeEditor;
}
