import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { realtimeService } from '../services/realtimeService.js';
import crypto from 'crypto';

const router = Router();

// GET /api/realtime/events
router.get('/events', (req: Request, res: Response) => {
  const token = (req.query.token as string) || req.headers.authorization?.split(' ')[1];

  let userId = 'anonymous';
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      userId = decoded.id;
    } catch (err) {
      // Invalid token, still allow connection as anonymous or return 401
    }
  }

  // Setup SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  res.write('\n');

  const clientId = `client_${crypto.randomUUID()}`;
  realtimeService.addClient(clientId, userId, res);

  req.on('close', () => {
    realtimeService.removeClient(clientId);
  });
});

export default router;
