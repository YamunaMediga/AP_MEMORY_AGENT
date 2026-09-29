import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, run } from '../database/db.js';
import { config } from '../config.js';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware.js';
import crypto from 'crypto';

const router = Router();

function generateToken(user: { id: string; email: string; name: string; role: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = queryOne(`SELECT id FROM users WHERE email = ?`, [cleanEmail]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = `usr_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO users (id, email, password_hash, name, role, created_at)
       VALUES (?, ?, ?, ?, 'reviewer', ?)`,
      [id, cleanEmail, passwordHash, name.trim(), now]
    );

    const user = { id, email: cleanEmail, name: name.trim(), role: 'reviewer' };
    const token = generateToken(user);

    return res.status(201).json({ user, token });
  } catch (err: any) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Failed to create user account' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = queryOne<any>(`SELECT * FROM users WHERE email = ?`, [cleanEmail]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userData = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token = generateToken(userData);

    return res.json({ user: userData, token });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Failed to log in' });
  }
});

// POST /api/auth/quick-login (for judges)
router.post('/quick-login', async (req: Request, res: Response) => {
  try {
    const demoEmail = 'judge@hackathon.ai';
    let user = queryOne<any>(`SELECT * FROM users WHERE email = ?`, [demoEmail]);

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('judge2026', salt);
      const id = `usr_demo_${Date.now()}`;
      const now = new Date().toISOString();
      run(
        `INSERT INTO users (id, email, password_hash, name, role, created_at)
         VALUES (?, ?, ?, 'Hackathon Reviewer', 'reviewer', ?)`,
        [id, demoEmail, passwordHash, now]
      );
      user = { id, email: demoEmail, name: 'Hackathon Reviewer', role: 'reviewer' };
    }

    const userData = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token = generateToken(userData);

    return res.json({ user: userData, token });
  } catch (err: any) {
    console.error('Quick login error:', err);
    return res.status(500).json({ error: 'Failed to authenticate quick login' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  return res.json({ user: req.user });
});

export default router;
