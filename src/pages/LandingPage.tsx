import React from 'react';
import { Activity, ShieldCheck, Database, Cpu, Share2, Lock, ArrowRight, CheckCircle2, Server, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';

interface LandingPageProps {
  onNavigateToLogin: () => void;
  onExploreDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToLogin, onExploreDemo }) => {
  const { switchDemoUser } = useAuth();

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <MedicalDisclaimer />

      {/* Header Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 rounded-2xl p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Privacy-Preserving Healthcare Machine Learning</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Collaborative Federated Learning for Multi-Hospital Disease Prediction
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Train high-performance diagnostic models across independent healthcare institutions without ever transmitting, centralizing, or exposing sensitive Electronic Health Records (EHR).
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={onExploreDemo}
              className="px-5 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs flex items-center gap-2 transition-all shadow-sm"
            >
              <span>Explore Live Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onNavigateToLogin}
              className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all"
            >
              Sign In to Hospital Portal
            </button>
          </div>
        </div>

        {/* Ambient watermark icon */}
        <div className="absolute right-[-20px] bottom-[-20px] text-teal-800/20 pointer-events-none">
          <Share2 className="w-80 h-80" />
        </div>
      </div>

      {/* Quick Demo Login Cards */}
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-3">Quick Demo Authentication</h3>
        <p className="text-xs text-slate-600 mb-4">
          Click any role below to automatically authenticate with pre-configured research credentials:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => switchDemoUser('SUPER_ADMIN')}
            className="cursor-pointer bg-white p-5 rounded-xl border border-slate-200 hover:border-teal-500 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-sm mb-3">
              SA
            </div>
            <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-600">Super Administrator</h4>
            <p className="text-xs text-slate-500 mt-1">Full access: Global orchestration, all hospital nodes, round execution, and system logs.</p>
            <span className="inline-block mt-3 text-xs font-semibold text-teal-600 group-hover:translate-x-1 transition-transform">
              Launch as Super Admin &rarr;
            </span>
          </div>

          <div
            onClick={() => switchDemoUser('HOSPITAL_ADMIN')}
            className="cursor-pointer bg-white p-5 rounded-xl border border-slate-200 hover:border-teal-500 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm mb-3">
              HA
            </div>
            <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-600">Hospital Administrator</h4>
            <p className="text-xs text-slate-500 mt-1">Metropolitan General Hospital: Manage local EHR dataset, local training, and participation.</p>
            <span className="inline-block mt-3 text-xs font-semibold text-teal-600 group-hover:translate-x-1 transition-transform">
              Launch as Hospital Admin &rarr;
            </span>
          </div>

          <div
            onClick={() => switchDemoUser('DOCTOR')}
            className="cursor-pointer bg-white p-5 rounded-xl border border-slate-200 hover:border-teal-500 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm mb-3">
              DR
            </div>
            <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-600">Clinical Doctor</h4>
            <p className="text-xs text-slate-500 mt-1">Clinical staff: Perform disease risk inference using the latest collaborative FedAvg model.</p>
            <span className="inline-block mt-3 text-xs font-semibold text-teal-600 group-hover:translate-x-1 transition-transform">
              Launch as Doctor &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* 4 Pillars of the Architecture */}
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-4">Core Architectural Guarantees</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center mb-3">
              <Database className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Zero Data Sharing</h4>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Raw patient datasets remain strictly within hospital network perimeters, satisfying HIPAA, GDPR, and ethical data governance standards.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
              <Cpu className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">FedAvg Aggregation</h4>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Global server computes weighted averaging of model parameter updates proportional to each hospital's local sample cohort size: w = &Sigma; (n_k / n) * w_k.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Differential Privacy</h4>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Optional Gaussian Local Differential Privacy (LDP) with L2 gradient clipping prevents reconstruction or membership inference attacks.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
              <Server className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Non-IID Robustness</h4>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Explicitly handles heterogeneous client distributions across demographic biases (geriatric, hypertensive, hypercholesterolemic subsets).
            </p>
          </div>
        </div>
      </div>

      {/* Architecture Flow Diagram Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h4 className="text-sm font-bold text-slate-900 mb-4">Federated Learning Lifecycle Workflow</h4>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="inline-block w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs mb-2">1</span>
            <h5 className="text-xs font-bold text-slate-900">Broadcast</h5>
            <p className="text-[11px] text-slate-500 mt-1">Coordinator sends current global weights w_t to active hospital clients</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="inline-block w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold text-xs mb-2">2</span>
            <h5 className="text-xs font-bold text-slate-900">Local Training</h5>
            <p className="text-[11px] text-slate-500 mt-1">Each hospital trains for E epochs strictly on local private dataset</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="inline-block w-6 h-6 rounded-full bg-purple-100 text-purple-800 font-bold text-xs mb-2">3</span>
            <h5 className="text-xs font-bold text-slate-900">Privacy & Checksum</h5>
            <p className="text-[11px] text-slate-500 mt-1">Local DP clipping + Gaussian noise + SHA-256 integrity hash applied</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="inline-block w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold text-xs mb-2">4</span>
            <h5 className="text-xs font-bold text-slate-900">FedAvg Aggregation</h5>
            <p className="text-[11px] text-slate-500 mt-1">Server aggregates encrypted weight updates into w_(t+1)</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <span className="inline-block w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs mb-2">5</span>
            <h5 className="text-xs font-bold text-slate-900">Clinical Evaluation</h5>
            <p className="text-[11px] text-slate-500 mt-1">New model version is evaluated and deployed for real-time inference</p>
          </div>
        </div>
      </div>
    </div>
  );
};
