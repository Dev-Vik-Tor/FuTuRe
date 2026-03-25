/**
 * Multi-Level Cache
 * Implement in-memory and distributed caching layers
 */

export class MultiLevelCache {
  constructor(options = {}) {
    this.l1 = new Map(); // In-memory cache
    this.l2 = options.l2 || null; // Distributed cache (Redis, etc.)
    this.ttl = options.ttl || 3600000; // 1 hour default
    this.stats = { hits: 0, misses: 0, sets: 0 };
  }

  async get(key) {
    // Try L1 first
    if (this.l1.has(key)) {
      const entry = this.l1.get(key);
      if (entry.expires > Date.now()) {
        this.stats.hits++;
        return entry.value;
      }
      this.l1.delete(key);
    }

    // Try L2
    if (this.l2) {
      try {
        const value = await this.l2.get(key);
        if (value) {
          this.l1.set(key, { value, expires: Date.now() + this.ttl });
          this.stats.hits++;
          return value;
        }
      } catch (error) {
        // L2 failure, continue
      }
    }

    this.stats.misses++;
    return null;
  }

  async set(key, value, ttl = this.ttl) {
    this.l1.set(key, { value, expires: Date.now() + ttl });

    if (this.l2) {
      try {
        await this.l2.set(key, value, ttl);
      } catch (error) {
        // L2 failure, continue with L1
      }
    }

    this.stats.sets++;
  }

  async delete(key) {
    this.l1.delete(key);
    if (this.l2) {
      try {
        await this.l2.delete(key);
      } catch (error) {
        // L2 failure
      }
    }
  }

  async clear() {
    this.l1.clear();
    if (this.l2) {
      try {
        await this.l2.clear();
      } catch (error) {
        // L2 failure
      }
    }
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : '0%',
      size: this.l1.size,
    };
  }
}

export const createMultiLevelCache = (options) => new MultiLevelCache(options);
