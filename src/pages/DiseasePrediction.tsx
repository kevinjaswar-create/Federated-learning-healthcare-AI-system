import React, { useState } from 'react';
import { api } from '../services/api';
import { PredictionResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';
import {
  Stethoscope,
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Info,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export const DiseasePrediction: React.FC = () => {
  const { user } = useAuth();

  // Patient clinical feature fields
  const [age, setAge] = useState<number>(55);
  const [sex, setSex] = useState<number>(1);
  const [chestPainType, setChestPainType] = useState<number>(1);
  const [restingBp, setRestingBp] = useState<number>(130);
  const [cholesterol, setCholesterol] = useState<number>(230);
  const [fastingBs, setFastingBs] = useState<number>(0);
  const [restingEcg, setRestingEcg] = useState<number>(0);
  const [maxHeartRate, setMaxHeartRate] = useState<number>(150);
  const [exerciseAngina, setExerciseAngina] = useState<number>(0);
  const [stDepression, setStDepression] = useState<number>(1.0);

  const [loading, setLoading] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preset cases for easy faculty/mentor review
  const loadPreset = (type: 'healthy' | 'high_risk' | 'moderate') => {
    if (type === 'healthy') {
      setAge(38);
      setSex(0);
      setChestPainType(0);
      setRestingBp(115);
      setCholesterol(180);
      setFastingBs(0);
      setRestingEcg(0);
      setMaxHeartRate(175);
      setExerciseAngina(0);
      setStDepression(0.2);
    } else if (type === 'high_risk') {
      setAge(65);
      setSex(1);
      setChestPainType(3);
      setRestingBp(160);
      setCholesterol(290);
      setFastingBs(1);
      setRestingEcg(1);
      setMaxHeartRate(118);
      setExerciseAngina(1);
      setStDepression(2.8);
    } else {
      setAge(52);
      setSex(1);
      setChestPainType(2);
      setRestingBp(138);
      setCholesterol(240);
      setFastingBs(0);
      setRestingEcg(0);
      setMaxHeartRate(142);
      setExerciseAngina(0);
      setStDepression(1.1);
    }
    setPrediction(null);
    setError(null);
  };

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const features = {
        age: Number(age),
        sex: Number(sex),
        chest_pain_type: Number(chestPainType),
        resting_bp: Number(restingBp),
        cholesterol: Number(cholesterol),
        fasting_blood_sugar: Number(fastingBs),
        resting_ecg: Number(restingEcg),
        max_heart_rate: Number(maxHeartRate),
        exercise_angina: Number(exerciseAngina),
        st_depression: Number(stDepression),
      };

      const res = await api.predict(features, user?.hospital_id || 1);
      setPrediction(res);
    } catch (err: any) {
      setError(err.message || 'Inference failed');
    } finally {
      setLoading(false);
    }
  };

  const isHighRisk = prediction?.prediction_result.includes('Risk Detected');

  return (
    <div className="space-y-6">
      <MedicalDisclaimer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Clinical Disease Risk Prediction</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Test multi-hospital collaborative FedAvg model inference on clinical patient parameters
          </p>
        </div>

        {/* Quick Fill Presets */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 px-2">Presets:</span>
          <button
            type="button"
            onClick={() => loadPreset('healthy')}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded shadow-xs border border-slate-200"
          >
            Normal Cohort
          </button>
          <button
            type="button"
            onClick={() => loadPreset('moderate')}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded shadow-xs border border-slate-200"
          >
            Borderline
          </button>
          <button
            type="button"
            onClick={() => loadPreset('high_risk')}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-rose-700 font-medium rounded shadow-xs border border-slate-200"
          >
            High Cardiac Risk
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Inputs (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Patient Clinical Parameters</h3>
            <span className="text-xs text-teal-600 font-medium">Standardized 10-Feature Vector</span>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handlePredict} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Age */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Age (Years)
                </label>
                <input
                  type="number"
                  min={20}
                  max={95}
                  required
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Sex */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Biological Sex
                </label>
                <select
                  value={sex}
                  onChange={(e) => setSex(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value={1}>Male (1)</option>
                  <option value={0}>Female (0)</option>
                </select>
              </div>

              {/* Chest Pain Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chest Pain Classification
                </label>
                <select
                  value={chestPainType}
                  onChange={(e) => setChestPainType(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value={0}>0: Typical Angina</option>
                  <option value={1}>1: Atypical Angina</option>
                  <option value={2}>2: Non-Anginal Discomfort</option>
                  <option value={3}>3: Asymptomatic</option>
                </select>
              </div>

              {/* Resting Blood Pressure */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resting BP (mm Hg)
                </label>
                <input
                  type="number"
                  min={80}
                  max={220}
                  required
                  value={restingBp}
                  onChange={(e) => setRestingBp(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Cholesterol */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Serum Cholesterol (mg/dL)
                </label>
                <input
                  type="number"
                  min={100}
                  max={550}
                  required
                  value={cholesterol}
                  onChange={(e) => setCholesterol(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Fasting Blood Sugar */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fasting Blood Sugar &gt; 120 mg/dL
                </label>
                <select
                  value={fastingBs}
                  onChange={(e) => setFastingBs(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value={0}>False / Normal (&le;120 mg/dL)</option>
                  <option value={1}>True / Elevated (&gt;120 mg/dL)</option>
                </select>
              </div>

              {/* Resting ECG */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resting Electrocardiogram (ECG)
                </label>
                <select
                  value={restingEcg}
                  onChange={(e) => setRestingEcg(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value={0}>0: Normal</option>
                  <option value={1}>1: ST-T Wave Abnormality</option>
                  <option value={2}>2: Left Ventricular Hypertrophy</option>
                </select>
              </div>

              {/* Maximum Heart Rate */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Heart Rate Achieved (bpm)
                </label>
                <input
                  type="number"
                  min={60}
                  max={230}
                  required
                  value={maxHeartRate}
                  onChange={(e) => setMaxHeartRate(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Exercise Induced Angina */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Exercise Induced Angina
                </label>
                <select
                  value={exerciseAngina}
                  onChange={(e) => setExerciseAngina(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value={0}>No (0)</option>
                  <option value={1}>Yes (1)</option>
                </select>
              </div>

              {/* ST Depression */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ST Depression (mm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={0.0}
                  max={6.5}
                  required
                  value={stDepression}
                  onChange={(e) => setStDepression(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing FedAvg Model Inference...</span>
                  </>
                ) : (
                  <>
                    <HeartPulse className="w-4 h-4" />
                    <span>Run Disease Risk Inference</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Prediction Results Display */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Inference Outcome</h3>
              <span className="text-[11px] font-mono text-slate-400">Global FedAvg Model</span>
            </div>

            {prediction ? (
              <div className="space-y-4">
                {/* Result Card */}
                <div
                  className={`p-4 rounded-xl border ${
                    isHighRisk
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isHighRisk ? (
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                    <span className="text-sm font-bold">{prediction.prediction_result}</span>
                  </div>

                  <div className="text-xs space-y-1 mt-2 pt-2 border-t border-slate-200/50">
                    <div className="flex justify-between">
                      <span>Model Confidence:</span>
                      <span className="font-bold">{(prediction.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cardiovascular Risk Probability:</span>
                      <span className="font-bold font-mono">{(prediction.probability_risk * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* Visual Probability Distribution Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span>Healthy / Low: {(prediction.probability_healthy * 100).toFixed(1)}%</span>
                    <span>Elevated Risk: {(prediction.probability_risk * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${(prediction.probability_healthy * 100).toFixed(1)}%` }}
                    ></div>
                    <div
                      className="bg-rose-500 h-full transition-all"
                      style={{ width: `${(prediction.probability_risk * 100).toFixed(1)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 space-y-1">
                  <div>Model Version: <span className="font-mono text-slate-800 font-semibold">{prediction.model_version}</span></div>
                  <div>Inference Hospital: <span className="text-slate-800 font-medium">{prediction.hospital_name || 'Hospital Node'}</span></div>
                  <div>Timestamp: <span className="text-slate-800">{new Date(prediction.created_at).toLocaleTimeString()}</span></div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Stethoscope className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs">
                  Fill patient clinical parameters on the left and click "Run Disease Risk Inference" to calculate risk probability.
                </p>
              </div>
            )}
          </div>

          {/* Mandatory Academic Prototype Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 leading-tight">
            <strong>Prototype Disclaimer:</strong> Experimental prediction for research demonstration only. Not approved for patient diagnosis.
          </div>
        </div>
      </div>
    </div>
  );
};
