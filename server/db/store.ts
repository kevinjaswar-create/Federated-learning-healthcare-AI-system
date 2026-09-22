import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UserEntity {
  id: number;
  hospital_id: number | null;
  hospital_name: string | null;
  name: string;
  email: string;
  password: string;
  role: 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR';
  status: string;
  created_at: string;
}

export interface HospitalEntity {
  id: number;
  hospital_name: string;
  hospital_code: string;
  location: string;
  contact_email: string;
  status: 'ACTIVE' | 'INACTIVE' | 'OFFLINE' | 'TRAINING';
  created_at: string;
  record_count: number;
  training_runs_count: number;
  latest_accuracy: number | null;
}

export interface DatasetEntity {
  id: number;
  hospital_id: number;
  hospital_name?: string;
  dataset_name: string;
  record_count: number;
  feature_count: number;
  status: string;
  file_path?: string;
  schema_info?: {
    features?: string[];
    target?: string;
    missing_values?: number;
    positive_class_count?: number;
    negative_class_count?: number;
    non_iid_bias?: string;
  };
  uploaded_at: string;
}

export interface TrainingRunEntity {
  id: number;
  hospital_id: number;
  hospital_name?: string;
  round_number?: number;
  model_version: string;
  training_samples: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  loss?: number;
  status: string;
  metrics_json?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    loss?: number;
    roc_auc?: number;
    epoch_losses?: number[];
    confusion_matrix?: {
      matrix: number[][];
      true_negatives: number;
      false_positives: number;
      false_negatives: number;
      true_positives: number;
    };
  };
  started_at: string;
  completed_at?: string;
}

export interface ClientRoundStatus {
  hospital_id: number;
  hospital_name: string;
  status: 'WAITING' | 'TRAINING' | 'COMPLETED' | 'FAILED';
  sample_count: number;
  local_accuracy?: number;
  local_f1?: number;
  loss?: number;
  update_checksum?: string;
}

export interface FederatedRoundEntity {
  id: number;
  round_number: number;
  participating_hospitals: number[];
  completed_hospitals: number[];
  failed_hospitals: number[];
  global_model_version: string;
  aggregation_method: string;
  status: string;
  dp_applied?: boolean;
  dp_epsilon?: number;
  global_metrics?: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    roc_auc?: number;
    loss?: number;
    confusion_matrix?: {
      matrix: number[][];
      true_negatives: number;
      false_positives: number;
      false_negatives: number;
      true_positives: number;
    };
  };
  client_statuses?: ClientRoundStatus[];
  started_at: string;
  completed_at?: string;
}

export interface ModelRecordEntity {
  id: number;
  model_name: string;
  model_version: string;
  model_type: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  parameters_summary?: {
    weights: number[];
    bias: number;
    num_features: number;
    participating_count?: number;
    checksum?: string;
  };
  is_active: boolean;
  status: string;
  created_at: string;
}

export interface PredictionEntity {
  id: number;
  hospital_id?: number;
  hospital_name?: string;
  model_version: string;
  prediction_result: string;
  confidence: number;
  probability_risk: number;
  probability_healthy: number;
  input_features: Record<string, number>;
  disclaimer: string;
  created_at: string;
}

export interface AuditLogEntity {
  id: number;
  user_id?: number;
  user_name?: string;
  action: string;
  resource: string;
  status: string;
  timestamp: string;
  metadata_json?: Record<string, any>;
}

export interface ClinicalSample {
  features: number[];
  target: number;
}

class Store {
  public users: UserEntity[] = [];
  public hospitals: HospitalEntity[] = [];
  public datasets: DatasetEntity[] = [];
  public trainingRuns: TrainingRunEntity[] = [];
  public federatedRounds: FederatedRoundEntity[] = [];
  public models: ModelRecordEntity[] = [];
  public predictions: PredictionEntity[] = [];
  public auditLogs: AuditLogEntity[] = [];
  public hospitalData: Map<number, ClinicalSample[]> = new Map();

  private dbFilePath: string = path.join(process.cwd(), 'data', 'db_state.json');

  constructor() {
    this.initialize();
  }

  private initialize() {
    // 1. Ensure data directories exist
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 2. Initialize or load state
    this.seedDefaultData();
    this.loadHospitalCsvs();
  }

  private seedDefaultData() {
    this.users = [
      {
        id: 1,
        name: 'System Super Admin',
        email: 'admin@federatedhealth.ai',
        password: 'Admin@12345',
        role: 'SUPER_ADMIN',
        hospital_id: null,
        hospital_name: null,
        status: 'ACTIVE',
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
      {
        id: 2,
        name: 'Dr. Sarah Connor (Admin)',
        email: 'admin@metrohospital.org',
        password: 'Hospital@12345',
        role: 'HOSPITAL_ADMIN',
        hospital_id: 1,
        hospital_name: 'Metropolitan General Hospital',
        status: 'ACTIVE',
        created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
      },
      {
        id: 3,
        name: 'Dr. James Wilson (Cardiologist)',
        email: 'doctor@metrohospital.org',
        password: 'Doctor@12345',
        role: 'DOCTOR',
        hospital_id: 1,
        hospital_name: 'Metropolitan General Hospital',
        status: 'ACTIVE',
        created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      },
      {
        id: 4,
        name: 'Dr. Lisa Cuddy (Lead Researcher)',
        email: 'doctor@stjude.org',
        password: 'Doctor@12345',
        role: 'DOCTOR',
        hospital_id: 2,
        hospital_name: 'St. Jude Cardiac Institute',
        status: 'ACTIVE',
        created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      },
    ];

    this.hospitals = [
      {
        id: 1,
        hospital_name: 'Metropolitan General Hospital',
        hospital_code: 'METRO-01',
        location: 'New York, NY',
        contact_email: 'contact@metrohospital.org',
        status: 'ACTIVE',
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
        record_count: 320,
        training_runs_count: 4,
        latest_accuracy: 0.792,
      },
      {
        id: 2,
        hospital_name: 'St. Jude Cardiac Institute',
        hospital_code: 'STJUDE-02',
        location: 'Chicago, IL',
        contact_email: 'research@stjude.org',
        status: 'ACTIVE',
        created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
        record_count: 280,
        training_runs_count: 3,
        latest_accuracy: 0.815,
      },
      {
        id: 3,
        hospital_name: 'Rural Health Network Care',
        hospital_code: 'RURAL-03',
        location: 'Bozeman, MT',
        contact_email: 'coordinator@ruralhealth.org',
        status: 'ACTIVE',
        created_at: new Date(Date.now() - 22 * 86400000).toISOString(),
        record_count: 220,
        training_runs_count: 2,
        latest_accuracy: 0.741,
      },
      {
        id: 4,
        hospital_name: 'University Research Hospital',
        hospital_code: 'UNIV-04',
        location: 'Boston, MA',
        contact_email: 'trials@univhealth.edu',
        status: 'ACTIVE',
        created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
        record_count: 350,
        training_runs_count: 5,
        latest_accuracy: 0.834,
      },
      {
        id: 5,
        hospital_name: 'Suburban Memorial Clinic',
        hospital_code: 'SUBURB-05',
        location: 'Austin, TX',
        contact_email: 'data@suburbanhealth.org',
        status: 'ACTIVE',
        created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
        record_count: 250,
        training_runs_count: 2,
        latest_accuracy: 0.776,
      },
    ];

    // Seed Initial Active Model v1.0 (Trained baseline FedAvg)
    const initialWeights = [
      0.038, // age
      0.485, // sex
      0.392, // chest_pain_type
      0.018, // resting_bp
      0.007, // cholesterol
      0.580, // fasting_blood_sugar
      0.285, // resting_ecg
      -0.029, // max_heart_rate
      0.760, // exercise_angina
      0.490, // st_depression
    ];
    const initialBias = -1.15;
    const initialChecksum = crypto
      .createHash('sha256')
      .update(JSON.stringify({ weights: initialWeights, bias: initialBias }))
      .digest('hex');

    this.models = [
      {
        id: 1,
        model_name: 'global_model',
        model_version: 'global_model_v1.0',
        model_type: 'LogisticRegression (FedAvg)',
        accuracy: 0.842,
        precision: 0.835,
        recall: 0.854,
        f1_score: 0.844,
        parameters_summary: {
          weights: initialWeights,
          bias: initialBias,
          num_features: 10,
          participating_count: 5,
          checksum: initialChecksum,
        },
        is_active: true,
        status: 'READY',
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      },
      {
        id: 2,
        model_name: 'global_model',
        model_version: 'global_model_v0',
        model_type: 'LogisticRegression (Baseline)',
        accuracy: 0.620,
        precision: 0.615,
        recall: 0.630,
        f1_score: 0.622,
        parameters_summary: {
          weights: [0.01, 0.05, 0.08, 0.005, 0.002, 0.1, 0.05, -0.01, 0.12, 0.08],
          bias: -0.2,
          num_features: 10,
          participating_count: 0,
        },
        is_active: false,
        status: 'ARCHIVED',
        created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
      },
    ];

    // Seed Completed Federated Rounds
    this.federatedRounds = [
      {
        id: 1,
        round_number: 1,
        participating_hospitals: [1, 2, 3, 4, 5],
        completed_hospitals: [1, 2, 3, 4, 5],
        failed_hospitals: [],
        global_model_version: 'global_model_v1.0',
        aggregation_method: 'FedAvg',
        status: 'COMPLETED',
        dp_applied: true,
        dp_epsilon: 1.5,
        global_metrics: {
          accuracy: 0.842,
          precision: 0.835,
          recall: 0.854,
          f1_score: 0.844,
          roc_auc: 0.892,
          loss: 0.384,
          confusion_matrix: {
            matrix: [
              [142, 28],
              [24, 156],
            ],
            true_negatives: 142,
            false_positives: 28,
            false_negatives: 24,
            true_positives: 156,
          },
        },
        client_statuses: [
          { hospital_id: 1, hospital_name: 'Metropolitan General Hospital', status: 'COMPLETED', sample_count: 320, local_accuracy: 0.825, local_f1: 0.831, loss: 0.392 },
          { hospital_id: 2, hospital_name: 'St. Jude Cardiac Institute', status: 'COMPLETED', sample_count: 280, local_accuracy: 0.845, local_f1: 0.852, loss: 0.371 },
          { hospital_id: 3, hospital_name: 'Rural Health Network Care', status: 'COMPLETED', sample_count: 220, local_accuracy: 0.812, local_f1: 0.819, loss: 0.415 },
          { hospital_id: 4, hospital_name: 'University Research Hospital', status: 'COMPLETED', sample_count: 350, local_accuracy: 0.868, local_f1: 0.871, loss: 0.342 },
          { hospital_id: 5, hospital_name: 'Suburban Memorial Clinic', status: 'COMPLETED', sample_count: 250, local_accuracy: 0.836, local_f1: 0.840, loss: 0.388 },
        ],
        started_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        completed_at: new Date(Date.now() - 5 * 86400000 + 45000).toISOString(),
      },
    ];

    // Seed Sample Predictions
    this.predictions = [
      {
        id: 1,
        hospital_id: 1,
        hospital_name: 'Metropolitan General Hospital',
        model_version: 'global_model_v1.0',
        prediction_result: 'High Risk (Cardiovascular Anomaly)',
        confidence: 0.875,
        probability_risk: 0.875,
        probability_healthy: 0.125,
        input_features: {
          age: 63,
          sex: 1,
          chest_pain_type: 3,
          resting_bp: 145,
          cholesterol: 260,
          fasting_blood_sugar: 1,
          resting_ecg: 1,
          max_heart_rate: 132,
          exercise_angina: 1,
          st_depression: 2.4,
        },
        disclaimer: 'Academic prototype inference. Not for unsupervised diagnostic use.',
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: 2,
        hospital_id: 2,
        hospital_name: 'St. Jude Cardiac Institute',
        model_version: 'global_model_v1.0',
        prediction_result: 'Low Risk / Healthy Profile',
        confidence: 0.884,
        probability_risk: 0.116,
        probability_healthy: 0.884,
        input_features: {
          age: 42,
          sex: 0,
          chest_pain_type: 1,
          resting_bp: 118,
          cholesterol: 185,
          fasting_blood_sugar: 0,
          resting_ecg: 0,
          max_heart_rate: 168,
          exercise_angina: 0,
          st_depression: 0.2,
        },
        disclaimer: 'Academic prototype inference. Not for unsupervised diagnostic use.',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ];

    // Seed Audit Logs
    this.auditLogs = [
      {
        id: 1,
        user_id: 1,
        user_name: 'System Super Admin',
        action: 'SYSTEM_INITIALIZED',
        resource: 'Platform Engine & 5 Hospital Nodes',
        status: 'SUCCESS',
        timestamp: new Date(Date.now() - 30 * 86400000).toISOString(),
        metadata_json: { hospitals_initialized: 5, target_disease: 'Cardiovascular Risk' },
      },
      {
        id: 2,
        user_id: 1,
        user_name: 'System Super Admin',
        action: 'FEDERATED_ROUND_COMPLETED',
        resource: 'Round #1 (FedAvg Aggregation)',
        status: 'SUCCESS',
        timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
        metadata_json: {
          participating_nodes: 5,
          total_samples: 1420,
          global_accuracy: 0.842,
          dp_applied: true,
          epsilon: 1.5,
        },
      },
    ];
  }

  private loadHospitalCsvs() {
    this.datasets = [];
    for (const hosp of this.hospitals) {
      const csvPath = path.join(process.cwd(), 'data', `hospital_${hosp.id}`, 'dataset.csv');
      if (fs.existsSync(csvPath)) {
        try {
          const content = fs.readFileSync(csvPath, 'utf-8');
          const lines = content.trim().split('\n');
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

          this.hospitalData.set(hosp.id, samples);
          hosp.record_count = samples.length;

          this.datasets.push({
            id: hosp.id,
            hospital_id: hosp.id,
            hospital_name: hosp.hospital_name,
            dataset_name: `${hosp.hospital_name} - Patient Cohort (Non-IID)`,
            record_count: samples.length,
            feature_count: 10,
            status: 'PREPROCESSED',
            file_path: csvPath,
            schema_info: {
              features: [
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
              ],
              target: 'target',
              positive_class_count: positiveCount,
              negative_class_count: negativeCount,
              missing_values: 0,
              non_iid_bias: `Hospital node ${hosp.id} partition`,
            },
            uploaded_at: hosp.created_at,
          });
        } catch (e) {
          console.error(`Failed reading dataset for hospital ${hosp.id}:`, e);
        }
      }
    }
  }

  public logAudit(action: string, resource: string, status: string, user?: { id?: number; name?: string }, metadata?: Record<string, any>) {
    const item: AuditLogEntity = {
      id: this.auditLogs.length + 1,
      user_id: user?.id,
      user_name: user?.name || 'System Orchestrator',
      action,
      resource,
      status,
      timestamp: new Date().toISOString(),
      metadata_json: metadata,
    };
    this.auditLogs.unshift(item);
    return item;
  }
}

export const store = new Store();
