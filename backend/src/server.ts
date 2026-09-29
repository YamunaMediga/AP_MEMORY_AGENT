import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getDb, persistDb } from './database/db.js';

import authRoutes from './routes/authRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import policyRoutes from './routes/policyRoutes.js';
import realtimeRoutes from './routes/realtimeRoutes.js';
import configRoutes from './routes/configRoutes.js';
import agentRoutes from './routes/agentRoutes.js';

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/invoice', requestRoutes);
app.use('/api/invoices', requestRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/config', configRoutes);
app.use('/api/agent', agentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend production build if available
import path from 'path';
import fs from 'fs';

const frontendDistPath = path.resolve(process.cwd(), '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err?.message || 'Unknown error' });
});

async function startServer() {
  try {
    // Initialize persistent SQLite database
    await getDb();
    console.log('✓ SQLite database initialized and persistent at backend/data/ap_agent.sqlite');

    app.listen(config.port, () => {
      console.log(`✓ AP Memory Agent backend running on http://localhost:${config.port}`);
      console.log(`✓ Real-time SSE endpoint active at http://localhost:${config.port}/api/realtime/events`);
      console.log(`✓ Hindsight Engine mode: ${config.hindsightApiKey ? 'Cloud' : 'Local Bank Active'}`);
    });
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

// Graceful persistence on exit
process.on('SIGINT', () => {
  persistDb();
  process.exit(0);
});
process.on('SIGTERM', () => {
  persistDb();
  process.exit(0);
});

startServer();
