import { Router, Request, Response } from 'express';
import { store } from '../db/store';
import { FederatedEngine } from '../fl/engine';
import { requireAuth } from '../middleware/auth';

export const modelsRouter = Router();

modelsRouter.get('/', requireAuth, (req: Request, res: Response) => {
  return res.json(store.models);
});

modelsRouter.get('/global', requireAuth, (req: Request, res: Response) => {
  const activeModel = store.models.find((m) => m.is_active) || store.models[0];
  if (!activeModel) {
    return res.status(404).json({ detail: 'No active global model found' });
  }
  return res.json(activeModel);
});

modelsRouter.get('/comparison', requireAuth, (req: Request, res: Response) => {
  const comparison = FederatedEngine.generateModelComparison();
  return res.json(comparison);
});

modelsRouter.get('/:id', requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const model = store.models.find((m) => m.id === id);
  if (!model) {
    return res.status(404).json({ detail: `Model ${id} not found` });
  }
  return res.json(model);
});
