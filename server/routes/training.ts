import { Router, Request, Response } from 'express';
import { store, TrainingRunEntity } from '../db/store';
import { FederatedEngine } from '../fl/engine';
import { requireAuth } from '../middleware/auth';

export const trainingRouter = Router();

trainingRouter.post(['/start', '/local'], requireAuth, (req: Request, res: Response) => {
  const { hospital_id, epochs, learning_rate, batch_size } = req.body;
  const hospitalId = parseInt(hospital_id, 10);
  const currentUser = req.user!;

  if (!hospitalId) {
    return res.status(400).json({ detail: 'hospital_id is required' });
  }

  // RBAC check: Hospital Admin can only train their hospital
  if (currentUser.role === 'HOSPITAL_ADMIN' && currentUser.hospital_id !== hospitalId) {
    return res.status(403).json({
      detail: 'Hospital Administrators can only execute local training runs for their assigned hospital.',
      code: 'FORBIDDEN_HOSPITAL_MISMATCH',
    });
  }

  const hospital = store.hospitals.find((h) => h.id === hospitalId);
  if (!hospital) {
    return res.status(404).json({ detail: `Hospital ${hospitalId} not found` });
  }

  const samples = store.hospitalData.get(hospitalId);
  if (!samples || samples.length === 0) {
    return res.status(400).json({ detail: `No local clinical records found for hospital ${hospitalId}` });
  }

  // Active global model as initialization baseline
  const activeModel = store.models.find((m) => m.is_active) || store.models[0];
  const initialParams = {
    weights: activeModel?.parameters_summary?.weights || new Array(10).fill(0),
    bias: activeModel?.parameters_summary?.bias || 0,
  };

  const startTime = new Date().toISOString();
  const numEpochs = epochs || 15;
  const lr = learning_rate || 0.05;
  const bSize = batch_size || 32;

  // Run real Gradient Descent
  const { parameters, metrics } = FederatedEngine.trainLocalModel(samples, initialParams, {
    epochs: numEpochs,
    learning_rate: lr,
    batch_size: bSize,
  });

  hospital.latest_accuracy = metrics.accuracy;
  hospital.training_runs_count += 1;

  const trainingRun: TrainingRunEntity = {
    id: store.trainingRuns.length + 1,
    hospital_id: hospitalId,
    hospital_name: hospital.hospital_name,
    model_version: `local_${hospital.hospital_code.toLowerCase()}_v${hospital.training_runs_count}`,
    training_samples: samples.length,
    accuracy: metrics.accuracy,
    precision: metrics.precision,
    recall: metrics.recall,
    f1_score: metrics.f1_score,
    loss: metrics.loss,
    status: 'COMPLETED',
    metrics_json: {
      accuracy: metrics.accuracy,
      precision: metrics.precision,
      recall: metrics.recall,
      f1_score: metrics.f1_score,
      loss: metrics.loss,
      roc_auc: metrics.roc_auc,
      epoch_losses: metrics.epoch_losses,
      confusion_matrix: metrics.confusion_matrix,
    },
    started_at: startTime,
    completed_at: new Date().toISOString(),
  };

  store.trainingRuns.unshift(trainingRun);
  store.logAudit(
    'LOCAL_TRAINING_COMPLETED',
    `Local Training for ${hospital.hospital_name}`,
    'SUCCESS',
    { id: currentUser.id, name: currentUser.name },
    {
      hospital_id: hospitalId,
      samples: samples.length,
      epochs: numEpochs,
      accuracy: metrics.accuracy,
      f1: metrics.f1_score,
    }
  );

  return res.json(trainingRun);
});

trainingRouter.get('/history', requireAuth, (req: Request, res: Response) => {
  const hospitalId = req.query.hospital_id ? parseInt(req.query.hospital_id as string, 10) : undefined;
  if (hospitalId) {
    const runs = store.trainingRuns.filter((r) => r.hospital_id === hospitalId);
    return res.json(runs);
  }
  return res.json(store.trainingRuns);
});
