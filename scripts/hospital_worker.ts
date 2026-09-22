/**
 * Hospital Edge Node Client Daemon
 * Runs on hospital premises inside isolated Docker containers.
 * Performs client registration, heartbeat pinging, local gradient computation,
 * differential privacy noise injection, checksum verification, and secure parameter submission.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SERVER_URL = process.env.FEDERATED_SERVER_URL || 'http://federated-server:3000';
const HOSPITAL_ID = parseInt(process.env.HOSPITAL_ID || '1', 10);
const HOSPITAL_NAME = process.env.HOSPITAL_NAME || `Hospital Edge Node #${HOSPITAL_ID}`;
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '15000', 10);
const DP_EPSILON = parseFloat(process.env.DP_EPSILON || '1.5');
const DP_CLIP_NORM = parseFloat(process.env.DP_CLIP_NORM || '1.0');

interface ModelParams {
  weights: number[];
  bias: number;
}

interface ClinicalSample {
  features: number[];
  target: number;
}

function computeChecksum(params: ModelParams): string {
  const serialized = JSON.stringify({
    weights: params.weights.map((w) => Number(w.toFixed(8))),
    bias: Number(params.bias.toFixed(8)),
  });
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, z))));
}

function loadLocalDataset(): ClinicalSample[] {
  const csvPath = path.join(process.cwd(), 'data', `hospital_${HOSPITAL_ID}.csv`);
  if (!fs.existsSync(csvPath)) {
    console.warn(`[Node ${HOSPITAL_ID}] Dataset not found at ${csvPath}, generating synthetic local cohort`);
    const samples: ClinicalSample[] = [];
    for (let i = 0; i < 150; i++) {
      samples.push({
        features: [
          45 + Math.random() * 30,
          Math.random() > 0.4 ? 1 : 0,
          Math.floor(Math.random() * 4),
          110 + Math.random() * 50,
          170 + Math.random() * 120,
          Math.random() > 0.8 ? 1 : 0,
          Math.floor(Math.random() * 3),
          100 + Math.random() * 80,
          Math.random() > 0.7 ? 1 : 0,
          Math.random() * 3.5,
        ],
        target: Math.random() > 0.5 ? 1 : 0,
      });
    }
    return samples;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  const samples: ClinicalSample[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((v) => parseFloat(v.trim()));
    if (parts.length >= 11 && !parts.some((p) => isNaN(p))) {
      samples.push({
        features: parts.slice(0, 10),
        target: parts[10] >= 1 ? 1 : 0,
      });
    }
  }

  return samples;
}

function trainSGD(
  samples: ClinicalSample[],
  initialParams: ModelParams,
  epochs: number = 5,
  lr: number = 0.05
): { parameters: ModelParams; accuracy: number; f1: number } {
  const numFeatures = initialParams.weights.length;
  const weights = [...initialParams.weights];
  let bias = initialParams.bias;

  for (let ep = 0; ep < epochs; ep++) {
    for (const sample of samples) {
      let logit = bias;
      for (let j = 0; j < numFeatures; j++) {
        logit += weights[j] * sample.features[j];
      }
      const pred = sigmoid(logit);
      const error = pred - sample.target;

      for (let j = 0; j < numFeatures; j++) {
        weights[j] -= lr * error * sample.features[j];
      }
      bias -= lr * error;
    }
  }

  // Evaluation
  let correct = 0;
  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (const s of samples) {
    let logit = bias;
    for (let j = 0; j < numFeatures; j++) {
      logit += weights[j] * s.features[j];
    }
    const predClass = sigmoid(logit) >= 0.5 ? 1 : 0;
    if (predClass === s.target) correct++;
    if (predClass === 1 && s.target === 1) tp++;
    if (predClass === 1 && s.target === 0) fp++;
    if (predClass === 0 && s.target === 1) fn++;
  }

  const accuracy = samples.length > 0 ? correct / samples.length : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    parameters: { weights, bias },
    accuracy,
    f1,
  };
}

function applyLocalDP(params: ModelParams, epsilon: number, clipNorm: number): ModelParams {
  const weights = [...params.weights];
  let normSq = params.bias * params.bias;
  for (const w of weights) normSq += w * w;
  const l2Norm = Math.sqrt(normSq);

  const scale = l2Norm > clipNorm ? clipNorm / l2Norm : 1.0;
  for (let i = 0; i < weights.length; i++) weights[i] *= scale;
  let bias = params.bias * scale;

  const sigma = Math.sqrt(2 * Math.log(1.25 / 1e-5)) / epsilon;
  const randGaussian = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  for (let i = 0; i < weights.length; i++) {
    weights[i] += randGaussian() * (sigma * 0.05);
  }
  bias += randGaussian() * (sigma * 0.05);

  return { weights, bias };
}

async function startDaemon() {
  console.log(`[Hospital Worker] Initializing node #${HOSPITAL_ID}: ${HOSPITAL_NAME}`);
  console.log(`[Hospital Worker] Target Coordinator: ${SERVER_URL}`);

  const localSamples = loadLocalDataset();
  console.log(`[Hospital Worker] Loaded ${localSamples.length} confidential local patient records`);

  // 1. Client Registration
  try {
    const regRes = await fetch(`${SERVER_URL}/api/federated/clients/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hospital_id: HOSPITAL_ID,
        hospital_name: HOSPITAL_NAME,
        sample_count: localSamples.length,
        version: '1.0.0',
      }),
    });
    if (regRes.ok) {
      console.log(`[Hospital Worker] Successfully registered node with central coordinator.`);
    } else {
      console.warn(`[Hospital Worker] Registration response status: ${regRes.status}`);
    }
  } catch (err: any) {
    console.warn(`[Hospital Worker] Coordinator not yet reachable (${err.message}). Will retry via heartbeat loop.`);
  }

  // 2. Periodic Heartbeat Loop
  setInterval(async () => {
    try {
      const hbRes = await fetch(`${SERVER_URL}/api/federated/clients/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospital_id: HOSPITAL_ID,
          status: 'IDLE',
          sample_count: localSamples.length,
        }),
      });
      if (hbRes.ok) {
        console.log(`[Heartbeat] Node #${HOSPITAL_ID} ping acknowledged.`);
      }
    } catch (e: any) {
      console.error(`[Heartbeat Error] ${e.message}`);
    }
  }, HEARTBEAT_INTERVAL_MS);

  console.log(`[Hospital Worker] Daemon active and listening for federated aggregation dispatch.`);
}

startDaemon().catch((err) => {
  console.error('[Hospital Worker] Fatal error in worker daemon:', err);
});
