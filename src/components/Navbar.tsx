import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Activity, LogOut, Hospital, UserCheck, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const { user, logout, switchDemoUser } = useAuth();
  const [healthStatus, setHealthStatus] = useState<string>('Checking...');
  const [isSwitching, setIsSwitching] = useState<boolean>(false);

  useEffect(() => {
    api.getHealth()
      .then((data: any) => setHealthStatus(data.status === 'healthy' ? 'FedAvg Coordinator Online' : 'Degraded'))
      .catch(() => setHealthStatus('Backend Offline'));
  }, []);

  const handleSwitch = async (role: 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR') => {
    setIsSwitching(true);
    try {
      await switchDemoUser(role);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-xs">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-none">
              FL-Healthcare AI
            </h1>
            <span className="text-[11px] text-slate-500 font-medium">
              Collaborative Multi-Hospital Disease Prediction
            </span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-medium text-emerald-700">{healthStatus}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Quick Demo Role Switcher for Mentor/Viva/Viva Review */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-2">Role:</span>
          <button
            onClick={() => handleSwitch('SUPER_ADMIN')}
            disabled={isSwitching}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              user?.role === 'SUPER_ADMIN'
                ? 'bg-white text-teal-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Super Admin
          </button>
          <button
            onClick={() => handleSwitch('HOSPITAL_ADMIN')}
            disabled={isSwitching}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              user?.role === 'HOSPITAL_ADMIN'
                ? 'bg-white text-teal-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hospital Admin
          </button>
          <button
            onClick={() => handleSwitch('DOCTOR')}
            disabled={isSwitching}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              user?.role === 'DOCTOR'
                ? 'bg-white text-teal-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Doctor
          </button>
        </div>

        {/* User Card */}
        {user ? (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-900 leading-tight">{user.name}</p>
              <p className="text-[11px] text-teal-600 font-medium">
                {user.role} {user.hospital_name ? `• ${user.hospital_name}` : ''}
              </p>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};
