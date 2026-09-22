# Privacy-Preserving Federated Learning Healthcare AI Platform

An enterprise-grade, privacy-preserving collaborative healthcare intelligence platform utilizing **Federated Averaging (FedAvg)** and **Local Differential Privacy (LDP)**. Hospital client nodes train clinical diagnostic models on-premise without ever centralizing raw electronic health records (EHR) or violating HIPAA/GDPR data sovereignty boundaries.

---

## 🏛️ System Architecture

```
                                  ┌──────────────────────────────┐
                                  │      Central Coordinator      │
                                  │   (FedAvg / Global Model)    │
                                  └──────────────┬───────────────┘
                                                 │
                   ┌─────────────────────────────┼─────────────────────────────┐
                   │ (Broadcast Global Weights)  │ (Distribute Parameters)     │
                   ▼                             ▼                             ▼
     ┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
     │   Hospital Node #1        │ │   Hospital Node #2        │ │   Hospital Node #3        │
     │   Metropolitan General    │ │   St. Jude Cardiac        │ │   Rural Health Network    │
     ├───────────────────────────┤ ├───────────────────────────┤ ├───────────────────────────┤
     │  Private EHR Partition    │ │  Private EHR Partition    │ │  Private EHR Partition    │
     │  Local Mini-Batch SGD     │ │  Local Mini-Batch SGD     │ │  Local Mini-Batch SGD     │
     │  L2 Norm Gradient Clip    │ │  L2 Norm Gradient Clip    │ │  L2 Norm Gradient Clip    │
     │  Gaussian Noise Perturb   │ │  Gaussian Noise Perturb   │ │  Gaussian Noise Perturb   │
     │  SHA-256 Checksum Calc    │ │  SHA-256 Checksum Calc    │ │  SHA-256 Checksum Calc    │
     └─────────────┬─────────────┘ └─────────────┬─────────────┘ └─────────────┬─────────────┘
                   │                             │                             │
                   └─────────────────────────────┼─────────────────────────────┘
                                                 │ (Encrypted Parameter Updates)
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │   Federated Server Aggregator│
                                  │   w_{t+1} = Σ (n_k / N) * w_k│
                                  │   Global Validation Evaluation│
                                  └──────────────────────────────┘
```

---

## 🚀 Quick Start (Docker Environment)

### Prerequisites
- Docker (version 24.0+)
- Docker Compose (version 2.20+)

### 1. Start from a Clean Environment

Clone the repository and run Docker Compose:

```bash
# 1. Clean previous artifacts and start all services
docker compose down -v
docker compose build --no-cache
docker compose up -d

# 2. Verify all 5 containers are running
docker compose ps
```

The services started will include:
1. **`postgres`**: PostgreSQL 16 relational store on port `5432`
2. **`federated-server`**: Central coordinator, API engine, and Vite React frontend on port `3000`
3. **`hospital-client-1`**: Edge client daemon for Metropolitan General Hospital (Node #1)
4. **`hospital-client-2`**: Edge client daemon for St. Jude Cardiac Institute (Node #2)
5. **`hospital-client-3`**: Edge client daemon for Rural Health Network Care (Node #3)

### 2. Access the Application
Open your web browser and navigate to:
```
http://localhost:3000
```

### 3. Inspect Live Edge Node Logs
```bash
# Stream coordinator logs
docker compose logs -f federated-server

# Stream hospital client edge worker logs
docker compose logs -f hospital-client-1
```

### 4. Stop the Environment
```bash
docker compose down
```

---

## 💻 Local Development & Clean Startup

To run without Docker directly on Node.js:

```bash
# 1. Install dependencies
npm install

# 2. Run automated validation and lint check
npm run lint

# 3. Start development server (serves on http://localhost:3000)
npm run dev

# 4. Or build and run production bundle
npm run build
npm run start
```

---

## 🧪 Comprehensive Automated Testing Suite

The project includes an end-to-end testing suite covering all 15 stages of federated learning, RBAC security, mathematical FedAvg aggregation, differential privacy, failure recovery, and HTTP REST APIs:

```bash
# Execute both E2E core workflow and HTTP REST test suites
npm test
```

### Test Coverage Breakdown
- **`tests/test_e2e_federated_workflow.ts` (36 tests)**:
  - Authentication and role-based permissions (SUPER_ADMIN, HOSPITAL_ADMIN, DOCTOR)
  - Multi-hospital topology and data partition isolation
  - Clinical dataset CSV ingestion, column verification, and schema rejection
  - On-premise SGD local training with epoch loss convergence
  - Local Differential Privacy (LDP) with L2 clipping and Gaussian noise perturbation
  - Parameter serialization and SHA-256 transmission checksum verification
  - FedAvg weighted parameter aggregation: $w_{t+1} = \sum_{k=1}^K \frac{n_k}{N} w_k$
  - Global model evaluation (Accuracy, F1-Score, ROC-AUC, 2x2 Confusion Matrix)
  - Multi-model architecture comparison (Isolated vs. Federated vs. Centralized)
  - Clinical disease risk inference (High-risk vs. Low-risk validation)
  - Security audit log generation and compliance verification
- **`tests/test_http_e2e_workflow.ts` (21 tests)**:
  - Full REST API lifecycle over HTTP
  - Token-based JWT authorization and 401/403 rejection
  - Hospital metadata endpoints
  - Ingestion configuration retrieval
  - Training dispatch and federated round trigger
  - Active global model inspection
  - Diagnostic risk inference and prediction history retrieval
  - Audit logs query filtering

---

## 🔐 Demonstration Credentials

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@federatedhealth.ai` | `Admin@12345` | Global coordinator, launch rounds, system-wide audits |
| **Hospital Admin** | `admin@metrohospital.org` | `Hospital@12345` | Node #1 datasets, local SGD training, node telemetry |
| **Clinical Doctor** | `doctor@metrohospital.org` | `Doctor@12345` | Diagnostic risk prediction, patient cohort evaluation |
| **Lead Researcher**| `doctor@stjude.org` | `Doctor@12345` | Node #2 research datasets, local training validation |

---

## 📖 End-to-End Workflow Guide

1. **Login**: Authenticate via the portal using any of the seeded credentials above or use one-click quick login.
2. **Hospital Dashboard**: Review on-premise dataset volume, active edge status, and local model training metrics.
3. **Dataset Ingestion**: Upload custom 10-feature EHR CSV files (`age`, `sex`, `chest_pain_type`, `resting_bp`, `cholesterol`, `fasting_blood_sugar`, `resting_ecg`, `max_heart_rate`, `exercise_angina`, `st_depression`, `target`). Schema is strictly validated.
4. **Local Training**: Execute local mini-batch gradient descent. Observe loss curves, accuracy, and confusion matrix.
5. **Federated Round**: Super Admin triggers a multi-hospital federated training round:
   - Global model parameters are distributed to client nodes.
   - Client nodes train on local records.
   - Local Differential Privacy (LDP) applies Gaussian perturbation.
   - Updates are hashed with SHA-256 for tampering detection.
   - Central server collects updates and executes **FedAvg** aggregation.
   - New global model version is automatically published and evaluated.
6. **Disease Prediction**: Enter clinical patient measurements to generate cardiac event probabilities with confidence metrics.
7. **Audit Logs**: Review immutable operational logs tracking all training runs, rounds, uploads, and inference events.
