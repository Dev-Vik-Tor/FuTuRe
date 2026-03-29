import express from 'express';
import { getSnapshot, resetMetrics } from '../monitoring/metrics.js';
import { getCdnStats } from '../cdn/index.js';

const router = express.Router();

// GET /api/metrics — full performance snapshot
router.get('/', (_req, res) => {
  res.json(getSnapshot());
});

// DELETE /api/metrics — reset collected metrics
router.delete('/', (_req, res) => {
  resetMetrics();
  res.json({ message: 'Metrics reset' });
});

// GET /api/metrics/cdn — CDN analytics and config
router.get('/cdn', (_req, res) => {
  res.json(getCdnStats());
});

export default router;
