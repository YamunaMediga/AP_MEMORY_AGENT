import { Router, Request, Response } from 'express';
import { config, updateConfig } from '../config.js';
import { hindsightService } from '../services/hindsightService.js';
import { llmService } from '../services/llmService.js';
import { queryAll, queryOne } from '../database/db.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';

const router = Router();

// GET /api/config/status (System health & integration status)
router.get('/status', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.default.verify(token, config.jwtSecret) as any;
        userId = decoded.id;
      } catch (e) {
        // ignore
      }
    }

    const hindsightStatus = await hindsightService.getStatus(userId || 'default_user');

    const counts = userId
      ? queryOne<any>(
          `SELECT COUNT(*) as totalRequests,
                  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approvedCount,
                  SUM(CASE WHEN status = 'flagged' THEN 1 ELSE 0 END) as flaggedCount
           FROM requests WHERE user_id = ?`,
          [userId]
        )
      : null;

    return res.json({
      status: 'healthy',
      hindsight: hindsightStatus,
      groq: {
        configured: !!(config.groqApiKey && config.groqApiKey.trim()),
        model: config.groqModel,
      },
      database: {
        type: 'SQLite (ACID / Persistent)',
        connected: true,
      },
      metrics: counts || { totalRequests: 0, approvedCount: 0, flaggedCount: 0 },
    });
  } catch (err: any) {
    console.error('Status check error:', err);
    return res.status(500).json({ error: 'Failed to check system status' });
  }
});

// POST /api/config/update-keys (Allows judges to test their own keys from the UI)
router.post('/update-keys', (req: Request, res: Response) => {
  try {
    const { groqApiKey, hindsightApiKey } = req.body;
    updateConfig({
      groqApiKey: groqApiKey !== undefined ? groqApiKey : config.groqApiKey,
      hindsightApiKey: hindsightApiKey !== undefined ? hindsightApiKey : config.hindsightApiKey,
    });

    hindsightService.initClient();
    llmService.initClient();

    return res.json({
      success: true,
      message: 'API configuration updated successfully',
      groqConfigured: !!config.groqApiKey,
      hindsightConfigured: !!config.hindsightApiKey,
    });
  } catch (err: any) {
    console.error('Update keys error:', err);
    return res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// GET /api/config/activity (Recent real audit timeline)
router.get('/activity', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const events = queryAll<any>(
      `SELECT * FROM audit_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 25`,
      [userId]
    );
    return res.json({ events });
  } catch (err: any) {
    console.error('Get activity error:', err);
    return res.status(500).json({ error: 'Failed to retrieve activity log' });
  }
});

export default router;
