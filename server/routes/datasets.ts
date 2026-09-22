import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/database';
import { requireAuth } from '../middleware/auth';
import { store, DatasetEntity, ClinicalSample } from '../db/store';

export const datasetsRouter = Router();

const upload = multer({ dest: path.join(process.cwd(), 'data', 'temp_uploads') });

/**
 * GET /api/datasets
 * Protected: List dataset metadata across hospital partitions.
 */
datasetsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const rows = await db.query(
      `SELECT d.id, d.hospital_id, h.hospital_name, d.dataset_name, d.record_count, d.feature_count, d.status, d.uploaded_at
       FROM datasets d
       JOIN hospitals h ON d.hospital_id = h.id
       ORDER BY d.id ASC`
    );
    if (rows && rows.length > 0) {
      return res.json(rows);
    }
  } catch (err) {
    console.error('[Datasets] Error querying DB:', err);
  }

  return res.json(store.datasets);
});

/**
 * GET /api/datasets/:id
 * Protected: View specific dataset partition metadata.
 */
datasetsRouter.get('/:id', requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const dataset = store.datasets.find((d) => d.id === id);
  if (!dataset) {
    return res.status(404).json({ detail: `Dataset ${id} not found` });
  }
  return res.json(dataset);
});

/**
 * POST /api/datasets/upload
 * Protected: Upload and validate clinical dataset partition.
 */
datasetsRouter.post('/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  const hospitalId = parseInt(req.body.hospital_id, 10);
  const datasetName = req.body.dataset_name;
  const file = req.file;
  const currentUser = req.user!;

  if (!hospitalId || !datasetName || !file) {
    return res.status(400).json({ detail: 'hospital_id, dataset_name, and file are required' });
  }

  // RBAC: Hospital admin cannot upload data to other hospitals
  if (currentUser.role === 'HOSPITAL_ADMIN' && currentUser.hospital_id !== hospitalId) {
    return res.status(403).json({
      detail: 'Hospital Administrators can only manage data partitions for their assigned hospital.',
      code: 'FORBIDDEN_HOSPITAL_MISMATCH',
    });
  }

  const hospital = store.hospitals.find((h) => h.id === hospitalId);
  if (!hospital) {
    return res.status(404).json({ detail: `Hospital ${hospitalId} not found` });
  }

  try {
    const raw = fs.readFileSync(file.path, 'utf-8');
    const lines = raw.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({ detail: 'CSV file must contain at least a header and one row' });
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const expectedCols = [
      'age',
      'sex',
      'chest_pain_type',
      'resting_bp',
      'cholesterol',
      'fasting_blood_sugar',
      'resting_ecg',
      'max_heart_rate',
      'exercise_angina',
      'st_depression',
      'target',
    ];

    const hasAll = expectedCols.every((col) => header.includes(col));
    if (!hasAll) {
      return res.status(400).json({
        detail: `Invalid CSV schema. Required columns: ${expectedCols.join(', ')}`,
      });
    }

    const samples: ClinicalSample[] = [];
    let positiveCount = 0;
    let negativeCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',').map(Number);
      if (parts.length >= 11) {
        const features = parts.slice(0, 10);
        const target = parts[10];
        samples.push({ features, target });
        if (target === 1) positiveCount++;
        else negativeCount++;
      }
    }

    // Persist to hospital on-prem data partition
    const targetDir = path.join(process.cwd(), 'data', `hospital_${hospitalId}`);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetPath = path.join(targetDir, 'dataset.csv');
    fs.copyFileSync(file.path, targetPath);
    fs.unlinkSync(file.path);

    // Update in-memory samples and hospital metrics
    store.hospitalData.set(hospitalId, samples);
    hospital.record_count = samples.length;

    const newDataset: DatasetEntity = {
      id: store.datasets.length + 1,
      hospital_id: hospitalId,
      hospital_name: hospital.hospital_name,
      dataset_name: datasetName,
      record_count: samples.length,
      feature_count: 10,
      status: 'PREPROCESSED',
      file_path: targetPath,
      schema_info: {
        features: expectedCols.slice(0, 10),
        target: 'target',
        positive_class_count: positiveCount,
        negative_class_count: negativeCount,
        missing_values: 0,
        non_iid_bias: `Uploaded custom cohort for ${hospital.hospital_name}`,
      },
      uploaded_at: new Date().toISOString(),
    };

    // Replace existing dataset for hospital if present, or add
    const existingIdx = store.datasets.findIndex((d) => d.hospital_id === hospitalId);
    if (existingIdx >= 0) {
      store.datasets[existingIdx] = newDataset;
    } else {
      store.datasets.push(newDataset);
    }

    // Write audit log
    await db.execute(
      `INSERT INTO audit_logs (user_id, action, resource, status, timestamp, metadata_json)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)`,
      [
        currentUser.id,
        'DATASET_UPLOADED',
        `Dataset "${datasetName}" for ${hospital.hospital_name}`,
        'SUCCESS',
        JSON.stringify({ hospital_id: hospitalId, records: samples.length }),
      ]
    );

    store.logAudit(
      'DATASET_UPLOADED',
      `Dataset "${datasetName}" for ${hospital.hospital_name}`,
      'SUCCESS',
      { id: currentUser.id, name: currentUser.name },
      { hospital_id: hospitalId, records: samples.length, path: targetPath }
    );

    return res.status(201).json(newDataset);
  } catch (err: any) {
    return res.status(500).json({ detail: `Error parsing dataset: ${err.message}` });
  }
});
