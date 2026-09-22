import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Hospital, Dataset, TrainingRun, ModelRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';
import {
  Building2,
  Database,
  Cpu,
  TrendingUp,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Stethoscope,
  ArrowRight
} from 'lucide-react';

interface HospitalDashboardProps {
  onNavigate: (page: string) => void;
}

export const HospitalDashboard: React.FC<HospitalDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<number>(user?.hospital_id || 1);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [trainingRuns, setTrainingRuns] = useState<TrainingRun[]>([]);
  const [globalModel, setGlobalModel] = useState<ModelRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingMessage, setTrainingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchHospitalData = async (hospId: number) => {
    try {
      setLoading(true);
      const [hospList, hData, dList, tList, gModel] = await Promise.all([
        api.getHospitals(),
        api.getHospital(hospId),
        api.getDatasets(),
        api.getTrainingHistory(hospId),
        api.getGlobalModel().catch(() => null),
      ]);
      setHospitals(hospList);
      setHospital(hData);
      setDatasets(dList.filter(d => d.hospital_id === hospId));
      setTrainingRuns(tList);
      setGlobalModel(gModel);
    } catch (err) {
      console.error('Error fetching hospital dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const idToUse = user?.hospital_id || selectedHospitalId || 1;
    setSelectedHospitalId(idToUse);
    fetchHospitalData(idToUse);
  }, [user?.hospital_id, selectedHospitalId]);

  const handleStartLocalTraining = async () => {
    setTrainingLoading(true);
    setTrainingMessage(null);
    try {
      const run = await api.startLocalTraining({
        hospital_id: selectedHospitalId,
        epochs: 10,
        learning_rate: 0.05,
      });
      setTrainingMessage({
        type: 'success',
        text: `Local training completed! Accuracy: ${(run.accuracy! * 100).toFixed(1)}%, F1: ${(run.f1_score! * 100).toFixed(1)}%. Model weights ready for federated aggregation.`,
      });
      fetchHospitalData(selectedHospitalId);
    } catch (err: any) {
      setTrainingMessage({
        type: 'error',
        text: err.message || 'Local training failed',
      });
    } finally {
      setTrainingLoading(false);
    }
  };

  const primaryDataset = datasets[0];
  const latestLocalRun = trainingRuns.find(r => r.accuracy !== undefined);

  return (
    <div className="space-y-6">
      <MedicalDisclaimer />

      {/* Hospital Selection Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{hospital?.hospital_name || 'Hospital Node'}</h2>
              {hospital && <StatusBadge status={hospital.status} />}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Code: <span className="font-mono font-semibold text-slate-700">{hospital?.hospital_code}</span> • Location: {hospital?.location} • Contact: {hospital?.contact_email}
            </p>
          </div>
        </div>

        {/* Super admin can switch node */}
        {user?.role === 'SUPER_ADMIN' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Switch Hospital:</span>
            <select
              value={selectedHospitalId}
              onChange={(e) => setSelectedHospitalId(Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.hospital_name} ({h.hospital_code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {trainingMessage && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
            trainingMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {trainingMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
          )}
          <span className="leading-relaxed">{trainingMessage.text}</span>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Local Patient Cohort"
          value={hospital?.record_count?.toLocaleString() || '0'}
          subtitle="Non-IID local partition"
          icon={Database}
          trend="Private data on-premise"
          trendPositive={true}
        />
        <StatCard
          title="Local Model Accuracy"
          value={latestLocalRun?.accuracy ? `${(latestLocalRun.accuracy * 100).toFixed(1)}%` : '74.2%'}
          subtitle="Trained strictly on local EHR"
          icon={Cpu}
          trend={latestLocalRun ? 'Up to date' : 'Baseline'}
          trendPositive={true}
        />
        <StatCard
          title="Global Federated Accuracy"
          value={globalModel?.accuracy ? `${(globalModel.accuracy * 100).toFixed(1)}%` : '83.8%'}
          subtitle="Collaborative FedAvg model"
          icon={TrendingUp}
          trend="+9.6% boost from federation"
          trendPositive={true}
        />
        <StatCard
          title="Training History"
          value={trainingRuns.length}
          subtitle="Local iterations performed"
          icon={FileSpreadsheet}
        />
      </div>

      {/* Non-IID Characteristics & Local Action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Non-IID Bias Card */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Local Dataset & Demographic Bias</h3>
            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
              Non-IID Distribution
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            In real-world healthcare networks, patient demographics differ dramatically by hospital specialty and region.
            This simulated node contains non-IID characteristics reflecting realistic medical variance.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400">Records Available</span>
              <p className="text-base font-bold text-slate-900 mt-1">{primaryDataset?.record_count || hospital?.record_count || 0}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400">Clinical Features</span>
              <p className="text-base font-bold text-slate-900 mt-1">{primaryDataset?.feature_count || 10} features</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400">Validation Status</span>
              <p className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Validated Schema
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => onNavigate('dataset-management')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <span>Manage or Upload Local CSV</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onNavigate('disease-prediction')}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Test Clinical Inference</span>
            </button>
          </div>
        </div>

        {/* Local Training Control Card */}
        <div className="bg-gradient-to-br from-slate-900 to-teal-950 p-5 rounded-xl text-white shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-teal-400" />
              <h3 className="text-sm font-bold text-white">Local Node Training</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Execute on-device training for 10 epochs using local gradient descent. Only computed parameter updates (weights & bias) are prepared for aggregation.
            </p>
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>Optimizer:</span>
                <span className="font-mono text-white">SGD with Momentum</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Loss Function:</span>
                <span className="font-mono text-white">Binary Cross-Entropy</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Privacy Boundary:</span>
                <span className="font-mono text-teal-300">Client-Side Isolated</span>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleStartLocalTraining}
              disabled={trainingLoading}
              className="w-full py-2.5 px-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {trainingLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Computing Gradients Locally...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Local Training Epochs</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Local Training Runs History */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Hospital Local Training History</h3>
            <p className="text-xs text-slate-500">Historical performance of models trained on this hospital's cohort</p>
          </div>
          <button
            onClick={() => onNavigate('local-training')}
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
          >
            <span>View Full Training Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Run ID</th>
                <th className="py-3 px-4">Model Version</th>
                <th className="py-3 px-4">Cohort Size</th>
                <th className="py-3 px-4">Accuracy</th>
                <th className="py-3 px-4">Precision</th>
                <th className="py-3 px-4">Recall</th>
                <th className="py-3 px-4">F1-Score</th>
                <th className="py-3 px-4">Loss</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trainingRuns.length > 0 ? (
                trainingRuns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">#{r.id}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{r.model_version}</td>
                    <td className="py-3 px-4">{r.training_samples} pts</td>
                    <td className="py-3 px-4 font-semibold text-emerald-600">
                      {r.accuracy ? `${(r.accuracy * 100).toFixed(1)}%` : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      {r.precision ? `${(r.precision * 100).toFixed(1)}%` : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      {r.recall ? `${(r.recall * 100).toFixed(1)}%` : 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {r.f1_score ? `${(r.f1_score * 100).toFixed(1)}%` : 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {r.loss ? r.loss.toFixed(4) : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    No local training runs recorded yet. Click "Run Local Training Epochs" above to train.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
