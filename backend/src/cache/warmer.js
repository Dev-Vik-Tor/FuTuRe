/**
 * Cache Warming Strategies
 * Pre-populate cache with frequently accessed data
 */

export class CacheWarmer {
  constructor(cache) {
    this.cache = cache;
    this.strategies = [];
  }

  addStrategy(name, fn, interval = 3600000) {
    this.strategies.push({ name, fn, interval, lastRun: 0 });
    return this;
  }

  async warmAll() {
    const results = [];

    for (const strategy of this.strategies) {
      try {
        const startTime = Date.now();
        const data = await strategy.fn();

        for (const [key, value] of Object.entries(data)) {
          await this.cache.set(key, value);
        }

        results.push({
          name: strategy.name,
          status: 'success',
          duration: Date.now() - startTime,
          itemsWarmed: Object.keys(data).length,
        });

        strategy.lastRun = Date.now();
      } catch (error) {
        results.push({
          name: strategy.name,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return results;
  }

  async warmStrategy(name) {
    const strategy = this.strategies.find((s) => s.name === name);
    if (!strategy) return null;

    try {
      const data = await strategy.fn();
      for (const [key, value] of Object.entries(data)) {
        await this.cache.set(key, value);
      }
      strategy.lastRun = Date.now();
      return { status: 'success', itemsWarmed: Object.keys(data).length };
    } catch (error) {
      return { status: 'failed', error: error.message };
    }
  }

  getStrategies() {
    return this.strategies.map((s) => ({
      name: s.name,
      interval: s.interval,
      lastRun: s.lastRun,
    }));
  }
}

export const createCacheWarmer = (cache) => new CacheWarmer(cache);
