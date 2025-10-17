const path = require('path');
const DataManager = require('../utils/data-manager');

class ExtensionManager {
  constructor(options = {}) {
    const dataDir = options.dataDir || path.join(__dirname, '..', 'data');
    this.dataManager = new DataManager({ dataDir });
    this.extensionsFile = options.extensionsFile || 'extensions.json';
  }

  async listExtensions() {
    const extensions = await this.dataManager.read(this.extensionsFile, []);
    return Array.isArray(extensions) ? extensions : [];
  }

  async getExtensionById(id) {
    const extensions = await this.listExtensions();
    return extensions.find(ext => ext.id === id) || null;
  }

  async saveExtensions(extensions) {
    await this.dataManager.write(this.extensionsFile, extensions);
  }

  async installExtension(payload) {
    const extensions = await this.listExtensions();
    const exists = extensions.find(ext => ext.id === payload.id);
    if (exists) {
      throw new Error(`Extension with id ${payload.id} already exists`);
    }

    const timestamp = Date.now();
    const newExtension = {
      id: payload.id,
      name: payload.name || payload.id,
      description: payload.description || '',
      version: payload.version || '1.0.0',
      homepageUrl: payload.homepageUrl || '',
      enabled: payload.enabled !== false,
      manifest: payload.manifest || {},
      installedAt: timestamp,
      updatedAt: timestamp
    };

    extensions.push(newExtension);
    await this.saveExtensions(extensions);
    return newExtension;
  }

  async updateExtension(id, updates) {
    const extensions = await this.listExtensions();
    const index = extensions.findIndex(ext => ext.id === id);
    if (index === -1) {
      throw new Error(`Extension with id ${id} not found`);
    }

    const updated = {
      ...extensions[index],
      ...updates,
      updatedAt: Date.now()
    };
    extensions[index] = updated;
    await this.saveExtensions(extensions);
    return updated;
  }

  async removeExtension(id) {
    const extensions = await this.listExtensions();
    const filtered = extensions.filter(ext => ext.id !== id);
    if (filtered.length === extensions.length) {
      throw new Error(`Extension with id ${id} not found`);
    }
    await this.saveExtensions(filtered);
    return true;
  }
}

module.exports = ExtensionManager;
