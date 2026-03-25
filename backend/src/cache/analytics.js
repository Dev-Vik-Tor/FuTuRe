/**
 * Cache Analytics
 * Track and analyze cache performance metrics
 */

export class CacheAnalytics {
  constructor() {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
    };
    this.timeline = [];
    this.keyMetrics = new Map();
  }

  recordHit(key) {
    this.metrics.hits++;
    this.recordKeyMetric(key, 'hit');
    this.recordTimeline('hit', key);
  }

  recordMiss(key) {
    this.metrics.misses++;
    this.recordKeyMetric(key, 'miss');
    this.recordTimeline('miss', key);
  }

  recordSet(key, size) {
    this.metrics.sets++;
    this.recordKeyMetric(key, 'set', size);
    this.recordTimeline('set', key, size);
  }

  recordDelete(key) {
    this.metrics.deletes++;
    this.recordKeyMetric(key, 'delete');
    this.recordTimeline('delete', key);
  }

  recordEviction(key) {
    this.metrics.evictions++;
    this.recordKeyMetric(key, 'eviction');
    this.recordTimeline('eviction', key);
  }

  recordKeyMetric(key, operation, size = 0) {
    if (!this.keyMetrics.has(key)) {
      this.keyMetrics.set(key, { hits: 0, misses: 0, sets: 0, deletes: 0, totalSize: 0 });
    }

    const metric = this.keyMetrics.get(key);
    if (operation === 'hit') metric.hits++;
    if (operation === 'miss') metric.misses++;
    if (operation === 'set') {
      metric.sets++;
      metric.totalSize += size;
    }
    if (operation === 'delete') metric.deletes++;
  }

  recordTimeline(operation, key, size = 0) {
    this.timeline.push({
      timestamp: Date.now(),
      operation,
      key,
      size,
    });

    // Keep only last 1000 entries
    if (this.timeline.length > 1000) {
      this.timeline.shift();
    }
  }

  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? ((this.metrics.hits / total) * 100).toFixed(2) + '%' : '0%',
      missRate: total > 0 ? ((this.metrics.misses / total) * 100).toFixed(2) + '%' : '0%',
    };
  }

  getKeyMetrics(key) {
    return this.keyMetrics.get(key) || null;
  }

  getTopKeys(limit = 10) {
    return Array.from(this.keyMetrics.entries())
      .sort((a, b) => (b[1].hits + b[1].misses) - (a[1].hits + a[1].misses))
      .slice(0, limit)
      .map(([key, metrics]) => ({ key, ...metrics }));
  }

  getTimeline(limit = 100) {
    return this.timeline.slice(-limit);
  }

  reset() {
    this.metrics = { hits: 0, misses: 0, sets: 0, deletes: 0, evictions: 0 };
    this.timeline = [];
    this.keyMetrics.clear();
  }
}

export const createCacheAnalytics = () => new CacheAnalytics();
