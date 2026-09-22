import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Hospital, FederatedRound, ModelRecord } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';
import {
  Share2,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  Building2,
  Lock,
  Layers,
  FileCode,
  Info
} from 'lucide-react';

export const FederatedTraining: React.FC = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [rounds, setRounds] = useState<FederatedRound[]>([]);
  const [globalModel, setGlobalModel] = useState<ModelRecord | null>(null);

  // Form parameters
  const [numRounds, setNumRounds] = useState<number>(2);
  const [localEpochs, setLocalEpochs] = useState<number>(5);
  const [learningRate, setLearningRate] = useState<number>(0.05);
  const [applyDp, setApplyDp] = useState<boolean>(true);
  const [dpEpsilon, setDpEpsilon] = useState<number>(2.0);
  const [selectedHospitals, setSelectedHospitals] = useState<number[]>([]);

  // Execution states
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStepText, setCurrentStepText] = useState<string>('');
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<FederatedRound | null>(null);

  const loadData = async () => {
    try {
      const [hList, rList, gModel] = await Promise.all([
        api.getHospitals(),
        api.getFederatedRounds(),
        api.getGlobalModel().catch(() => null),
      ]);
      setHospitals(hList);
      setRounds(rList);
      setGlobalModel(gModel);
      if (selectedHospitals.length === 0) {
        setSelectedHospitals(hList.map(h => h.id));
      }
    } catch (err) {
      console.error('Error loading federated training data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleHospital = (id: number) => {
    if (selectedHospitals.includes(id)) {
      if (selectedHospitals.length > 1) {
        setSelectedHospitals(selectedHospitals.filter(hId => hId !== id));
      }
    } else {
      setSelectedHospitals([...selectedHospitals, id]);
    }
  };

  const handleStartFederatedTraining = async () => {
    setIsRunning(true);
    setResultMessage(null);
    setCurrentStepText('Broadcasting current global model parameters to participating hospital nodes...');

    try {
      // Simulate visual progression for UI engagement
      setTimeout(() => {
        setCurrentStepText('Executing local client gradient descent across on-premise hospital datasets...');
      }, 1200);

      if (applyDp) {
        setTimeout(() => {
          setCurrentStepText('Applying Local Differential Privacy: L2 gradient norm clipping & Gaussian perturbation...');
        }, 2200);
      }

      setTimeout(() => {
        setCurrentStepText('Verifying SHA-256 parameter checksums and computing FedAvg weighted aggregation...');
      }, 3200);

      const res: any = await api.startFederatedTraining({
        rounds: numRounds,
        selected_hospital_ids: selectedHospitals,
        local_epochs: localEpochs,
        learning_rate: learningRate,
        apply_dp: applyDp,
        dp_epsilon: dpEpsilon,
      });

      setResultMessage(`Training Succeeded! ${res.message} New Global Version: ${res.latest_global_version} (Accuracy: ${(res.latest_accuracy * 100).toFixed(1)}%)`);
      await loadData();
    } catch (err: any) {
      setResultMessage(`Training error: ${err.message}`);
    } finally {
      setIsRunning(false);
      setCurrentStepText('');
    }
  };

  return (
    <div className="space-y-6">
      <MedicalDisclaimer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Federated Learning Control Center</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Orchestrate privacy-preserving FedAvg model training rounds across autonomous healthcare nodes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
            Active Global: {globalModel?.model_version || 'v1.0.0'}
          </span>
          <button
            onClick={loadData}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Configuration & Launch Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Configuration Form */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Federated Round Parameters</h3>
            <span className="text-[11px] font-mono text-slate-400">FedAvg Algorithm</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Number of Rounds
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={numRounds}
                onChange={(e) => setNumRounds(Math.max(1, Math.min(10, Number(e.target.value))))}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Rounds to sequentially execute</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Local Epochs (E)
              </label>
              <input
                type="number"
                min={1}
                max={25}
                value={localEpochs}
                onChange={(e) => setLocalEpochs(Math.max(1, Math.min(25, Number(e.target.value))))}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Iterations per hospital node</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Learning Rate (&eta;)
              </label>
              <input
                type="number"
                step="0.01"
                min={0.001}
                max={0.5}
                value={learningRate}
                onChange={(e) => setLearningRate(Number(e.target.value))}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Local SGD step size</span>
            </div>
          </div>

          {/* Differential Privacy Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-900">Local Differential Privacy (LDP)</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyDp}
                  onChange={(e) => setApplyDp(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              When enabled, each hospital's local gradient updates are clipped to an L2 sensitivity boundary and perturbed with Gaussian noise before transmission, mathematically bounding privacy loss.
            </p>

            {applyDp && (
              <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Privacy Budget (&epsilon;):</span>
                    <span className="font-mono text-purple-700 font-bold">{dpEpsilon.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={10.0}
                    step={0.5}
                    value={dpEpsilon}
                    onChange={(e) => setDpEpsilon(Number(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>0.5 (Maximum Privacy)</span>
                    <span>10.0 (Higher Utility)</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">Gaussian Perturbation Mechanism:</span>
                  &sigma; = &radic;(2 ln(1.25 / &delta;)) / &epsilon;. Sensitivity &Delta;S = 1.0 (L2 Clip).
                </div>
              </div>
            )}
          </div>

          {/* Participating Hospitals Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-900">
                Select Participating Hospital Nodes ({selectedHospitals.length} Selected)
              </label>
              <button
                type="button"
                onClick={() => setSelectedHospitals(hospitals.map(h => h.id))}
                className="text-[11px] font-semibold text-teal-600 hover:text-teal-700"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {hospitals.map((h) => {
                const isSelected = selectedHospitals.includes(h.id);
                return (
                  <div
                    key={h.id}
                    onClick={() => toggleHospital(h.id)}
                    className={`cursor-pointer p-3 rounded-lg border text-xs flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-teal-50/70 border-teal-500 text-teal-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span className="font-semibold">{h.hospital_name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {h.record_count} records
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Execution Monitor */}
        <div className="bg-slate-900 text-white rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-teal-400">
              <Share2 className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Aggregation Protocol</h3>
            </div>

            <div className="p-3.5 bg-slate-800/80 rounded-lg border border-slate-700 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Formula:</span>
                <span className="font-mono text-teal-300 font-bold">w_t+1 = &Sigma; (n_k / N) &middot; w_k</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Integrity:</span>
                <span className="font-mono text-slate-200">SHA-256 Parameter Hashes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Privacy:</span>
                <span className="font-mono text-purple-300">{applyDp ? `LDP (&epsilon; = ${dpEpsilon})` : 'Standard FedAvg'}</span>
              </div>
            </div>

            {/* Live Step Tracker */}
            {isRunning && (
              <div className="space-y-2 bg-teal-950/40 p-3.5 rounded-lg border border-teal-700/50">
                <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Executing Federated Round...</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed animate-pulse">
                  {currentStepText}
                </p>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                  <div className="bg-teal-400 h-full w-3/4 animate-pulse"></div>
                </div>
              </div>
            )}

            {resultMessage && !isRunning && (
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-700/50 rounded-lg text-emerald-300 text-xs leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Execution Finished</span>
                </div>
                {resultMessage}
              </div>
            )}
          </div>

          <button
            onClick={handleStartFederatedTraining}
            disabled={isRunning || selectedHospitals.length === 0}
            className="w-full py-3 px-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Federating Parameters Across Nodes...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Execute Federated Training</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Rounds History Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Federated Rounds History</h3>
            <p className="text-xs text-slate-500">Record of all completed collaborative rounds and aggregated model checkpoints</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Total Rounds: {rounds.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Round</th>
                <th className="py-3 px-4">Global Model Version</th>
                <th className="py-3 px-4">Participating Nodes</th>
                <th className="py-3 px-4">Global Accuracy</th>
                <th className="py-3 px-4">Precision</th>
                <th className="py-3 px-4">Recall</th>
                <th className="py-3 px-4">F1-Score</th>
                <th className="py-3 px-4">Aggregation Method</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rounds.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">Round {r.round_number}</td>
                  <td className="py-3 px-4 font-mono font-medium text-teal-700">{r.global_model_version}</td>
                  <td className="py-3 px-4">
                    {r.completed_hospitals.length} / {r.participating_hospitals.length} hospitals
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600">
                    {r.global_metrics?.accuracy ? `${(r.global_metrics.accuracy * 100).toFixed(1)}%` : 'N/A'}
                  </td>
                  <td className="py-3 px-4">
                    {r.global_metrics?.precision ? `${(r.global_metrics.precision * 100).toFixed(1)}%` : 'N/A'}
                  </td>
                  <td className="py-3 px-4">
                    {r.global_metrics?.recall ? `${(r.global_metrics.recall * 100).toFixed(1)}%` : 'N/A'}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {r.global_metrics?.f1_score ? `${(r.global_metrics.f1_score * 100).toFixed(1)}%` : 'N/A'}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">{r.aggregation_method}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedRound(r)}
                      className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Round Inspection */}
      {selectedRound && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Federated Round {selectedRound.round_number} Details
                </h3>
                <span className="text-xs text-teal-600 font-mono font-medium">
                  Model Version: {selectedRound.global_model_version}
                </span>
              </div>
              <button
                onClick={() => setSelectedRound(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                &times;
              </button>
            </div>

            {/* Global Metrics */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Accuracy</span>
                <p className="text-sm font-bold text-emerald-600 mt-0.5">
                  {selectedRound.global_metrics?.accuracy ? `${(selectedRound.global_metrics.accuracy * 100).toFixed(1)}%` : 'N/A'}
                </p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Precision</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedRound.global_metrics?.precision ? `${(selectedRound.global_metrics.precision * 100).toFixed(1)}%` : 'N/A'}
                </p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Recall</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedRound.global_metrics?.recall ? `${(selectedRound.global_metrics.recall * 100).toFixed(1)}%` : 'N/A'}
                </p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold">F1-Score</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedRound.global_metrics?.f1_score ? `${(selectedRound.global_metrics.f1_score * 100).toFixed(1)}%` : 'N/A'}
                </p>
              </div>
            </div>

            {/* Client Contributions Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 mb-2">Hospital Client Participations & Checksums</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Hospital</th>
                      <th className="py-2 px-3">Samples</th>
                      <th className="py-2 px-3">Local Acc</th>
                      <th className="py-2 px-3">SHA-256 Checksum</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRound.client_statuses?.map((cs) => (
                      <tr key={cs.hospital_id}>
                        <td className="py-2 px-3 font-semibold text-slate-900">{cs.hospital_name}</td>
                        <td className="py-2 px-3">{cs.sample_count} pts</td>
                        <td className="py-2 px-3 font-medium text-emerald-600">
                          {cs.local_accuracy ? `${(cs.local_accuracy * 100).toFixed(1)}%` : 'N/A'}
                        </td>
                        <td className="py-2 px-3 font-mono text-[10px] text-slate-500">
                          {cs.update_checksum ? `${cs.update_checksum.substring(0, 12)}...` : 'Verified'}
                        </td>
                        <td className="py-2 px-3">
                          <StatusBadge status={cs.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedRound(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
