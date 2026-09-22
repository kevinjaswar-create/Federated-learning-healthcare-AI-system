import { AuthResponse, Hospital, Dataset, TrainingRun, FederatedRound, ModelRecord, PredictionResult, AuditLogItem, DatasetConfig, RegisterRequest, User } from '../types';

const API_BASE = '/api';

export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('fl_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response, isAuthEndpoint: boolean = false): Promise<T> {
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    if (!isAuthEndpoint) {
      localStorage.removeItem('fl_token');
      localStorage.removeItem('fl_user');
      window.dispatchEvent(new Event('auth-unauthorized'));
      throw new Error(data.detail || 'Session expired or unauthorized. Please log in.');
    }
    throw new Error(data.detail || 'Invalid email or password');
  }

  if (!res.ok) {
    const message = data.detail || (typeof data === 'string' ? data : 'An error occurred');
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<AuthResponse>(res, true);
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<AuthResponse>(res, true);
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch (e) {
      // Clean local state even if network call fails
    } finally {
      localStorage.removeItem('fl_token');
      localStorage.removeItem('fl_user');
    }
  },

  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<User>(res);
  },

  async validateToken(): Promise<{ valid: boolean; user: any }> {
    const res = await fetch(`${API_BASE}/auth/validate-token`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Role verification test endpoints
  async testAdminOnly(): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/protected/admin-only`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async testHospitalAdminOnly(): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/protected/hospital-admin`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async testClinicalOnly(): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/protected/clinical`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Health
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse(res);
  },

  // Dataset Config
  async getDatasetConfig(): Promise<DatasetConfig> {
    const res = await fetch(`${API_BASE}/config/dataset`);
    return handleResponse<DatasetConfig>(res);
  },

  // Hospitals
  async getHospitals(): Promise<Hospital[]> {
    const res = await fetch(`${API_BASE}/hospitals`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Hospital[]>(res);
  },

  async getHospital(id: number): Promise<Hospital> {
    const res = await fetch(`${API_BASE}/hospitals/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Hospital>(res);
  },

  async createHospital(data: Partial<Hospital>): Promise<Hospital> {
    const res = await fetch(`${API_BASE}/hospitals`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<Hospital>(res);
  },

  async updateHospital(id: number, data: Partial<Hospital>): Promise<Hospital> {
    const res = await fetch(`${API_BASE}/hospitals/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<Hospital>(res);
  },

  // Datasets
  async getDatasets(): Promise<Dataset[]> {
    const res = await fetch(`${API_BASE}/datasets`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Dataset[]>(res);
  },

  async getDataset(id: number): Promise<Dataset> {
    const res = await fetch(`${API_BASE}/datasets/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Dataset>(res);
  },

  async uploadDataset(hospitalId: number, name: string, file: File): Promise<Dataset> {
    const token = localStorage.getItem('fl_token');
    const formData = new FormData();
    formData.append('hospital_id', String(hospitalId));
    formData.append('dataset_name', name);
    formData.append('file', file);

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/datasets/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse<Dataset>(res);
  },

  // Local Training
  async startLocalTraining(params: {
    hospital_id: number;
    epochs?: number;
    learning_rate?: number;
    batch_size?: number;
  }): Promise<TrainingRun> {
    const res = await fetch(`${API_BASE}/training/start`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    });
    return handleResponse<TrainingRun>(res);
  },

  async getTrainingHistory(hospitalId?: number): Promise<TrainingRun[]> {
    const url = hospitalId ? `${API_BASE}/training/history?hospital_id=${hospitalId}` : `${API_BASE}/training/history`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse<TrainingRun[]>(res);
  },

  // Federated Learning
  async getFederatedStatus() {
    const res = await fetch(`${API_BASE}/federated/status`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async startFederatedTraining(params: {
    rounds: number;
    selected_hospital_ids?: number[];
    local_epochs?: number;
    learning_rate?: number;
    apply_dp?: boolean;
    dp_epsilon?: number;
  }) {
    const res = await fetch(`${API_BASE}/federated/start`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    });
    return handleResponse(res);
  },

  async getFederatedRounds(): Promise<FederatedRound[]> {
    const res = await fetch(`${API_BASE}/federated/rounds`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<FederatedRound[]>(res);
  },

  async getGlobalModel(): Promise<ModelRecord> {
    const res = await fetch(`${API_BASE}/federated/global-model`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ModelRecord>(res);
  },

  // Models & Comparison
  async getModels(): Promise<ModelRecord[]> {
    const res = await fetch(`${API_BASE}/models`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ModelRecord[]>(res);
  },

  async getModelComparison() {
    const res = await fetch(`${API_BASE}/models/comparison`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Predictions
  async predict(features: Record<string, number>, hospitalId?: number, modelVersion?: string): Promise<PredictionResult> {
    const res = await fetch(`${API_BASE}/predictions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        hospital_id: hospitalId,
        model_version: modelVersion || 'global_latest',
        features,
      }),
    });
    return handleResponse<PredictionResult>(res);
  },

  async getPredictionHistory(hospitalId?: number): Promise<PredictionResult[]> {
    const url = hospitalId ? `${API_BASE}/predictions/history?hospital_id=${hospitalId}` : `${API_BASE}/predictions/history`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse<PredictionResult[]>(res);
  },

  // Audit Logs
  async getAuditLogs(limit: number = 50): Promise<AuditLogItem[]> {
    const res = await fetch(`${API_BASE}/audit-logs?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<AuditLogItem[]>(res);
  },
};
