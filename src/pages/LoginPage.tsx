import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, Mail, ArrowRight, Activity, AlertCircle, UserPlus, Building, CheckCircle2 } from 'lucide-react';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';
import { UserRole } from '../types';

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Sign-in form state
  const [email, setEmail] = useState('admin@federatedhealth.ai');
  const [password, setPassword] = useState('Admin@12345');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('DOCTOR');
  const [regHospitalId, setRegHospitalId] = useState<number>(1);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await login(email, password);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (regPassword !== regPasswordConfirm) {
      setError('Passwords do not match.');
      return;
    }

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      await register({
        name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        hospital_id: regRole === 'SUPER_ADMIN' ? null : regHospitalId,
      });
      setSuccessMsg('Account registered and authenticated successfully!');
      setTimeout(() => {
        onSuccess();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (role: 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR') => {
    setActiveTab('LOGIN');
    if (role === 'SUPER_ADMIN') {
      setEmail('admin@federatedhealth.ai');
      setPassword('Admin@12345');
    } else if (role === 'HOSPITAL_ADMIN') {
      setEmail('admin@metrohospital.org');
      setPassword('Hospital@12345');
    } else if (role === 'DOCTOR') {
      setEmail('doctor@metrohospital.org');
      setPassword('Doctor@12345');
    }
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="max-w-xl mx-auto py-6 space-y-6">
      <MedicalDisclaimer compact />

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center mx-auto mb-3 shadow-sm">
            <Activity className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Hospital Portal Authentication</h2>
          <p className="text-xs text-slate-500 mt-1">
            Secure multi-hospital federated node access powered by PostgreSQL & cryptographic JWT
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Register */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('LOGIN');
              setError(null);
            }}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
              activeTab === 'LOGIN'
                ? 'border-teal-600 text-teal-700 bg-teal-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In Existing Account
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('REGISTER');
              setError(null);
            }}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'REGISTER'
                ? 'border-teal-600 text-teal-700 bg-teal-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register New Account</span>
          </button>
        </div>

        {/* Quick Demo Credentials Selection (Sign In Tab) */}
        {activeTab === 'LOGIN' && (
          <div className="mb-6 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Select Preset Role Credentials:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('SUPER_ADMIN')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                  email.includes('federatedhealth.ai')
                    ? 'bg-teal-50 border-teal-500 text-teal-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('HOSPITAL_ADMIN')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                  email.includes('admin@metrohospital.org')
                    ? 'bg-teal-50 border-teal-500 text-teal-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Hospital Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('DOCTOR')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                  email.includes('doctor@metrohospital.org')
                    ? 'bg-teal-50 border-teal-500 text-teal-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Doctor / Clinician
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Sign In Form */}
        {activeTab === 'LOGIN' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  placeholder="doctor@hospital.org"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Secure Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating Node...</span>
              ) : (
                <>
                  <span>Sign In to Node</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Registration Form */
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name & Credentials
              </label>
              <input
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Dr. Jordan Mitchell, MD"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Institutional Email Address
              </label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="j.mitchell@metrohospital.org"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Platform Role
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="DOCTOR">Doctor / Clinician</option>
                  <option value="RESEARCHER">Clinical Researcher</option>
                  <option value="HOSPITAL_ADMIN">Hospital Administrator</option>
                  <option value="SUPER_ADMIN">System Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Hospital Node
                </label>
                <select
                  value={regHospitalId}
                  disabled={regRole === 'SUPER_ADMIN'}
                  onChange={(e) => setRegHospitalId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value={1}>Metropolitan General (Metro 01)</option>
                  <option value={2}>St. Jude Research (SJR 02)</option>
                  <option value={3}>Rural Health Network (RHN 03)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password (min 6 chars)
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={regPasswordConfirm}
                  onChange={(e) => setRegPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Registering Account in Database...</span>
              ) : (
                <>
                  <span>Create Account & Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Protected by PostgreSQL persistence, bcrypt hashing, and HMAC-SHA256 JWT sessions
          </p>
        </div>
      </div>
    </div>
  );
};
