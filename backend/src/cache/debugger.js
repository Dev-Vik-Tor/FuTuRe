/**
 * Cache Debugging Tools
 * Debug and inspect cache state
 */

export class CacheDebugger {
  constructor(cache) {
    this.cache = cache;
    this.snapshots = [];
  }

  inspect() {
    const stats = this.cache.getStats ? this.cache.getStats() : {};
    return {
      timestamp: new Date().toISOString(),
      stats,
      l1Size: this.cache.l1 ? this.cache.l1.size : 0,
    };
  }

  takeSnapshot(label = '') {
    const snapshot = {
      label,
      timestamp: Date.now(),
      data: this.inspect(),
    };

    this.snapshots.push(snapshot);

    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  compareSnapshots(index1, index2) {
    const snap1 = this.snapshots[index1];
    const snap2 = this.snapshots[index2];

    if (!snap1 || !snap2) return null;

    return {
      snapshot1: snap1.label,
      snapshot2: snap2.label,
      timeDiff: snap2.timestamp - snap1.timestamp,
      statsDiff: {
        hits: (snap2.data.stats.hits || 0) - (snap1.data.stats.hits || 0),
        misses: (snap2.data.stats.misses || 0) - (snap1.data.stats.misses || 0),
        sets: (snap2.data.stats.sets || 0) - (snap1.data.stats.sets || 0),
      },
    };
  }

  getSnapshots() {
    return this.snapshots;
  }

  dumpCache() {
    if (!this.cache.l1) return null;

    const entries = [];
    for (const [key, entry] of this.cache.l1.entries()) {
      entries.push({
        key,
        expired: entry.expires <= Date.now(),
        ttl: Math.max(0, entry.expires - Date.now()),
      });
    }

    return {
      totalEntries: entries.length,
      entries: entries.slice(0, 100), // First 100
    };
  }

  findLeaks() {
    if (!this.cache.l1) return [];

    const leaks = [];
    for (const [key, entry] of this.cache.l1.entries()) {
      if (entry.expires <= Date.now()) {
        leaks.push({ key, expiredAt: new Date(entry.expires).toISOString() });
      }
    }

    return leaks;
  }

  clearSnapshots() {
    this.snapshots = [];
  }
}

export const createCacheDebugger = (cache) => new CacheDebugger(cache);
