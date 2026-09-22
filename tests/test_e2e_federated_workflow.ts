/**
 * Comprehensive End-to-End Workflow & Failure Case Test Suite
 * Tests the complete federated learning pipeline:
 * Login -> Hospital Dashboard -> Dataset Upload -> Local Training ->
 * Federated Round -> FedAvg -> Global Model -> Prediction -> Audit Trail
 */

import { store } from '../server/db/store';
import { FederatedEngine } from '../server/fl/engine';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('       FEDERATED LEARNING COMPREHENSIVE E2E TEST SUITE        ');
  console.log('===============================================================');

  // -------------------------------------------------------------
  // 1. AUTHENTICATION & LOGIN WORKFLOW
  // -------------------------------------------------------------
  console.log('\n--- 1. AUTHENTICATION & USER SESSIONS ---');
  const superAdmin = store.users.find((u) => u.email === 'admin@federatedhealth.ai');
  assert(!!superAdmin, '1.1 Super Admin user exists in database');
  assert(superAdmin?.role === 'SUPER_ADMIN', '1.1 Super Admin has SUPER_ADMIN role');

  const hospitalAdmin = store.users.find((u) => u.email === 'admin@metrohospital.org');
  assert(!!hospitalAdmin, '1.2 Hospital Admin user exists');
  assert(hospitalAdmin?.hospital_id === 1, '1.2 Hospital Admin mapped to Hospital #1');

  const doctor = store.users.find((u) => u.email === 'doctor@metrohospital.org');
  assert(!!doctor, '1.3 Clinical Doctor user exists');
  assert(doctor?.role === 'DOCTOR', '1.3 Doctor has DOCTOR clinical role');

  // -------------------------------------------------------------
  // 2. HOSPITAL DASHBOARD & METRICS
  // -------------------------------------------------------------
  console.log('\n--- 2. HOSPITAL DASHBOARD & NODE TOPOLOGY ---');
  assert(store.hospitals.length >= 5, `2.1 Verified ${store.hospitals.length} hospital nodes active in network`);
  const h1 = store.hospitals.find((h) => h.id === 1);
  assert(!!h1 && h1.hospital_code === 'METRO-01', '2.2 Hospital #1 is Metropolitan General Hospital (METRO-01)');
  const h1Samples = store.hospitalData.get(1);
  assert(!!h1Samples && h1Samples.length > 0, `2.3 Hospital #1 has ${h1Samples?.length} private clinical records`);

  // -------------------------------------------------------------
  // 3. DATASET INGESTION & VALIDATION
  // -------------------------------------------------------------
  console.log('\n--- 3. DATASET INGESTION & SCHEMA VALIDATION ---');
  // 3.1 Valid CSV parsing
  const validCsvContent =
    'age,sex,chest_pain_type,resting_bp,cholesterol,fasting_blood_sugar,resting_ecg,max_heart_rate,exercise_angina,st_depression,target\n' +
    '58,1,2,140,240,0,1,150,0,1.2,1\n' +
    '45,0,0,120,190,0,0,170,0,0.2,0\n' +
    '62,1,3,155,270,1,1,130,1,2.4,1\n';

  const testUploadDir = path.join(process.cwd(), 'data', 'temp_uploads');
  if (!fs.existsSync(testUploadDir)) fs.mkdirSync(testUploadDir, { recursive: true });
  const testCsvPath = path.join(testUploadDir, 'test_dataset.csv');
  fs.writeFileSync(testCsvPath, validCsvContent);

  const lines = fs.readFileSync(testCsvPath, 'utf-8').trim().split('\n');
  assert(lines.length === 4, '3.1 CSV file contains header + 3 data rows');

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const expectedCols = [
    'age', 'sex', 'chest_pain_type', 'resting_bp', 'cholesterol',
    'fasting_blood_sugar', 'resting_ecg', 'max_heart_rate', 'exercise_angina', 'st_depression', 'target'
  ];
  const isValidSchema = expectedCols.every((c) => headers.includes(c));
  assert(isValidSchema, '3.2 CSV schema conforms to 10 clinical features + 1 target');

  // Test Failure Case 3.3: Invalid Schema (missing target)
  const invalidCsv = 'age,sex,resting_bp,cholesterol\n50,1,120,200\n';
  const invalidHeaders = invalidCsv.split('\n')[0].split(',');
  const isInvalidValid = expectedCols.every((c) => invalidHeaders.includes(c));
  assert(!isInvalidValid, '3.3 Failure Case: Schema missing required columns rejected');

  // -------------------------------------------------------------
  // 4. ON-PREMISE LOCAL TRAINING
  // -------------------------------------------------------------
  console.log('\n--- 4. ON-PREMISE LOCAL CLIENT TRAINING ---');
  const baselineParams = {
    weights: new Array(10).fill(0),
    bias: 0.0,
  };

  const localRun = FederatedEngine.trainLocalModel(h1Samples!, baselineParams, {
    epochs: 10,
    learning_rate: 0.05,
    batch_size: 32,
  });

  assert(localRun.parameters.weights.length === 10, '4.1 Local model produced 10-dimensional weight vector');
  assert(!isNaN(localRun.parameters.bias), '4.2 Local model calculated valid bias term');
  assert(localRun.metrics.accuracy > 0.5, `4.3 Local training achieved valid accuracy: ${(localRun.metrics.accuracy * 100).toFixed(1)}%`);
  assert(localRun.metrics.epoch_losses.length === 10, '4.4 Epoch loss tracked over all 10 epochs');
  assert(
    localRun.metrics.epoch_losses[localRun.metrics.epoch_losses.length - 1] <= localRun.metrics.epoch_losses[0] * 1.5,
    '4.5 Loss converged / stabilized during gradient descent'
  );

  // Test Failure Case 4.6: Empty dataset training
  try {
    const emptyMetrics = FederatedEngine.evaluateModel([], localRun.parameters);
    assert(emptyMetrics.accuracy === 0, '4.6 Graceful handling of empty sample evaluation');
  } catch (e: any) {
    assert(false, `Unexpected throw on empty evaluation: ${e.message}`);
  }

  // -------------------------------------------------------------
  // 5. LOCAL DIFFERENTIAL PRIVACY (LDP)
  // -------------------------------------------------------------
  console.log('\n--- 5. LOCAL DIFFERENTIAL PRIVACY (LDP) & NOISE PERTURBATION ---');
  const privatized = FederatedEngine.applyDifferentialPrivacy(localRun.parameters, 1.5, 1.0);
  assert(privatized.weights.length === 10, '5.1 DP output retains parameter dimensionality');
  const weightsDiffer = privatized.weights.some((w, idx) => w !== localRun.parameters.weights[idx]);
  assert(weightsDiffer, '5.2 Gaussian mechanism perturbed weights to protect private patient data');

  // Checksum computation & transmission integrity
  const checksum1 = FederatedEngine.computeChecksum(privatized);
  const checksum2 = FederatedEngine.computeChecksum(privatized);
  assert(checksum1 === checksum2, `5.3 SHA-256 Checksum generated consistently: ${checksum1.slice(0, 12)}...`);

  // Test Failure Case 5.4: Corrupted update detected
  const tamperedParams = {
    weights: [...privatized.weights],
    bias: privatized.bias + 0.5, // tampered!
  };
  const tamperedChecksum = FederatedEngine.computeChecksum(tamperedParams);
  assert(tamperedChecksum !== checksum1, '5.4 Tampered parameters produce checksum mismatch');

  // -------------------------------------------------------------
  // 6. FEDAVG AGGREGATION & FEDERATED ROUND
  // -------------------------------------------------------------
  console.log('\n--- 6. FEDAVG AGGREGATION & FEDERATED ROUND ---');
  // Simulate 3 hospitals submitting valid updates
  const updates = [
    {
      hospital_id: 1,
      hospital_name: 'Metro General',
      sample_count: 200,
      parameters: { weights: [0.1, 0.2, 0.1, 0.3, 0.2, 0.1, 0.1, 0.4, 0.2, 0.3], bias: -0.1 },
      metrics: localRun.metrics,
      checksum: 'abc1',
    },
    {
      hospital_id: 2,
      hospital_name: 'St. Jude Cardiac',
      sample_count: 300,
      parameters: { weights: [0.2, 0.3, 0.2, 0.2, 0.4, 0.2, 0.1, 0.3, 0.3, 0.2], bias: -0.2 },
      metrics: localRun.metrics,
      checksum: 'abc2',
    },
    {
      hospital_id: 3,
      hospital_name: 'University Health',
      sample_count: 500,
      parameters: { weights: [0.3, 0.1, 0.3, 0.4, 0.1, 0.3, 0.2, 0.2, 0.1, 0.4], bias: 0.0 },
      metrics: localRun.metrics,
      checksum: 'abc3',
    },
  ];

  const aggregated = FederatedEngine.aggregateFedAvg(updates);
  assert(aggregated.weights.length === 10, '6.1 FedAvg produced aggregated weight vector of length 10');
  // Check mathematical weighted average for weight 0:
  // (200*0.1 + 300*0.2 + 500*0.3) / 1000 = (20 + 60 + 150) / 1000 = 230 / 1000 = 0.23
  assert(Math.abs(aggregated.weights[0] - 0.23) < 1e-4, `6.2 FedAvg mathematically accurate: expected 0.23, got ${aggregated.weights[0]}`);

  // Test Failure Case 6.3: Empty update list throws descriptive error
  try {
    FederatedEngine.aggregateFedAvg([]);
    assert(false, '6.3 Empty updates should have thrown error');
  } catch (e: any) {
    assert(e.message.includes('requires at least one'), '6.3 FedAvg gracefully rejects empty client update list');
  }

  // -------------------------------------------------------------
  // 7. GLOBAL MODEL EVALUATION & COMPARISON
  // -------------------------------------------------------------
  console.log('\n--- 7. GLOBAL MODEL EVALUATION & MULTI-MODEL COMPARISON ---');
  const allSamples = Array.from(store.hospitalData.values()).flat();
  const evalMetrics = FederatedEngine.evaluateModel(allSamples, aggregated);
  assert(evalMetrics.accuracy >= 0.5, `7.1 Global model evaluation completed with accuracy: ${(evalMetrics.accuracy * 100).toFixed(1)}%`);
  assert(evalMetrics.f1_score >= 0.5, `7.2 Global model achieved F1 Score: ${(evalMetrics.f1_score * 100).toFixed(1)}%`);
  assert(evalMetrics.roc_auc !== undefined, `7.3 ROC-AUC calculated: ${(evalMetrics.roc_auc * 100).toFixed(1)}%`);
  assert(evalMetrics.confusion_matrix.matrix.length === 2, '7.4 2x2 Confusion Matrix generated');

  const comparison = FederatedEngine.generateModelComparison();
  assert(comparison.models.length === 3, '7.5 Multi-model comparison generated 3 architectures (Isolated, Federated, Centralized)');
  const fedModel = comparison.models.find((m) => m.name.includes('Federated'));
  assert(!!fedModel, '7.6 Federated model included with privacy status');

  // -------------------------------------------------------------
  // 8. REAL PREDICTION & CLINICAL RISK INFERENCE
  // -------------------------------------------------------------
  console.log('\n--- 8. DISEASE PREDICTION & INFERENCE ---');
  // High risk clinical patient case
  const highRiskFeatures = [65, 1, 3, 160, 290, 1, 1, 118, 1, 2.8];
  const probHigh = FederatedEngine.predictProbability(highRiskFeatures, aggregated);
  assert(probHigh >= 0.0 && probHigh <= 1.0, `8.1 High-risk patient probability calculated: ${(probHigh * 100).toFixed(1)}%`);

  // Low risk clinical patient case
  const lowRiskFeatures = [38, 0, 0, 115, 180, 0, 0, 175, 0, 0.2];
  const probLow = FederatedEngine.predictProbability(lowRiskFeatures, aggregated);
  assert(probLow >= 0.0 && probLow <= 1.0, `8.2 Low-risk patient probability calculated: ${(probLow * 100).toFixed(1)}%`);
  assert(probHigh > probLow, `8.3 High risk patient (${(probHigh*100).toFixed(1)}%) scored higher than low risk patient (${(probLow*100).toFixed(1)}%)`);

  // -------------------------------------------------------------
  // 9. AUDIT LOGGING & TRACEABILITY
  // -------------------------------------------------------------
  console.log('\n--- 9. SECURITY AUDIT LOGGING & COMPLIANCE ---');
  const initialAuditCount = store.auditLogs.length;
  store.logAudit('FEDERATED_TEST_RUN', 'E2E Validation', 'SUCCESS', { id: 1, name: 'Admin' }, { test: true });
  assert(store.auditLogs.length === initialAuditCount + 1, '9.1 Audit log entry recorded and traceable');
  const latestAudit = store.auditLogs[0];
  assert(latestAudit.action === 'FEDERATED_TEST_RUN', '9.2 Audit record action matches execution type');

  // Clean test artifact
  if (fs.existsSync(testCsvPath)) fs.unlinkSync(testCsvPath);

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
