/**
 * HTTP Integration Test Suite using native Node.js fetch
 * Tests all REST endpoints over actual Express HTTP server instance
 */

import express from 'express';
import http from 'http';
import { authRouter } from '../server/routes/auth';
import { hospitalsRouter } from '../server/routes/hospitals';
import { datasetsRouter } from '../server/routes/datasets';
import { trainingRouter } from '../server/routes/training';
import { federatedRouter } from '../server/routes/federated';
import { modelsRouter } from '../server/routes/models';
import { predictionsRouter } from '../server/routes/predictions';
import { auditLogsRouter } from '../server/routes/auditLogs';
import { configRouter } from '../server/routes/config';

function createTestApp() {
  const app = express();
  app.use(express.json());

  app.use('/api/config', configRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/hospitals', hospitalsRouter);
  app.use('/api/datasets', datasetsRouter);
  app.use('/api/training', trainingRouter);
  app.use('/api/federated', federatedRouter);
  app.use('/api/models', modelsRouter);
  app.use('/api/predictions', predictionsRouter);
  app.use('/api/audit-logs', auditLogsRouter);

  return app;
}

async function runHttpTests() {
  const app = createTestApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  console.log('===============================================================');
  console.log(` HTTP REST API END-TO-END VERIFICATION (Server on port ${address.port}) `);
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, msg: string) {
    if (cond) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Login Super Admin
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@federatedhealth.ai', password: 'Admin@12345' }),
    });
    const loginData = await loginRes.json();
    const adminToken = loginData.access_token || loginData.token;
    assert(loginRes.status === 200, '1.1 Admin login returns 200 OK');
    assert(!!adminToken, '1.2 Admin login yields valid JWT token');

    // 1.3 Failed Login Case
    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@federatedhealth.ai', password: 'WrongPassword' }),
    });
    assert(badLogin.status === 401, '1.3 Invalid password rejected with 401 Unauthorized');

    // 2. Hospital Dashboard Endpoint
    const hospRes = await fetch(`${baseUrl}/api/hospitals`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const hospData = await hospRes.json();
    assert(hospRes.status === 200, '2.1 GET /api/hospitals returns 200');
    assert(Array.isArray(hospData) && hospData.length >= 5, '2.2 Hospital nodes list returned');

    // 3. Dataset Config Endpoint
    const dsCfgRes = await fetch(`${baseUrl}/api/config/dataset`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dsCfgData = await dsCfgRes.json();
    assert(dsCfgRes.status === 200, '3.1 GET /api/config/dataset returns 200');
    assert(dsCfgData.feature_columns.length === 10, '3.2 10 clinical feature columns defined in config');

    // 4. Local Training API Endpoint
    const trainRes = await fetch(`${baseUrl}/api/training/local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ hospital_id: 1, epochs: 5, learning_rate: 0.05, batch_size: 32 }),
    });
    const trainData = await trainRes.json();
    assert(trainRes.status === 200, '4.1 POST /api/training/local returns 200');
    assert(trainData.metrics_json.accuracy > 0.5, `4.2 Local training accuracy: ${(trainData.metrics_json.accuracy * 100).toFixed(1)}%`);

    // 5. Federated Round Execution API
    const fedRes = await fetch(`${baseUrl}/api/federated/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        rounds: 1,
        selected_hospital_ids: [1, 2, 3],
        local_epochs: 3,
        learning_rate: 0.05,
        apply_dp: true,
        dp_epsilon: 1.5,
      }),
    });
    const fedData = await fedRes.json();
    assert(fedRes.status === 200, '5.1 POST /api/federated/start returns 200');
    assert(fedData.status === 'COMPLETED', '5.2 Federated round execution status: COMPLETED');
    assert(!!fedData.latest_global_version, `5.3 New global model version produced: ${fedData.latest_global_version}`);

    // 6. Global Model Retrieval
    const modelRes = await fetch(`${baseUrl}/api/models/global`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const modelData = await modelRes.json();
    assert(modelRes.status === 200, '6.1 GET /api/models/global returns 200');
    assert(modelData.parameters_summary.weights.length === 10, '6.2 Global model has 10 feature weights');

    // 7. Clinical Disease Prediction API
    const predRes = await fetch(`${baseUrl}/api/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        features: {
          age: 62,
          sex: 1,
          chest_pain_type: 3,
          resting_bp: 155,
          cholesterol: 280,
          fasting_blood_sugar: 1,
          resting_ecg: 1,
          max_heart_rate: 120,
          exercise_angina: 1,
          st_depression: 2.4,
        },
        hospital_id: 1,
      }),
    });
    const predData = await predRes.json();
    assert(predRes.status === 200, '7.1 POST /api/predictions returns 200');
    assert(predData.probability_risk > 0, `7.2 Prediction cardiac risk: ${(predData.probability_risk * 100).toFixed(1)}%`);
    assert(!!predData.prediction_result, `7.3 Prediction outcome assigned: ${predData.prediction_result}`);

    // 8. Prediction History API
    const histRes = await fetch(`${baseUrl}/api/predictions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const histData = await histRes.json();
    assert(histRes.status === 200, '8.1 GET /api/predictions history returns 200');
    assert(Array.isArray(histData) && histData.length > 0, '8.2 Prediction history recorded');

    // 9. Audit Logs API
    const auditRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const auditData = await auditRes.json();
    assert(auditRes.status === 200, '9.1 GET /api/audit-logs returns 200');
    assert(auditData.length > 0, `9.2 Audit trail verified with ${auditData.length} logged events`);

    console.log('\n===============================================================');
    console.log(`HTTP TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');
  } finally {
    server.close();
  }

  if (failed > 0) process.exit(1);
}

runHttpTests().catch((err) => {
  console.error('Fatal HTTP test error:', err);
  process.exit(1);
});
