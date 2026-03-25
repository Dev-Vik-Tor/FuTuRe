/**
 * Cache Optimization Algorithms
 * Implement LRU, LFU, and other optimization strategies
 */

export class CacheOptimizer {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessCount = new Map();
    this.lastAccess = new Map();
  }

  // Least Recently Used eviction
  evictLRU() {
    if (this.cache.size <= this.maxSize) return null;

    let lruKey = null;
    let lruTime = Infinity;

    for (const key of this.cache.keys()) {
      const lastTime = this.lastAccess.get(key) || 0;
      if (lastTime < lruTime) {
        lruTime = lastTime;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessCount.delete(lruKey);
      this.lastAccess.delete(lruKey);
    }

    return lruKey;
  }

  // Least Frequently Used eviction
  evictLFU() {
    if (this.cache.size <= this.maxSize) return null;

    let lfuKey = null;
    let lfuCount = Infinity;

    for (const key of this.cache.keys()) {
      const count = this.accessCount.get(key) || 0;
      if (count < lfuCount) {
        lfuCount = count;
        lfuKey = key;
      }
    }

    if (lfuKey) {
      this.cache.delete(lfuKey);
      this.accessCount.delete(lfuKey);
      this.lastAccess.delete(lfuKey);
    }

    return lfuKey;
  }

  set(key, value, strategy = 'lru') {
    // Don't evict if key already exists
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      const evicted = strategy === 'lfu' ? this.evictLFU() : this.evictLRU();
    }

    this.cache.set(key, value);
    this.accessCount.set(key, 0);
    this.lastAccess.set(key, Date.now());
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
    this.lastAccess.set(key, Date.now());

    return this.cache.get(key);
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilizationRate: ((this.cache.size / this.maxSize) * 100).toFixed(2) + '%',
    };
  }

  getHotKeys(limit = 10) {
    return Array.from(this.accessCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => ({ key, accessCount: count }));
  }
}

export const createCacheOptimizer = (maxSize) => new CacheOptimizer(maxSize);
