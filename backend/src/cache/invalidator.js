/**
 * Cache Invalidation Patterns
 * Implement various cache invalidation strategies
 */

export class CacheInvalidator {
  constructor(cache) {
    this.cache = cache;
    this.patterns = new Map();
    this.dependencies = new Map();
  }

  registerPattern(pattern, keys) {
    this.patterns.set(pattern, keys);
    return this;
  }

  registerDependency(key, dependentKeys) {
    this.dependencies.set(key, dependentKeys);
    return this;
  }

  async invalidateByPattern(pattern) {
    const keys = this.patterns.get(pattern);
    if (!keys) return { invalidated: 0 };

    let count = 0;
    for (const key of keys) {
      await this.cache.delete(key);
      count++;
    }

    return { pattern, invalidated: count };
  }

  async invalidateByKey(key) {
    await this.cache.delete(key);

    // Invalidate dependent keys
    const dependents = this.dependencies.get(key) || [];
    for (const dependent of dependents) {
      await this.cache.delete(dependent);
    }

    return { key, dependentsInvalidated: dependents.length };
  }

  async invalidateByTag(tag) {
    // Invalidate all keys with this tag
    const keys = Array.from(this.patterns.keys()).filter((k) => k.includes(tag));
    let count = 0;

    for (const pattern of keys) {
      const result = await this.invalidateByPattern(pattern);
      count += result.invalidated;
    }

    return { tag, invalidated: count };
  }

  async invalidateAll() {
    await this.cache.clear();
    return { status: 'cleared' };
  }

  getPatterns() {
    return Array.from(this.patterns.entries()).map(([pattern, keys]) => ({
      pattern,
      keyCount: keys.length,
    }));
  }
}

export const createCacheInvalidator = (cache) => new CacheInvalidator(cache);
