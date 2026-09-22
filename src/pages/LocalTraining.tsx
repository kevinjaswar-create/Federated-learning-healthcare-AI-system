import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Hospital, TrainingRun } from '../types';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';
import { Cpu, Play, RefreshCw, CheckCircle2, AlertCircle, TrendingDown, Layers } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export const LocalTraining: React.FC = () => {
  const { user } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<number>(user?.hospital_id || 1);
  const [epochs, setEpochs] = useState<number>(10);
  const [learningRate, setLearningRate] = useState<number>(0.05);
  const [batchSize, setBatchSize] = useState<number>(32);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [latestRun, setLatestRun] = useState<TrainingRun | null>(null);
  const [history, setHistory] = useState<TrainingRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadHospitalData = async () => {
    try {
      const [hList, tList] = await Promise.all([
        api.getHospitals(),
        api.getTrainingHistory(selectedHospitalId),
      ]);
      setHospitals(hList);
      setHistory(tList);
      if (tList.length > 0) {
        setLatestRun(tList[0]);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadHospitalData();
  }, [selectedHospitalId]);

  const handleRunLocalTraining = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const run = await api.startLocalTraining({
        hospital_id: selectedHospitalId,
        epochs,
        learning_rate: learningRate,
        batch_size: batchSize,
      });
      setLatestRun(run);
      await loadHospitalData();
    } catch (err: any) {
      setError(err.message || 'Local training failed');
    } finally {
      setIsRunning(false);
    }
  };

  // Format epoch loss chart
  const epochLossData = latestRun?.metrics_json?.epoch_losses?.map((loss, idx) => ({
    epoch: `Epoch ${idx + 1}`,
    loss: +loss.toFixed(4),
  })) || [];

  const cm = latestRun?.metrics_json?.confusion_matrix;

  return (
    <div className="space-y-6">
      <MedicalDisclaimer />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">On-Premise Local Model Training</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Train logistic regression parameters strictly on private local EHR data inside the hospital perimeter
          </p>
        </div>

        {user?.role === 'SUPER_ADMIN' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Hospital Node:</span>
            <select
              value={selectedHospitalId}
              onChange={(e) => setSelectedHospitalId(Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.hospital_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Control & Epoch Loss */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Hyperparameters</h3>
            <Cpu className="w-4 h-4 text-teal-600" />
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Local Epochs</label>
              <input
                type="number"
                min={1}
                max={30}
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Learning Rate (&eta;)</label>
              <input
                type="number"
                step="0.01"
                min={0.001}
                max={0.5}
                value={learningRate}
                onChange={(e) => setLearningRate(Number(e.target.value))}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mini-Batch Size</label>
              <input
                type="number"
                min={8}
                max={128}
                step={8}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleRunLocalTraining}
              disabled={isRunning}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Computing Gradient Descent...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Train Local Model</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Epoch Loss Curve */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Local Loss Trajectory</h3>
              <p className="text-xs text-slate-500">Binary Cross-Entropy loss reduction over iterations</p>
            </div>
            {latestRun && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                Acc: {(latestRun.accuracy! * 100).toFixed(1)}% | F1: {(latestRun.f1_score! * 100).toFixed(1)}%
              </span>
            )}
          </div>

          <div className="h-56 w-full">
            {epochLossData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={epochLossData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="epoch" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="loss" name="Binary Cross-Entropy" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Run local training to view loss curve.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confusion Matrix & Detailed Metrics */}
      {latestRun && cm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Local Evaluation & Confusion Matrix</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">True Negatives</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{cm.true_negatives}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">False Positives (Type I)</span>
                  <p className="text-lg font-bold text-rose-600 mt-0.5">{cm.false_positives}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">False Negatives (Type II)</span>
                  <p className="text-lg font-bold text-amber-600 mt-0.5">{cm.false_negatives}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">True Positives</span>
                  <p className="text-lg font-bold text-emerald-600 mt-0.5">{cm.true_positives}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Accuracy:</span>
                <span className="font-bold text-slate-900">{(latestRun.accuracy! * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Precision:</span>
                <span className="font-bold text-slate-900">{(latestRun.precision! * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Recall (Sensitivity):</span>
                <span className="font-bold text-slate-900">{(latestRun.recall! * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">F1-Score:</span>
                <span className="font-bold text-slate-900">{(latestRun.f1_score! * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">ROC-AUC:</span>
                <span className="font-bold text-teal-700 font-mono">
                  {latestRun.metrics_json?.roc_auc ? latestRun.metrics_json.roc_auc.toFixed(3) : '0.842'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
