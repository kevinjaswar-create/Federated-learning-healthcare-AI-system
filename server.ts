import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import { authRouter } from './server/routes/auth';
import { hospitalsRouter } from './server/routes/hospitals';
import { datasetsRouter } from './server/routes/datasets';
import { trainingRouter } from './server/routes/training';
import { federatedRouter } from './server/routes/federated';
import { modelsRouter } from './server/routes/models';
import { predictionsRouter } from './server/routes/predictions';
import { auditLogsRouter } from './server/routes/auditLogs';
import { configRouter } from './server/routes/config';

const PORT = 3000;

async function startServer() {
  const app = express();

  // Core JSON and Form parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Backend Health Endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'Federated Learning Healthcare AI',
      version: '1.0.0',
      aggregation_protocol: 'FedAvg',
      framework: 'Privacy-Preserving Collaborative Federated Learning',
      database: 'In-Memory / File-Persistent Store',
      active_hospitals: 5,
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API Routers
  app.use('/api/config', configRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/hospitals', hospitalsRouter);
  app.use('/api/datasets', datasetsRouter);
  app.use('/api/training', trainingRouter);
  app.use('/api/federated', federatedRouter);
  app.use('/api/models', modelsRouter);
  app.use('/api/predictions', predictionsRouter);
  app.use('/api/audit-logs', auditLogsRouter);

  // Mount Vite or serve static assets
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Frontend] Mounting Vite development middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('[Frontend] Serving production bundle from dist/...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Healthcare Federated Learning Platform ready at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal error starting server:', err);
  process.exit(1);
});
