import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/database';
import { requireAuth } from '../middleware/auth';
import { store, DatasetEntity, ClinicalSample } from '../db/store';
import { DatasetAnalyzer } from '../fl/datasetAnalyzer';

export const datasetsRouter = Router();

// Ensure upload directory exists before configuring multer
const tempUploadDir = path.join(process.cwd(), 'data', 'temp_uploads');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(tempUploadDir)) {
      fs.mkdirSync(tempUploadDir, { recursive: true });
    }
    cb(null, tempUploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const isCsv =
      file.originalname.toLowerCase().endsWith('.csv') ||
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'text/plain';
    if (isCsv) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only comma-separated (.csv) files are permitted.'));
    }
  },
});

/**
 * GET /api/datasets
 * Protected: List all registered datasets.
 */
datasetsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  return res.json(store.datasets);
});

/**
 * GET /api/datasets/:id
 * Protected: View specific dataset with preview rows and analysis.
 */
datasetsRouter.get('/:id', requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const dataset = store.datasets.find((d) => d.id === id);
  if (!dataset) {
    return res.status(404).json({ detail: `Dataset ${id} not found` });
  }

  // If preview rows or summaries are missing, attempt to generate them from disk file
  if ((!dataset.preview_rows || dataset.preview_rows.length === 0) && dataset.file_path && fs.existsSync(dataset.file_path)) {
    try {
      const content = fs.readFileSync(dataset.file_path, 'utf-8');
      const parsed = DatasetAnalyzer.parseCsv(content);
      const analysis = DatasetAnalyzer.analyze(parsed, 20);
      dataset.preview_rows = analysis.preview_rows;
      dataset.columns = analysis.columns;
      dataset.column_types = analysis.column_types;
      dataset.summaries = analysis.summaries;
      dataset.target_candidates = analysis.target_candidates;
      dataset.data_quality = analysis.data_quality;
    } catch (err) {
      console.warn('[Datasets] Could not re-parse file for preview:', err);
    }
  }

  return res.json(dataset);
});

/**
 * POST /api/datasets/upload
 * Protected: Upload and validate CSV dataset partition.
 */
datasetsRouter.post('/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  const file = req.file;
  const currentUser = req.user!;

  if (!file) {
    return res.status(400).json({ detail: 'No file uploaded. Please select a valid CSV dataset file.' });
  }

  const rawHospitalId = req.body.hospital_id;
  let hospitalId = rawHospitalId ? parseInt(rawHospitalId, 10) : (currentUser.hospital_id || 1);

  // If user is a hospital admin, ensure they upload to their assigned hospital
  if (currentUser.role === 'HOSPITAL_ADMIN' && currentUser.hospital_id) {
    hospitalId = currentUser.hospital_id;
  }

  const datasetName = req.body.dataset_name?.trim() || file.originalname.replace(/\.csv$/i, '') || 'Hospital Cohort Dataset';

  const hospital = store.hospitals.find((h) => h.id === hospitalId);
  if (!hospital) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return res.status(404).json({ detail: `Hospital node ${hospitalId} not found in federated registry` });
  }

  try {
    const rawContent = fs.readFileSync(file.path, 'utf-8');

    if (!rawContent || rawContent.trim().length === 0) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ detail: 'Uploaded file is completely empty.' });
    }

    // Parse CSV with robust RFC-4180 parser
    let parsed;
    try {
      parsed = DatasetAnalyzer.parseCsv(rawContent);
    } catch (parseErr: any) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ detail: `Failed to parse CSV: ${parseErr.message}` });
    }

    if (parsed.headers.length === 0) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ detail: 'CSV file contains no valid column headers.' });
    }

    if (parsed.rows.length < 2) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({
        detail: `CSV file must contain at least 2 data rows for training. Found ${parsed.rows.length} rows.`,
      });
    }

    // Run deep dataset profiling and statistical analysis
    const analysis = DatasetAnalyzer.analyze(parsed, 25);

    // Save permanently to hospital partition directory
    const targetDir = path.join(process.cwd(), 'data', `hospital_${hospitalId}`);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetPath = path.join(targetDir, 'dataset.csv');
    fs.copyFileSync(file.path, targetPath);

    // Also store a timestamped copy in data/datasets
    const archiveDir = path.join(process.cwd(), 'data', 'datasets');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    const archivePath = path.join(archiveDir, `dataset_${hospitalId}_${Date.now()}.csv`);
    fs.copyFileSync(file.path, archivePath);

    // Clean up temporary upload file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Check if the dataset contains standard 10 cardiovascular features or custom target
    const targetCol = analysis.recommended_target || 'target';
    const samples: ClinicalSample[] = [];
    let positiveCount = 0;
    let negativeCount = 0;

    // Build samples for in-memory federated engine if suitable
    for (const row of parsed.rows) {
      const rawTarget = row[targetCol];
      const targetVal = rawTarget === '1' || rawTarget === 'true' || rawTarget === 'yes' ? 1 : Number(rawTarget) || 0;
      if (targetVal === 1) positiveCount++;
      else negativeCount++;

      // If standard features exist, map them; otherwise map first 10 numeric features
      const features: number[] = [];
      const standardCols = [
        'age', 'sex', 'chest_pain_type', 'resting_bp', 'cholesterol',
        'fasting_blood_sugar', 'resting_ecg', 'max_heart_rate', 'exercise_angina', 'st_depression'
      ];
      const hasStandard = standardCols.every((c) => analysis.columns.includes(c));

      if (hasStandard) {
        for (const c of standardCols) {
          features.push(Number(row[c]) || 0);
        }
      } else {
        // Collect numeric column values
        for (const col of analysis.columns) {
          if (col !== targetCol && analysis.column_types[col] === 'numeric') {
            features.push(Number(row[col]) || 0);
          }
        }
      }

      if (features.length > 0) {
        samples.push({ features, target: targetVal });
      }
    }

    if (samples.length > 0) {
      store.hospitalData.set(hospitalId, samples);
    }
    hospital.record_count = parsed.rows.length;

    // Create or update dataset entry
    const newDataset: DatasetEntity = {
      id: store.datasets.length + 1,
      hospital_id: hospitalId,
      hospital_name: hospital.hospital_name,
      dataset_name: datasetName,
      record_count: parsed.rows.length,
      feature_count: analysis.columns.filter((c) => c !== targetCol).length,
      status: 'VALIDATED',
      file_path: targetPath,
      file_name: file.originalname,
      file_size: file.size,
      columns: analysis.columns,
      column_types: analysis.column_types,
      preview_rows: analysis.preview_rows,
      missing_values_count: analysis.data_quality.missing_cells,
      duplicate_count: analysis.data_quality.duplicate_rows,
      summaries: analysis.summaries,
      target_candidates: analysis.target_candidates,
      data_quality: analysis.data_quality,
      schema_info: {
        features: analysis.columns.filter((c) => c !== targetCol),
        target: targetCol,
        positive_class_count: positiveCount,
        negative_class_count: negativeCount,
        missing_values: analysis.data_quality.missing_cells,
        non_iid_bias: `Uploaded custom EHR cohort for ${hospital.hospital_name}`,
      },
      uploaded_at: new Date().toISOString(),
    };

    // Replace existing dataset for hospital if present, or add to list
    const existingIdx = store.datasets.findIndex((d) => d.hospital_id === hospitalId);
    if (existingIdx >= 0) {
      newDataset.id = store.datasets[existingIdx].id;
      store.datasets[existingIdx] = newDataset;
    } else {
      store.datasets.push(newDataset);
    }

    // Write audit log
    try {
      await db.execute(
        `INSERT INTO audit_logs (user_id, action, resource, status, timestamp, metadata_json)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)`,
        [
          currentUser.id,
          'DATASET_UPLOADED',
          `Dataset "${datasetName}" for ${hospital.hospital_name}`,
          'SUCCESS',
          JSON.stringify({
            hospital_id: hospitalId,
            records: parsed.rows.length,
            features: analysis.feature_count,
            target: targetCol,
            quality_score: analysis.data_quality.health_score,
          }),
        ]
      );
    } catch (e) {
      // Non-fatal if Postgres is not active
    }

    store.logAudit(
      'DATASET_UPLOADED',
      `Dataset "${datasetName}" for ${hospital.hospital_name}`,
      'SUCCESS',
      { id: currentUser.id, name: currentUser.name },
      {
        hospital_id: hospitalId,
        records: parsed.rows.length,
        features: analysis.feature_count,
        target: targetCol,
        path: targetPath,
      }
    );

    return res.status(201).json(newDataset);
  } catch (err: any) {
    if (file && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {}
    }
    console.error('[Datasets] Error processing uploaded dataset:', err);
    return res.status(500).json({ detail: `Error processing dataset: ${err.message}` });
  }
});

/**
 * POST /api/datasets/:id/train
 * Protected: Train Logistic Regression model on the uploaded dataset with user-selected target and features.
 */
datasetsRouter.post('/:id/train', requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const dataset = store.datasets.find((d) => d.id === id);
  if (!dataset) {
    return res.status(404).json({ detail: `Dataset ${id} not found` });
  }

  if (!dataset.file_path || !fs.existsSync(dataset.file_path)) {
    return res.status(400).json({ detail: 'Dataset file is not available on disk for training.' });
  }

  const { target_column, feature_columns, epochs, learning_rate, batch_size, l2_reg, train_split } = req.body;

  try {
    const rawContent = fs.readFileSync(dataset.file_path, 'utf-8');
    const parsed = DatasetAnalyzer.parseCsv(rawContent);

    const targetCol = target_column || dataset.schema_info?.target || dataset.columns?.[dataset.columns.length - 1];

    if (!targetCol) {
      return res.status(400).json({ detail: 'Please specify a target column for classification.' });
    }

    // Train Logistic Regression
    const trainingResult = DatasetAnalyzer.trainLogisticRegression(parsed, targetCol, {
      featureCols: feature_columns,
      epochs: epochs ? parseInt(epochs, 10) : 25,
      learning_rate: learning_rate ? parseFloat(learning_rate) : 0.05,
      batch_size: batch_size ? parseInt(batch_size, 10) : 32,
      l2_reg: l2_reg ? parseFloat(l2_reg) : 0.001,
      train_split: train_split ? parseFloat(train_split) : 0.8,
    });

    // Save trained model onto dataset entity
    dataset.trained_model = trainingResult;
    dataset.status = 'MODEL_TRAINED';

    // Update hospital stats
    const hospital = store.hospitals.find((h) => h.id === dataset.hospital_id);
    if (hospital) {
      hospital.latest_accuracy = trainingResult.metrics.accuracy;
      hospital.training_runs_count += 1;
    }

    // Log training run in store
    store.trainingRuns.unshift({
      id: store.trainingRuns.length + 1,
      hospital_id: dataset.hospital_id,
      hospital_name: dataset.hospital_name,
      model_version: `logistic_reg_${dataset.hospital_id}_v${Date.now().toString().slice(-4)}`,
      training_samples: trainingResult.metrics.train_count,
      accuracy: trainingResult.metrics.accuracy,
      precision: trainingResult.metrics.precision,
      recall: trainingResult.metrics.recall,
      f1_score: trainingResult.metrics.f1_score,
      loss: trainingResult.metrics.loss,
      status: 'COMPLETED',
      metrics_json: {
        accuracy: trainingResult.metrics.accuracy,
        precision: trainingResult.metrics.precision,
        recall: trainingResult.metrics.recall,
        f1_score: trainingResult.metrics.f1_score,
        loss: trainingResult.metrics.loss,
        roc_auc: trainingResult.metrics.roc_auc,
        epoch_losses: trainingResult.metrics.epoch_losses,
        confusion_matrix: trainingResult.metrics.confusion_matrix,
      },
      started_at: new Date(Date.now() - 3000).toISOString(),
      completed_at: new Date().toISOString(),
    });

    store.logAudit(
      'MODEL_TRAINED_ON_DATASET',
      `Trained Logistic Regression on dataset "${dataset.dataset_name}" (Target: ${targetCol})`,
      'SUCCESS',
      { id: req.user?.id, name: req.user?.name },
      {
        dataset_id: id,
        accuracy: trainingResult.metrics.accuracy,
        f1: trainingResult.metrics.f1_score,
        features: trainingResult.feature_columns.length,
      }
    );

    return res.json({
      status: 'SUCCESS',
      dataset_id: id,
      trained_model: trainingResult,
    });
  } catch (err: any) {
    console.error('[Datasets] Training error:', err);
    return res.status(400).json({ detail: `Model training failed: ${err.message}` });
  }
});

/**
 * POST /api/datasets/:id/predict
 * Protected: Test patient disease-risk prediction using the trained dataset model.
 */
datasetsRouter.post('/:id/predict', requireAuth, (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const dataset = store.datasets.find((d) => d.id === id);
  if (!dataset) {
    return res.status(404).json({ detail: `Dataset ${id} not found` });
  }

  if (!dataset.trained_model) {
    return res.status(400).json({
      detail: 'No model has been trained on this dataset yet. Train the model first to generate predictions.',
    });
  }

  const { features } = req.body;
  if (!features || typeof features !== 'object') {
    return res.status(400).json({ detail: 'Please provide feature values for inference.' });
  }

  try {
    const prediction = DatasetAnalyzer.predictRisk(dataset.trained_model, features);
    return res.json(prediction);
  } catch (err: any) {
    return res.status(400).json({ detail: `Inference failed: ${err.message}` });
  }
});
