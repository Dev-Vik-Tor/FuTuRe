/**
 * Distributed Cache Support
 * Support for distributed caching backends
 */

export class DistributedCache {
  constructor(backend = null) {
    this.backend = backend;
    this.connected = false;
  }

  async connect() {
    if (this.backend && typeof this.backend.connect === 'function') {
      await this.backend.connect();
      this.connected = true;
    }
  }

  async disconnect() {
    if (this.backend && typeof this.backend.disconnect === 'function') {
      await this.backend.disconnect();
      this.connected = false;
    }
  }

  async get(key) {
    if (!this.backend) return null;
    return await this.backend.get(key);
  }

  async set(key, value, ttl) {
    if (!this.backend) return;
    return await this.backend.set(key, value, ttl);
  }

  async delete(key) {
    if (!this.backend) return;
    return await this.backend.delete(key);
  }

  async clear() {
    if (!this.backend) return;
    return await this.backend.clear();
  }

  async getMultiple(keys) {
    if (!this.backend) return {};
    const result = {};
    for (const key of keys) {
      result[key] = await this.get(key);
    }
    return result;
  }

  async setMultiple(data, ttl) {
    if (!this.backend) return;
    for (const [key, value] of Object.entries(data)) {
      await this.set(key, value, ttl);
    }
  }

  isConnected() {
    return this.connected;
  }
}

export const createDistributedCache = (backend) => new DistributedCache(backend);
