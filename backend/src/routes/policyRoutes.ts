import { Router, Response } from 'express';
import { queryAll, run } from '../database/db.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import { hindsightService } from '../services/hindsightService.js';
import { realtimeService } from '../services/realtimeService.js';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

// GET /api/policies
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const policies = queryAll<any>(
      `SELECT * FROM policies WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    return res.json({ policies });
  } catch (err: any) {
    console.error('List policies error:', err);
    return res.status(500).json({ error: 'Failed to retrieve policies' });
  }
});

// POST /api/policies (Teach Agent a new policy rule -> Hindsight retain)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { instruction, category } = req.body;

    if (!instruction || !instruction.trim()) {
      return res.status(400).json({ error: 'Policy instruction is required' });
    }

    const cleanText = instruction.trim();
    const id = `pol_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    // 1. Retain into Hindsight Long-Term Memory
    const retentionResult = await hindsightService.retain(
      userId,
      cleanText,
      `Policy: ${category || 'General'}`,
      'policy'
    );

    // 2. Persist policy in SQLite
    run(
      `INSERT INTO policies (id, user_id, instruction, category, hindsight_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, cleanText, category || 'General', retentionResult.mode, now]
    );

    // 3. Log audit event
    const eventId = `evt_${crypto.randomUUID()}`;
    const eventDesc = `Agent retained new policy memory into Hindsight (${retentionResult.mode} mode): "${cleanText.slice(0, 70)}..."`;
    run(
      `INSERT INTO audit_events (id, user_id, request_id, event_type, description, metadata_json, created_at)
       VALUES (?, ?, NULL, 'policy_retained', ?, ?, ?)`,
      [eventId, userId, eventDesc, JSON.stringify({ policyId: id, mode: retentionResult.mode }), now]
    );

    const created = {
      id,
      user_id: userId,
      instruction: cleanText,
      category: category || 'General',
      hindsight_status: retentionResult.mode,
      created_at: now,
    };

    // 4. Real-time broadcast
    realtimeService.broadcastToUser(userId, 'policy_created', created);
    realtimeService.broadcastToUser(userId, 'activity_logged', {
      id: eventId,
      eventType: 'policy_retained',
      description: eventDesc,
      createdAt: now,
    });

    return res.status(201).json({ policy: created, memoryMode: retentionResult.mode });
  } catch (err: any) {
    console.error('Create policy error:', err);
    return res.status(500).json({ error: 'Failed to save policy to Hindsight' });
  }
});

// GET /api/policies/memories (View all Hindsight memories)
router.get('/memories', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const memories = hindsightService.listMemories(userId);
    return res.json({ memories });
  } catch (err: any) {
    console.error('List memories error:', err);
    return res.status(500).json({ error: 'Failed to retrieve Hindsight memories' });
  }
});

// POST /api/policies/reflect (Synthesize insights from memories)
router.post('/reflect', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { prompt } = req.body;
    const reflection = await hindsightService.reflect(
      userId,
      prompt || 'What are the main review rules and patterns established in this bank?'
    );
    return res.json({ reflection });
  } catch (err: any) {
    console.error('Reflect error:', err);
    return res.status(500).json({ error: 'Failed to reflect on memories' });
  }
});

// DELETE /api/policies/:id
router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    run(`DELETE FROM policies WHERE id = ? AND user_id = ?`, [req.params.id, userId]);
    return res.json({ success: true });
  } catch (err: any) {
    console.error('Delete policy error:', err);
    return res.status(500).json({ error: 'Failed to delete policy' });
  }
});

export default router;
