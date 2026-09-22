import React from 'react';
import { ShieldAlert, ArrowLeft, RefreshCw, LogOut } from 'lucide-react';
import { UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

interface UnauthorizedBannerProps {
  requiredRoles: UserRole[];
  currentRole?: UserRole;
  viewName: string;
  onNavigateHome: () => void;
}

export const UnauthorizedBanner: React.FC<UnauthorizedBannerProps> = ({
  requiredRoles,
  currentRole,
  viewName,
  onNavigateHome,
}) => {
  const { logout, switchDemoUser } = useAuth();

  return (
    <div className="max-w-2xl mx-auto my-12 bg-white rounded-2xl border border-rose-200 p-8 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full bg-rose-100 text-rose-800 mb-1">
              403 Forbidden • Access Denied
            </span>
            <h3 className="text-lg font-bold text-slate-900">
              Role-Based Access Control Restriction
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              You do not possess the clinical or administrative permissions required to inspect or execute actions within the <strong>{viewName}</strong> portal.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Your Active Session Role:</span>
              <span className="font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                {currentRole || 'Unauthenticated'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Authorized Roles for This View:</span>
              <div className="flex gap-1.5 flex-wrap justify-end">
                {requiredRoles.map((role) => (
                  <span
                    key={role}
                    className="font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={onNavigateHome}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Permitted View</span>
            </button>

            {requiredRoles.includes('SUPER_ADMIN') && (
              <button
                onClick={() => switchDemoUser('SUPER_ADMIN')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Switch to Super Admin</span>
              </button>
            )}

            <button
              onClick={logout}
              className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ml-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
