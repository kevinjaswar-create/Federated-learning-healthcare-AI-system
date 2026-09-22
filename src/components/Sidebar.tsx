import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Database,
  Cpu,
  Share2,
  Layers,
  Scale,
  Stethoscope,
  History,
  ShieldAlert,
  Settings,
  Info,
  Server
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type PageId =
  | 'admin-dashboard'
  | 'hospital-dashboard'
  | 'federated-training'
  | 'local-training'
  | 'global-model'
  | 'model-comparison'
  | 'hospital-management'
  | 'dataset-management'
  | 'disease-prediction'
  | 'prediction-history'
  | 'audit-logs'
  | 'system-settings'
  | 'landing';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onSelectPage }) => {
  const { user } = useAuth();

  const navItem = (id: PageId, label: string, Icon: any, allowedRoles?: string[]) => {
    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      return null;
    }
    const isActive = currentPage === id;
    return (
      <button
        onClick={() => onSelectPage(id)}
        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
          isActive
            ? 'bg-teal-600 text-white shadow-xs font-semibold'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-[calc(100vh-4rem)] flex flex-col justify-between p-4 overflow-y-auto shrink-0 shadow-xs">
      <div className="space-y-6">
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3">
            Overview
          </span>
          <div className="mt-2 space-y-1">
            {navItem('admin-dashboard', 'Admin Dashboard', LayoutDashboard, ['SUPER_ADMIN'])}
            {navItem('hospital-dashboard', 'Hospital Dashboard', Building2)}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3">
            Federated Learning
          </span>
          <div className="mt-2 space-y-1">
            {navItem('federated-training', 'Federated Training', Share2)}
            {navItem('local-training', 'Local Model Training', Cpu)}
            {navItem('global-model', 'Global Models (FedAvg)', Layers)}
            {navItem('model-comparison', 'Model Benchmark & Privacy', Scale)}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3">
            Data & Infrastructure
          </span>
          <div className="mt-2 space-y-1">
            {navItem('hospital-management', 'Hospital Nodes', Server, ['SUPER_ADMIN'])}
            {navItem('dataset-management', 'Dataset Management', Database)}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3">
            Clinical Inference
          </span>
          <div className="mt-2 space-y-1">
            {navItem('disease-prediction', 'Disease Risk Prediction', Stethoscope)}
            {navItem('prediction-history', 'Prediction History', History)}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3">
            Governance & Specs
          </span>
          <div className="mt-2 space-y-1">
            {navItem('audit-logs', 'Security Audit Trail', ShieldAlert, ['SUPER_ADMIN', 'HOSPITAL_ADMIN'])}
            {navItem('system-settings', 'Architecture & Settings', Settings)}
            {navItem('landing', 'Platform Overview', Info)}
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-semibold">Federated Node 1.0</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
            Raw patient records strictly isolated in local nodes.
          </p>
        </div>
      </div>
    </aside>
  );
};
