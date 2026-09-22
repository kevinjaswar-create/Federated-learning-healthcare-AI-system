import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Hospital, Dataset, DatasetConfig } from '../types';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';
import {
  Database,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Layers,
  Lock
} from 'lucide-react';

export const DatasetManagement: React.FC = () => {
  const { user } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<number>(user?.hospital_id || 1);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetConfig, setDatasetConfig] = useState<DatasetConfig | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState('Hospital Cohort Update');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  const loadData = async () => {
    try {
      const [hList, dList, cfg] = await Promise.all([
        api.getHospitals(),
        api.getDatasets(),
        api.getDatasetConfig().catch(() => null),
      ]);
      setHospitals(hList);
      setDatasets(dList);
      setDatasetConfig(cfg);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadMessage(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadMessage({ type: 'error', text: 'Please select a valid CSV dataset file.' });
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);
    try {
      const created = await api.uploadDataset(selectedHospitalId, datasetName, file);
      setUploadMessage({
        type: 'success',
        text: `Dataset successfully validated and saved to local hospital partition! Records: ${created.record_count}, Features: ${created.feature_count}.`,
      });
      setFile(null);
      await loadData();
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err.message || 'Dataset upload and validation failed.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const filteredDatasets = datasets.filter((d) =>
    user?.role === 'SUPER_ADMIN' ? true : d.hospital_id === (user?.hospital_id || selectedHospitalId)
  );

  return (
    <div className="space-y-6">
      <MedicalDisclaimer />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Dataset Ingestion & Validation</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Validate EHR CSV schemas and register data partitions strictly within the hospital node boundary
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* CSV Ingestion Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-900">
            <Upload className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold">Ingest Local EHR Dataset</h3>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Stored Locally On-Node
          </span>
        </div>

        {uploadMessage && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
              uploadMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {uploadMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{uploadMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {user?.role === 'SUPER_ADMIN' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Hospital Node</label>
                <select
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.hospital_name} ({h.hospital_code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={user?.role !== 'SUPER_ADMIN' ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dataset Cohort Label</label>
              <input
                type="text"
                required
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* File Upload Box */}
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-teal-400 transition-colors bg-slate-50/50">
            <input
              type="file"
              accept=".csv"
              id="csv-file-input"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer space-y-2 block">
              <FileSpreadsheet className="w-8 h-8 text-teal-600 mx-auto" />
              <div className="text-xs font-semibold text-slate-700">
                {file ? file.name : 'Click or drag to select hospital CSV dataset'}
              </div>
              <p className="text-[11px] text-slate-400">
                Supports standard comma-separated EHR records (Max 25MB). Auto-validates 10 clinical features.
              </p>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isUploading || !file}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validating & Preprocessing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Validate & Store on Node</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Datasets Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Hospital Datasets Registry</h3>
            <p className="text-xs text-slate-500">Local datasets registered across participating hospital nodes</p>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {filteredDatasets.length} Registered Datasets
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Dataset Name</th>
                <th className="py-3 px-4">Hospital</th>
                <th className="py-3 px-4">Records</th>
                <th className="py-3 px-4">Features</th>
                <th className="py-3 px-4">Validation Status</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4 text-right">Inspect Schema</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDatasets.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                    <Database className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>{d.dataset_name}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-medium">{d.hospital_name || `Hospital ${d.hospital_id}`}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{d.record_count.toLocaleString()}</td>
                  <td className="py-3 px-4">{d.feature_count} features</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="py-3 px-4 text-slate-500">{new Date(d.uploaded_at).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedDataset(d)}
                      className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                    >
                      View Specs
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dataset Schema Specs Modal */}
      {selectedDataset && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedDataset.dataset_name}</h3>
                <span className="text-xs text-slate-500">Hospital: {selectedDataset.hospital_name}</span>
              </div>
              <button
                onClick={() => setSelectedDataset(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Records</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedDataset.record_count}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Features</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedDataset.feature_count}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Privacy Status</span>
                <p className="text-xs font-bold text-emerald-600 mt-1">Local Only</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900">Validated Feature Schema</h4>
              <div className="flex flex-wrap gap-1.5">
                {(selectedDataset.schema_info?.features || [
                  'age', 'sex', 'chest_pain_type', 'resting_bp', 'cholesterol',
                  'fasting_blood_sugar', 'resting_ecg', 'max_heart_rate', 'exercise_angina', 'st_depression'
                ]).map((f) => (
                  <span key={f} className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800 leading-relaxed">
              <strong>Non-IID Characteristics:</strong> {selectedDataset.schema_info?.non_iid_bias || 'Cohort sampled with real-world demographic variances.'}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedDataset(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
