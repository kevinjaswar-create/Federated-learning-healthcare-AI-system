import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { PredictionResult } from '../types';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';
import { History, RefreshCw, Stethoscope, Search } from 'lucide-react';

export const PredictionHistory: React.FC = () => {
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getPredictionHistory();
      setPredictions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filtered = predictions.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.prediction_result.toLowerCase().includes(q) ||
      p.model_version.toLowerCase().includes(q) ||
      (p.hospital_name && p.hospital_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <MedicalDisclaimer />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Clinical Prediction History</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit log of clinical disease risk inferences executed across federated hospital partitions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by result or hospital..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={fetchHistory}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Hospital Entity</th>
                <th className="py-3 px-4">Model Version</th>
                <th className="py-3 px-4">Inference Outcome</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Cardiac Risk %</th>
                <th className="py-3 px-4">Clinical Inputs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? (
                filtered.map((p) => {
                  const isHigh =
                    p.prediction_result.toLowerCase().includes('positive') ||
                    p.prediction_result.toLowerCase().includes('high');
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(p.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {p.hospital_name || 'Hospital Node'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 font-medium">{p.model_version}</td>
                      <td className="py-3 px-4 font-bold">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          isHigh
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {p.prediction_result}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {(p.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {(p.probability_risk * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">
                        Age: {p.input_features?.age}, BP: {p.input_features?.resting_bp}, Chol: {p.input_features?.cholesterol}, HR: {p.input_features?.max_heart_rate}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No predictions recorded yet. Run a prediction in the "Disease Risk Prediction" tab.
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
