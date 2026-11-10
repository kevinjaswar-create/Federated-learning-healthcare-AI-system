import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Hospital, Dataset, ColumnSummary, TargetCandidate, TrainedModelResult } from '../types';
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
  Lock,
  Cpu,
  BarChart3,
  TrendingUp,
  Activity,
  Check,
  ArrowRight,
  ShieldCheck,
  Eye,
  Sliders,
  Play,
  Award,
  Search,
  Filter,
  FileText
} from 'lucide-react';

// Sample dataset templates for 1-click verification
const SAMPLE_CLEVELAND_CSV = `age,sex,chest_pain_type,resting_bp,cholesterol,fasting_blood_sugar,resting_ecg,max_heart_rate,exercise_angina,st_depression,target
63,1,3,145,233,1,0,150,0,2.3,1
37,1,2,130,250,0,1,187,0,3.5,1
41,0,1,130,204,0,0,172,0,1.4,1
56,1,1,120,236,0,1,178,0,0.8,1
57,0,0,120,354,0,1,163,1,0.6,1
57,1,0,140,192,0,1,148,0,0.4,1
56,0,1,140,294,0,0,153,0,1.3,1
44,1,1,120,263,0,1,173,0,0.0,1
52,1,2,172,199,1,1,162,0,0.5,1
57,1,2,150,168,0,1,174,0,1.6,1
54,1,0,140,239,0,1,160,0,1.2,1
48,0,2,130,275,0,1,139,0,0.2,1
49,1,1,130,266,0,1,171,0,0.6,1
64,1,3,110,211,0,0,144,1,1.8,1
58,0,3,150,283,1,0,162,0,1.0,1
50,0,2,120,219,0,1,158,0,1.6,1
58,0,2,120,340,0,1,172,0,0.0,1
66,0,3,150,226,0,1,114,0,2.6,1
43,1,0,150,247,0,1,171,0,1.5,1
67,1,0,160,286,0,0,108,1,1.5,0
67,1,0,120,229,0,0,129,1,2.6,0
62,0,0,140,268,0,0,160,0,3.6,0
63,1,0,130,254,0,0,147,0,1.4,0
53,1,0,140,203,1,0,155,1,3.1,0
56,1,2,130,256,1,0,142,1,0.6,0
48,1,1,110,229,0,1,168,0,1.0,0
59,1,0,110,239,0,0,142,1,1.2,0
60,1,0,140,293,0,0,170,0,1.2,0
63,0,0,124,197,0,1,136,1,0.0,0
59,1,0,140,177,0,1,162,1,0.0,0`;

const SAMPLE_DIABETES_CSV = `pregnancies,glucose,blood_pressure,skin_thickness,insulin,bmi,diabetes_pedigree,age,outcome
6,148,72,35,0,33.6,0.627,50,1
1,85,66,29,0,26.6,0.351,31,0
8,183,64,0,0,23.3,0.672,32,1
1,89,66,23,94,28.1,0.167,21,0
0,137,40,35,168,43.1,2.288,33,1
5,116,74,0,0,25.6,0.201,30,0
3,78,50,32,88,31.0,0.248,26,1
10,115,0,0,0,35.3,0.134,29,0
2,197,70,45,543,30.5,0.158,53,1
8,125,96,0,0,0.0,0.232,54,1
4,110,92,0,0,37.6,0.191,30,0
10,168,74,0,0,38.0,0.537,34,1
10,139,80,0,0,27.1,1.441,57,0
1,189,60,23,846,30.1,0.398,59,1
5,166,72,19,175,25.8,0.587,51,1
7,100,0,0,0,30.0,0.484,32,1
0,118,84,47,230,45.8,0.551,31,1
7,107,74,0,0,29.6,0.254,31,1
1,103,30,38,83,43.3,0.183,33,0
1,115,70,30,96,34.6,0.529,32,1
3,126,88,41,235,39.3,0.704,27,0
8,99,84,0,0,35.4,0.388,50,0
7,196,90,0,0,39.8,0.451,41,1
9,119,80,35,0,29.0,0.263,29,1
11,143,94,33,146,36.6,0.254,51,1
10,125,70,26,115,31.1,0.205,41,1
7,147,76,0,0,39.4,0.257,43,1
1,97,66,15,140,23.2,0.487,22,0
13,145,82,19,110,22.2,0.245,57,0
5,117,92,0,0,34.1,0.337,38,0`;

export const DatasetManagement: React.FC = () => {
  const { user } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<number>(user?.hospital_id || 1);
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  // Upload Form State
  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState('Cardiovascular Cohort 2026');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active / Selected Dataset for Deep Analysis & Training
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'analysis' | 'train' | 'predict' | 'federated'>('preview');

  // Preview Filter
  const [previewFilter, setPreviewFilter] = useState('');

  // Model Training Config State
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [epochs, setEpochs] = useState<number>(25);
  const [learningRate, setLearningRate] = useState<number>(0.05);
  const [l2Reg, setL2Reg] = useState<number>(0.001);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainingMessage, setTrainingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Patient Risk Prediction State
  const [patientInputs, setPatientInputs] = useState<Record<string, any>>({});
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictionResult, setPredictionResult] = useState<any | null>(null);

  const loadData = async (selectLatestId?: number) => {
    try {
      const [hList, dList] = await Promise.all([api.getHospitals(), api.getDatasets()]);
      setHospitals(hList);
      setDatasets(dList);

      if (selectLatestId) {
        const found = dList.find((d) => d.id === selectLatestId);
        if (found) {
          const detailed = await api.getDataset(found.id);
          setActiveDataset(detailed);
          initTrainingFields(detailed);
        }
      } else if (!activeDataset && dList.length > 0) {
        const preferred =
          dList.find((d) => (user?.role === 'SUPER_ADMIN' ? true : d.hospital_id === (user?.hospital_id || 1))) ||
          dList[0];
        if (preferred) {
          const detailed = await api.getDataset(preferred.id);
          setActiveDataset(detailed);
          initTrainingFields(detailed);
        }
      }
    } catch (err) {
      console.error('[DatasetManagement] Error loading data:', err);
    }
  };

  const initTrainingFields = (ds: Dataset) => {
    const recommendedTarget =
      ds.target_candidates?.[0]?.column || ds.schema_info?.target || (ds.columns && ds.columns[ds.columns.length - 1]) || 'target';
    setTargetColumn(recommendedTarget);

    const initialFeatures = (ds.columns || []).filter(
      (c) => c !== recommendedTarget && !['id', 'patient_id', 'uuid', '_row_index'].includes(c.toLowerCase())
    );
    setSelectedFeatures(initialFeatures);

    // Initialize prediction inputs with medians
    const initialInputs: Record<string, any> = {};
    for (const f of initialFeatures) {
      const summary = ds.summaries?.[f];
      initialInputs[f] = summary?.median ?? (summary?.mean !== undefined ? Math.round(summary.mean) : 1);
    }
    setPatientInputs(initialInputs);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectDataset = async (d: Dataset) => {
    try {
      const detailed = await api.getDataset(d.id);
      setActiveDataset(detailed);
      initTrainingFields(detailed);
      setTrainingMessage(null);
      setPredictionResult(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setUploadMessage(null);
      if (!datasetName || datasetName.trim() === 'Cardiovascular Cohort 2026') {
        setDatasetName(selected.name.replace(/\.csv$/i, ''));
      }
    }
  };

  const loadSampleTemplate = (type: 'cardiovascular' | 'diabetes') => {
    const csvContent = type === 'cardiovascular' ? SAMPLE_CLEVELAND_CSV : SAMPLE_DIABETES_CSV;
    const fileName = type === 'cardiovascular' ? 'cleveland_cardiovascular_cohort.csv' : 'pima_diabetes_diagnostic.csv';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const sampleFile = new File([blob], fileName, { type: 'text/csv' });
    setFile(sampleFile);
    setDatasetName(type === 'cardiovascular' ? 'Cardiovascular Cohort (Cleveland Clinic)' : 'Diabetes Diagnostic Cohort');
    setUploadMessage({
      type: 'success',
      text: `Loaded ${type === 'cardiovascular' ? 'Cardiovascular' : 'Diabetes'} sample template. Click "Upload & Profile Dataset" to process.`,
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadMessage({ type: 'error', text: 'Please select or load a CSV dataset file first.' });
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);
    try {
      const created = await api.uploadDataset(selectedHospitalId, datasetName, file);
      setUploadMessage({
        type: 'success',
        text: `Dataset successfully uploaded, profiled, and verified! Stored on Hospital ${selectedHospitalId} node partition. (${created.record_count} rows, ${created.feature_count} features)`,
      });
      setFile(null);
      await loadData(created.id);
      setActiveTab('preview');
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err.message || 'Dataset upload failed. Please ensure the file is a valid comma-separated (.csv) file.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTrainModel = async () => {
    if (!activeDataset) return;
    if (!targetColumn) {
      setTrainingMessage({ type: 'error', text: 'Please select a valid target column for classification.' });
      return;
    }
    if (selectedFeatures.length === 0) {
      setTrainingMessage({ type: 'error', text: 'Please select at least one feature column.' });
      return;
    }

    setIsTraining(true);
    setTrainingMessage(null);
    try {
      const res = await api.trainDatasetModel(activeDataset.id, {
        target_column: targetColumn,
        feature_columns: selectedFeatures,
        epochs,
        learning_rate: learningRate,
        l2_reg: l2Reg,
        train_split: 0.8,
      });

      // Refresh active dataset to capture trained model
      const updated = await api.getDataset(activeDataset.id);
      setActiveDataset(updated);
      setTrainingMessage({
        type: 'success',
        text: `Logistic Regression model successfully trained! Accuracy: ${(res.trained_model.metrics.accuracy * 100).toFixed(1)}%, ROC-AUC: ${(res.trained_model.metrics.roc_auc * 100).toFixed(1)}%, F1: ${(res.trained_model.metrics.f1_score * 100).toFixed(1)}%. Model parameters synced to hospital node.`,
      });
    } catch (err: any) {
      setTrainingMessage({
        type: 'error',
        text: err.message || 'Training failed.',
      });
    } finally {
      setIsTraining(false);
    }
  };

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDataset) return;

    setIsPredicting(true);
    try {
      const result = await api.predictDatasetSample(activeDataset.id, patientInputs);
      setPredictionResult(result);
    } catch (err: any) {
      alert(`Prediction failed: ${err.message}`);
    } finally {
      setIsPredicting(false);
    }
  };

  const toggleFeature = (col: string) => {
    if (selectedFeatures.includes(col)) {
      setSelectedFeatures(selectedFeatures.filter((f) => f !== col));
    } else {
      setSelectedFeatures([...selectedFeatures, col]);
    }
  };

  const selectAllFeatures = () => {
    if (!activeDataset) return;
    const all = (activeDataset.columns || []).filter(
      (c) => c !== targetColumn && !['id', 'patient_id', 'uuid', '_row_index'].includes(c.toLowerCase())
    );
    setSelectedFeatures(all);
  };

  const deselectAllFeatures = () => {
    setSelectedFeatures([]);
  };

  const filteredDatasets = datasets.filter((d) =>
    user?.role === 'SUPER_ADMIN' ? true : d.hospital_id === (user?.hospital_id || selectedHospitalId)
  );

  // Filter preview rows
  const visiblePreviewRows = (activeDataset?.preview_rows || []).filter((r) => {
    if (!previewFilter) return true;
    const query = previewFilter.toLowerCase();
    return Object.values(r).some((v) => String(v).toLowerCase().includes(query));
  });

  return (
    <div className="space-y-6">
      <MedicalDisclaimer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-teal-600" />
            Dataset Management & ML Pipeline
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ingest, profile, preprocess clinical CSV cohorts, train local Logistic Regression models, and feed parameters into Federated Averaging
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(activeDataset?.id)}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Upload CSV Ingestion Panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-900">
            <Upload className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold">Upload Local EHR Dataset (.CSV)</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              On-Prem Node Isolation
            </span>
          </div>
        </div>

        {uploadMessage && (
          <div
            className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
              uploadMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {uploadMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span className="font-semibold">{uploadMessage.type === 'success' ? 'Success: ' : 'Error: '}</span>
              {uploadMessage.text}
            </div>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {user?.role === 'SUPER_ADMIN' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Hospital Partition</label>
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
                placeholder="e.g. Cardiovascular Cohort 2026"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* File Upload Drag & Drop Area */}
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-teal-400 transition-colors bg-slate-50/50">
            <input
              type="file"
              accept=".csv,text/csv"
              id="csv-file-input"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer space-y-2 block">
              <FileSpreadsheet className="w-9 h-9 text-teal-600 mx-auto" />
              <div className="text-xs font-semibold text-slate-800">
                {file ? (
                  <span className="text-teal-700 font-bold">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                ) : (
                  'Click or drag your hospital CSV dataset here'
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Supports RFC-4180 CSVs, UTF-8 BOM, carriage returns, missing value detection, and automated feature profiling.
              </p>
            </label>
          </div>

          {/* 1-Click Verification Templates & Submit Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500">Test with verified sample:</span>
              <button
                type="button"
                onClick={() => loadSampleTemplate('cardiovascular')}
                className="text-[11px] font-medium text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded transition-colors"
              >
                Heart Disease (11 cols)
              </button>
              <button
                type="button"
                onClick={() => loadSampleTemplate('diabetes')}
                className="text-[11px] font-medium text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded transition-colors"
              >
                Diabetes (9 cols)
              </button>
            </div>

            <button
              type="submit"
              disabled={isUploading || !file}
              className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Profiling & Validating Dataset...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload & Profile Dataset</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Active Dataset Inspection Hub */}
      {activeDataset && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
          {/* Active Dataset Banner */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{activeDataset.dataset_name}</h3>
                <StatusBadge status={activeDataset.status} />
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                <span>Hospital: <strong className="text-slate-700">{activeDataset.hospital_name || `Hospital ${activeDataset.hospital_id}`}</strong></span>
                <span>•</span>
                <span>File: <strong className="text-slate-700">{activeDataset.file_name || 'dataset.csv'}</strong></span>
                {activeDataset.file_size && (
                  <>
                    <span>•</span>
                    <span>Size: <strong className="text-slate-700">{(activeDataset.file_size / 1024).toFixed(1)} KB</strong></span>
                  </>
                )}
                <span>•</span>
                <span>Uploaded: <strong className="text-slate-700">{new Date(activeDataset.uploaded_at).toLocaleString()}</strong></span>
              </div>
            </div>

            {/* Overall Quality Health Score */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400">Data Quality Score</span>
                <p className="text-lg font-bold text-teal-700">
                  {activeDataset.data_quality?.health_score ?? 100}%
                </p>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Records</span>
                <p className="text-lg font-bold text-slate-900">
                  {activeDataset.record_count.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-slate-200 bg-white px-5 flex items-center gap-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('preview')}
              className={`py-3.5 text-xs font-bold border-b-2 whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                activeTab === 'preview'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Dataset Preview ({activeDataset.record_count} rows)</span>
            </button>
            <button
              onClick={() => setActiveTab('analysis')}
              className={`py-3.5 text-xs font-bold border-b-2 whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                activeTab === 'analysis'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Statistical Analysis & Profiling</span>
            </button>
            <button
              onClick={() => setActiveTab('train')}
              className={`py-3.5 text-xs font-bold border-b-2 whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                activeTab === 'train'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Train Logistic Regression</span>
              {activeDataset.trained_model && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('predict')}
              className={`py-3.5 text-xs font-bold border-b-2 whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                activeTab === 'predict'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Patient Risk Inference</span>
            </button>
            <button
              onClick={() => setActiveTab('federated')}
              className={`py-3.5 text-xs font-bold border-b-2 whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                activeTab === 'federated'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Federated Architecture Status</span>
            </button>
          </div>

          {/* TAB 1: DATASET PREVIEW */}
          {activeTab === 'preview' && (
            <div className="p-6 space-y-5">
              {/* Quality & Metadata Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Rows</span>
                  <p className="text-base font-bold text-slate-900 mt-0.5">{activeDataset.record_count}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Features</span>
                  <p className="text-base font-bold text-slate-900 mt-0.5">{activeDataset.columns?.length || activeDataset.feature_count}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Missing Values</span>
                  <p className="text-base font-bold text-amber-600 mt-0.5">
                    {activeDataset.missing_values_count ?? activeDataset.schema_info?.missing_values ?? 0}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Duplicate Rows</span>
                  <p className="text-base font-bold text-slate-700 mt-0.5">{activeDataset.duplicate_count ?? 0}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Readiness</span>
                  <p className="text-xs font-bold text-emerald-700 mt-1">
                    {activeDataset.data_quality?.readiness_status || 'READY'}
                  </p>
                </div>
              </div>

              {/* Preview Search Filter */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <span>Previewing first {activeDataset.preview_rows?.length || 0} rows of <strong>{activeDataset.file_name || 'actual uploaded CSV'}</strong></span>
                </div>
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search in preview..."
                    value={previewFilter}
                    onChange={(e) => setPreviewFilter(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Actual Uploaded Records Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[10px] tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 bg-slate-100 text-slate-500 w-12 text-center">#</th>
                        {(activeDataset.columns || []).map((col) => {
                          const isNum = activeDataset.column_types?.[col] === 'numeric';
                          const isTarget = col === activeDataset.schema_info?.target || col === activeDataset.target_candidates?.[0]?.column;
                          return (
                            <th key={col} className={`py-2.5 px-3 whitespace-nowrap ${isTarget ? 'bg-teal-50 text-teal-900 font-bold' : ''}`}>
                              <div className="flex items-center gap-1.5">
                                <span>{col}</span>
                                <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${isNum ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {isNum ? 'NUM' : 'CAT'}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {visiblePreviewRows.length > 0 ? (
                        visiblePreviewRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 text-slate-400 text-center text-[11px] bg-slate-50/40 font-sans">
                              {row._row_index || idx + 1}
                            </td>
                            {(activeDataset.columns || []).map((col) => {
                              const val = row[col];
                              const isMissing = val === '' || val === null || val === undefined;
                              return (
                                <td key={col} className="py-2 px-3 whitespace-nowrap">
                                  {isMissing ? (
                                    <span className="text-amber-500 font-sans italic text-[10px]">null</span>
                                  ) : (
                                    String(val)
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={(activeDataset.columns?.length || 1) + 1} className="py-6 text-center text-slate-400 font-sans">
                            No records match filter query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DATASET PROFILING & STATISTICAL ANALYSIS */}
          {activeTab === 'analysis' && (
            <div className="p-6 space-y-6">
              {/* Quality Report Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    Data Quality & Completeness Audit
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Completeness Ratio</span>
                      <strong className="text-slate-900">{activeDataset.data_quality?.completeness_percentage ?? 100}%</strong>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-teal-600 h-full rounded-full"
                        style={{ width: `${activeDataset.data_quality?.completeness_percentage ?? 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">Cleanliness Ratio (Non-duplicates)</span>
                      <strong className="text-slate-900">{activeDataset.data_quality?.cleanliness_percentage ?? 100}%</strong>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full"
                        style={{ width: `${activeDataset.data_quality?.cleanliness_percentage ?? 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-teal-600" />
                    Automated Preprocessing Recommendations
                  </h4>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                    {(activeDataset.data_quality?.recommendations || [
                      'StandardScaler normalization will be applied to continuous variables',
                      'Missing values automatically imputed via median prior to gradient descent',
                      'Target column verified for binary logistic classification'
                    ]).map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Target Variable Class Distribution */}
              {activeDataset.target_candidates && activeDataset.target_candidates.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-teal-600" />
                    Target Variable Distribution: <strong className="text-teal-700">{activeDataset.target_candidates[0].column}</strong>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(activeDataset.target_candidates[0].class_counts).map(([cls, cnt]) => {
                      const total = activeDataset.record_count || 1;
                      const pct = ((cnt / total) * 100).toFixed(1);
                      return (
                        <div key={cls} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Class: {cls}</span>
                          <p className="text-base font-bold text-slate-900 mt-0.5">{cnt} patients</p>
                          <span className="text-xs text-teal-600 font-semibold">{pct}% of cohort</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Numerical Statistical Summary Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">Numerical Features: Descriptive Statistics Summary</h4>
                  <span className="text-[11px] text-slate-500 font-mono">Mean, Std, Quartiles</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600 font-mono">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4 font-sans">Feature Name</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Count</th>
                        <th className="py-2.5 px-3">Missing</th>
                        <th className="py-2.5 px-3">Mean</th>
                        <th className="py-2.5 px-3">Std</th>
                        <th className="py-2.5 px-3">Min</th>
                        <th className="py-2.5 px-3">25%</th>
                        <th className="py-2.5 px-3">Median</th>
                        <th className="py-2.5 px-3">75%</th>
                        <th className="py-2.5 px-3">Max</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.values(activeDataset.summaries || {})
                        .filter((s) => s.dtype === 'numeric')
                        .map((s) => (
                          <tr key={s.name} className="hover:bg-slate-50/50">
                            <td className="py-2 px-4 font-sans font-semibold text-slate-800">{s.name}</td>
                            <td className="py-2 px-3 text-[10px] text-blue-700 font-bold">NUM</td>
                            <td className="py-2 px-3">{s.count}</td>
                            <td className="py-2 px-3 text-amber-600">{s.missing_count}</td>
                            <td className="py-2 px-3">{s.mean ?? '-'}</td>
                            <td className="py-2 px-3">{s.std ?? '-'}</td>
                            <td className="py-2 px-3">{s.min ?? '-'}</td>
                            <td className="py-2 px-3">{s.p25 ?? '-'}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{s.median ?? '-'}</td>
                            <td className="py-2 px-3">{s.p75 ?? '-'}</td>
                            <td className="py-2 px-3">{s.max ?? '-'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TRAIN LOGISTIC REGRESSION MODEL */}
          {activeTab === 'train' && (
            <div className="p-6 space-y-6">
              {trainingMessage && (
                <div
                  className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                    trainingMessage.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {trainingMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">{trainingMessage.text}</div>
                </div>
              )}

              {/* Training Configuration Panel */}
              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-teal-600" />
                      Model Training Configuration: Logistic Regression
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Train SGD classifier on private hospital EHR partition with binary cross-entropy loss
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Classification Column</label>
                    <select
                      value={targetColumn}
                      onChange={(e) => {
                        setTargetColumn(e.target.value);
                        setSelectedFeatures(
                          (activeDataset.columns || []).filter(
                            (c) => c !== e.target.value && !['id', 'patient_id', 'uuid', '_row_index'].includes(c.toLowerCase())
                          )
                        );
                      }}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-teal-500 font-semibold"
                    >
                      {(activeDataset.columns || []).map((col) => (
                        <option key={col} value={col}>
                          {col} {activeDataset.target_candidates?.some((tc) => tc.column === col) ? '(Recommended Target)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Epochs</label>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={epochs}
                      onChange={(e) => setEpochs(Number(e.target.value))}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Learning Rate (η)</label>
                    <input
                      type="number"
                      step={0.01}
                      min={0.001}
                      max={0.5}
                      value={learningRate}
                      onChange={(e) => setLearningRate(Number(e.target.value))}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    />
                  </div>
                </div>

                {/* Feature Selection Checkboxes */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Selected Input Features ({selectedFeatures.length} of {(activeDataset.columns || []).filter((c) => c !== targetColumn).length})
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={selectAllFeatures}
                        className="text-teal-600 hover:text-teal-700 font-semibold"
                      >
                        Select All
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={deselectAllFeatures}
                        className="text-slate-500 hover:text-slate-700 font-semibold"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(activeDataset.columns || [])
                      .filter((c) => c !== targetColumn && !['id', 'patient_id', 'uuid', '_row_index'].includes(c.toLowerCase()))
                      .map((col) => {
                        const isSelected = selectedFeatures.includes(col);
                        return (
                          <button
                            key={col}
                            type="button"
                            onClick={() => toggleFeature(col)}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-colors flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-teal-50 border-teal-300 text-teal-800 font-bold'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-teal-600" />}
                            <span>{col}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleTrainModel}
                    disabled={isTraining || selectedFeatures.length === 0}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-2"
                  >
                    {isTraining ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Training Logistic Regression...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Train Logistic Regression Model</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Trained Model Performance Section */}
              {activeDataset.trained_model && (
                <div className="space-y-6 pt-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Award className="w-4 h-4 text-teal-600" />
                      Model Performance & Validation Results
                    </h4>
                    <span className="text-[11px] font-mono text-slate-500">
                      Evaluated on 20% test split ({activeDataset.trained_model.metrics.test_count} records)
                    </span>
                  </div>

                  {/* Metrics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Accuracy</span>
                      <p className="text-lg font-bold text-slate-900 mt-0.5">
                        {(activeDataset.trained_model.metrics.accuracy * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Precision</span>
                      <p className="text-lg font-bold text-teal-700 mt-0.5">
                        {(activeDataset.trained_model.metrics.precision * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Recall (Sensitivity)</span>
                      <p className="text-lg font-bold text-slate-900 mt-0.5">
                        {(activeDataset.trained_model.metrics.recall * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400">F1-Score</span>
                      <p className="text-lg font-bold text-teal-700 mt-0.5">
                        {(activeDataset.trained_model.metrics.f1_score * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400">ROC-AUC</span>
                      <p className="text-lg font-bold text-indigo-700 mt-0.5">
                        {(activeDataset.trained_model.metrics.roc_auc * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Confusion Matrix & Feature Weights Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Confusion Matrix Heatmap */}
                    <div className="border border-slate-200 rounded-xl p-5 space-y-3">
                      <h5 className="text-xs font-bold text-slate-900">2x2 Confusion Matrix</h5>
                      <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
                          <span className="text-[10px] text-emerald-800 uppercase font-sans font-bold block">True Negative (TN)</span>
                          <span className="text-xl font-bold text-emerald-900">
                            {activeDataset.trained_model.metrics.confusion_matrix.true_negatives}
                          </span>
                        </div>
                        <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg">
                          <span className="text-[10px] text-rose-800 uppercase font-sans font-bold block">False Positive (FP)</span>
                          <span className="text-xl font-bold text-rose-900">
                            {activeDataset.trained_model.metrics.confusion_matrix.false_positives}
                          </span>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                          <span className="text-[10px] text-amber-800 uppercase font-sans font-bold block">False Negative (FN)</span>
                          <span className="text-xl font-bold text-amber-900">
                            {activeDataset.trained_model.metrics.confusion_matrix.false_negatives}
                          </span>
                        </div>
                        <div className="bg-teal-50 border border-teal-200 p-4 rounded-lg">
                          <span className="text-[10px] text-teal-800 uppercase font-sans font-bold block">True Positive (TP)</span>
                          <span className="text-xl font-bold text-teal-900">
                            {activeDataset.trained_model.metrics.confusion_matrix.true_positives}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                        <span>Total Test Set: {activeDataset.trained_model.metrics.test_count} records</span>
                        <span>Training Set: {activeDataset.trained_model.metrics.train_count} records</span>
                      </div>
                    </div>

                    {/* Learned Logistic Feature Weights */}
                    <div className="border border-slate-200 rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-slate-900">Learned Feature Weights (w)</h5>
                        <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                          Bias: {activeDataset.trained_model.bias.toFixed(3)}
                        </span>
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                        {activeDataset.trained_model.feature_importances.map((item) => (
                          <div key={item.feature} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-50">
                            <span className="font-mono text-slate-800 font-medium">{item.feature}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold ${item.weight >= 0 ? 'text-rose-600' : 'text-teal-600'}`}>
                                {item.weight > 0 ? `+${item.weight.toFixed(3)}` : item.weight.toFixed(3)}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-semibold ${item.weight >= 0 ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-700'}`}>
                                {item.weight >= 0 ? '+Risk' : '-Risk'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actual vs Predicted Samples */}
                  {activeDataset.trained_model.metrics.sample_predictions && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <h5 className="text-xs font-bold text-slate-900">Actual vs. Predicted Validation Samples</h5>
                        <span className="text-[11px] text-slate-500">First 10 held-out test predictions</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600 font-mono">
                          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                            <tr>
                              <th className="py-2 px-3">#</th>
                              <th className="py-2 px-3">Actual Target</th>
                              <th className="py-2 px-3">Predicted Class</th>
                              <th className="py-2 px-3">Risk Probability</th>
                              <th className="py-2 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeDataset.trained_model.metrics.sample_predictions.map((p, idx) => {
                              const isMatch = p.actual === p.predicted;
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                                  <td className="py-2 px-3 font-bold text-slate-900">{p.actual}</td>
                                  <td className="py-2 px-3 font-bold text-teal-700">{p.predicted}</td>
                                  <td className="py-2 px-3">{p.probability}%</td>
                                  <td className="py-2 px-3">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-sans font-semibold ${isMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                      {isMatch ? 'Correct' : 'Misclassified'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PATIENT RISK PREDICTION CALCULATOR */}
          {activeTab === 'predict' && (
            <div className="p-6 space-y-6">
              {!activeDataset.trained_model ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                  <Activity className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">Model Not Yet Trained</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Please train the Logistic Regression model in the "Train Logistic Regression" tab before generating patient risk predictions.
                  </p>
                  <button
                    onClick={() => setActiveTab('train')}
                    className="mt-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700"
                  >
                    Go to Model Training
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-teal-600" />
                      Clinical Disease Risk Calculator
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enter patient biometric markers to compute disease event risk based on the trained model parameters
                    </p>
                  </div>

                  <form onSubmit={handlePredict} className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {activeDataset.trained_model.feature_columns.map((feat) => {
                        const summary = activeDataset.summaries?.[feat];
                        return (
                          <div key={feat} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <label className="block text-[11px] font-bold text-slate-700 truncate" title={feat}>
                              {feat}
                            </label>
                            <input
                              type="number"
                              step="any"
                              required
                              value={patientInputs[feat] ?? ''}
                              onChange={(e) =>
                                setPatientInputs({ ...patientInputs, [feat]: Number(e.target.value) })
                              }
                              className="mt-1 w-full text-xs border border-slate-300 rounded px-2 py-1.5 bg-white font-mono"
                            />
                            {summary?.median !== undefined && (
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                Normal median: {summary.median}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isPredicting}
                        className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-2"
                      >
                        {isPredicting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Computing Risk...</span>
                          </>
                        ) : (
                          <>
                            <Activity className="w-4 h-4" />
                            <span>Calculate Patient Disease Risk</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* Prediction Results Card */}
                  {predictionResult && (
                    <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h5 className="text-xs font-bold text-slate-900">Inference Assessment</h5>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                            predictionResult.risk_tier === 'HIGH_RISK'
                              ? 'bg-rose-100 text-rose-800'
                              : predictionResult.risk_tier === 'MODERATE_RISK'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {predictionResult.risk_tier.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Risk Probability</span>
                          <p
                            className={`text-2xl font-bold mt-1 ${
                              predictionResult.probability_risk >= 65
                                ? 'text-rose-600'
                                : predictionResult.probability_risk >= 35
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {predictionResult.probability_risk}%
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 sm:col-span-2 text-left">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Diagnosis Assessment</span>
                          <p className="text-sm font-bold text-slate-900 mt-1">{predictionResult.prediction_label}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Calculated with logistic sigmoid activation over standard deviation normalized patient parameters.
                          </p>
                        </div>
                      </div>

                      {/* Top Risk Contributors */}
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-bold text-slate-900">Top Contributing Factors for this Patient:</span>
                        <div className="space-y-1.5">
                          {predictionResult.top_risk_factors.map((f: any) => (
                            <div key={f.feature} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded border border-slate-200">
                              <span className="font-mono text-slate-800">{f.feature}</span>
                              <span className="text-slate-500 text-[11px]">{f.direction}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: FEDERATED LEARNING INTEGRATION */}
          {activeTab === 'federated' && (
            <div className="p-6 space-y-5">
              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 text-slate-900">
                  <ShieldCheck className="w-5 h-5 text-teal-600" />
                  <h4 className="text-sm font-bold">Federated Learning Partition Status</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  This dataset is stored within the hospital on-prem perimeter at:
                  <code className="mx-1.5 px-2 py-0.5 bg-slate-200 rounded text-slate-800 font-mono text-[11px]">
                    /data/hospital_{activeDataset.hospital_id}/dataset.csv
                  </code>
                  Under the privacy-preserving collaborative federated protocol, <strong>zero raw patient records</strong> are transmitted to the coordinator. Only sanitized parameter vectors ($w, b$) perturbed with Local Differential Privacy (LDP) are federated.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-xs">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Node ID</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">Hospital #{activeDataset.hospital_id}</p>
                  <span className="text-[11px] text-teal-600 font-medium">{activeDataset.hospital_name}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Partition Cohort Size</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{activeDataset.record_count} Records</p>
                  <span className="text-[11px] text-emerald-600 font-medium">Ready for FedAvg Rounds</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Differential Privacy</span>
                  <p className="text-lg font-bold text-indigo-700 mt-0.5">ε = 1.5, δ = 1e-5</p>
                  <span className="text-[11px] text-slate-500 font-medium">Gaussian Perturbation</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
                <th className="py-3 px-4">Quality Score</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDatasets.map((d) => {
                const isActive = activeDataset?.id === d.id;
                return (
                  <tr key={d.id} className={`hover:bg-slate-50/50 transition-colors ${isActive ? 'bg-teal-50/40 font-semibold' : ''}`}>
                    <td className="py-3 px-4 text-slate-900 flex items-center gap-2">
                      <Database className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>{d.dataset_name}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{d.hospital_name || `Hospital ${d.hospital_id}`}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{d.record_count.toLocaleString()}</td>
                    <td className="py-3 px-4">{d.columns?.length || d.feature_count} features</td>
                    <td className="py-3 px-4">
                      <span className="text-teal-700 font-bold">{d.data_quality?.health_score ?? 100}%</span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-500">{new Date(d.uploaded_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleSelectDataset(d)}
                        className={`text-xs px-2.5 py-1 rounded font-semibold transition-colors ${
                          isActive
                            ? 'bg-teal-600 text-white'
                            : 'text-teal-600 hover:text-teal-700 hover:bg-teal-50'
                        }`}
                      >
                        {isActive ? 'Active Dataset' : 'Inspect & Train'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
