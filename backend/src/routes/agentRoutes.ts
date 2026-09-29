import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import { agentService } from '../services/agentService.js';

const router = Router();
router.use(authMiddleware);

// POST /api/agent/chat
router.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const reply = await agentService.chatWithAgent(userId, message.trim());
    return res.json(reply);
  } catch (err: any) {
    console.error('Agent chat error:', err);
    return res.status(500).json({ error: 'Failed to process chat message' });
  }
});

export default router;
