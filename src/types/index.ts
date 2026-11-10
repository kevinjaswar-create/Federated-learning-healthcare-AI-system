export type UserRole = 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR' | 'RESEARCHER';

export interface User {
  id: number;
  hospital_id: number | null;
  hospital_name: string | null;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: number;
  name: string;
  email: string;
  hospital_id: number | null;
  hospital_name: string | null;
  message?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  hospital_id?: number | null;
}

export interface Hospital {
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

export interface ColumnSummary {
  name: string;
  dtype: 'numeric' | 'categorical';
  count: number;
  missing_count: number;
  missing_percentage: number;
  unique_count: number;
  mean?: number;
  std?: number;
  min?: number;
  p25?: number;
  median?: number;
  p75?: number;
  max?: number;
  top_values?: { value: string; count: number; percentage: number }[];
}

export interface TargetCandidate {
  column: string;
  unique_classes: (string | number)[];
  class_counts: Record<string, number>;
  is_binary: boolean;
  recommended: boolean;
}

export interface DataQualityReport {
  completeness_percentage: number;
  cleanliness_percentage: number;
  health_score: number;
  total_cells: number;
  missing_cells: number;
  duplicate_rows: number;
  readiness_status: 'READY' | 'WARNINGS' | 'ACTION_REQUIRED';
  issues: string[];
  recommendations: string[];
}

export interface TrainedModelResult {
  target_column: string;
  target_classes: { original: string | number; encoded: number }[];
  feature_columns: string[];
  feature_scalers: Record<string, { mean: number; std: number; median?: number }>;
  categorical_encodings: Record<string, Record<string, number>>;
  weights: Record<string, number>;
  weight_vector: number[];
  bias: number;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    specificity: number;
    f1_score: number;
    roc_auc: number;
    loss: number;
    train_count: number;
    test_count: number;
    epoch_losses: number[];
    confusion_matrix: {
      matrix: number[][];
      true_negatives: number;
      false_positives: number;
      false_negatives: number;
      true_positives: number;
    };
    sample_predictions: {
      actual: number;
      predicted: number;
      probability: number;
      features: Record<string, any>;
    }[];
  };
  feature_importances: {
    feature: string;
    weight: number;
    abs_weight: number;
    impact: 'INCREASES_RISK' | 'DECREASES_RISK';
  }[];
  trained_at: string;
}

export interface Dataset {
  id: number;
  hospital_id: number;
  hospital_name?: string;
  dataset_name: string;
  record_count: number;
  feature_count: number;
  status: string;
  file_name?: string;
  file_size?: number;
  columns?: string[];
  column_types?: Record<string, 'numeric' | 'categorical'>;
  preview_rows?: Record<string, any>[];
  missing_values_count?: number;
  duplicate_count?: number;
  summaries?: Record<string, ColumnSummary>;
  target_candidates?: TargetCandidate[];
  data_quality?: DataQualityReport;
  trained_model?: TrainedModelResult;
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

export interface TrainingRun {
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

export interface FederatedRound {
  id: number;
  round_number: number;
  participating_hospitals: number[];
  completed_hospitals: number[];
  failed_hospitals: number[];
  global_model_version: string;
  aggregation_method: string;
  status: string;
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

export interface ModelRecord {
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
  };
  is_active: boolean;
  status: string;
  created_at: string;
}

export interface PredictionResult {
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

export interface AuditLogItem {
  id: number;
  user_id?: number;
  user_name?: string;
  action: string;
  resource: string;
  status: string;
  timestamp: string;
  metadata_json?: Record<string, any>;
}

export interface FeatureSpec {
  name: string;
  display_name: string;
  dtype: string;
  min_val: number;
  max_val: number;
  default_val: number;
  unit: string;
  description: string;
}

export interface DatasetConfig {
  dataset_name: string;
  disease_target: string;
  target_column: string;
  target_positive_label: string;
  target_negative_label: string;
  feature_columns: string[];
  features: FeatureSpec[];
}
