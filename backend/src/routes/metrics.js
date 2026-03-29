import express from 'express';
import { getSnapshot, resetMetrics } from '../monitoring/metrics.js';
import { getWsStats } from '../services/websocket.js';

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

// GET /api/metrics/websocket — live WebSocket analytics
router.get('/websocket', (_req, res) => {
  res.json(getWsStats());
});

export default router;
