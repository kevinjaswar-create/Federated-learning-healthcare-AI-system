import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar, PageId } from './components/Sidebar';
import { UnauthorizedBanner } from './components/UnauthorizedBanner';
import { UserRole } from './types';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { HospitalDashboard } from './pages/HospitalDashboard';
import { FederatedTraining } from './pages/FederatedTraining';
import { LocalTraining } from './pages/LocalTraining';
import { GlobalModel } from './pages/GlobalModel';
import { ModelComparison } from './pages/ModelComparison';
import { HospitalManagement } from './pages/HospitalManagement';
import { DatasetManagement } from './pages/DatasetManagement';
import { DiseasePrediction } from './pages/DiseasePrediction';
import { PredictionHistory } from './pages/PredictionHistory';
import { AuditLogs } from './pages/AuditLogs';
import { SystemSettings } from './pages/SystemSettings';

// Role-Based Access Control matrix for frontend routing
const PAGE_PERMISSIONS: Record<PageId, UserRole[]> = {
  'admin-dashboard': ['SUPER_ADMIN'],
  'hospital-dashboard': ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RESEARCHER'],
  'federated-training': ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RESEARCHER'],
  'local-training': ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RESEARCHER'],
  'global-model': ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RESEARCHER'],
  'model-comparison': ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RESEARCHER'],
  'hospital-management': ['SUPER_ADMIN'],
  'dataset-management': ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RESEARCHER'],
  'disease-prediction': ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RESEARCHER'],
  'prediction-history': ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RESEARCHER'],
  'audit-logs': ['SUPER_ADMIN', 'HOSPITAL_ADMIN'],
  'system-settings': ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RESEARCHER'],
  'landing': ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RESEARCHER'],
};

function getDefaultPageForRole(role?: UserRole): PageId {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'admin-dashboard';
    case 'HOSPITAL_ADMIN':
      return 'hospital-dashboard';
    case 'DOCTOR':
    case 'RESEARCHER':
      return 'disease-prediction';
    default:
      return 'hospital-dashboard';
  }
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageId>('admin-dashboard');
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Sync default starting view when user role changes
  useEffect(() => {
    if (user) {
      const allowedRoles = PAGE_PERMISSIONS[currentPage];
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        setCurrentPage(getDefaultPageForRole(user.role));
      }
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-semibold text-slate-600">
            Validating Cryptographic Session with Database...
          </p>
        </div>
      </div>
    );
  }

  // If user is not logged in, show Landing Page or Login Page
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        <Navbar />
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {showLoginModal ? (
            <div>
              <button
                onClick={() => setShowLoginModal(false)}
                className="mb-4 text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                &larr; Back to Platform Overview
              </button>
              <LoginPage onSuccess={() => setShowLoginModal(false)} />
            </div>
          ) : (
            <LandingPage
              onNavigateToLogin={() => setShowLoginModal(true)}
              onExploreDemo={() => setShowLoginModal(true)}
            />
          )}
        </main>
      </div>
    );
  }

  // Check RBAC permissions for the requested route
  const requiredRoles = PAGE_PERMISSIONS[currentPage];
  const isAuthorized = !requiredRoles || requiredRoles.includes(user.role);

  // Render current view
  const renderPage = () => {
    if (!isAuthorized) {
      return (
        <UnauthorizedBanner
          requiredRoles={requiredRoles}
          currentRole={user.role}
          viewName={currentPage.replace('-', ' ').toUpperCase()}
          onNavigateHome={() => setCurrentPage(getDefaultPageForRole(user.role))}
        />
      );
    }

    switch (currentPage) {
      case 'admin-dashboard':
        return <AdminDashboard onNavigate={(p: any) => setCurrentPage(p)} />;
      case 'hospital-dashboard':
        return <HospitalDashboard onNavigate={(p: any) => setCurrentPage(p)} />;
      case 'federated-training':
        return <FederatedTraining />;
      case 'local-training':
        return <LocalTraining />;
      case 'global-model':
        return <GlobalModel />;
      case 'model-comparison':
        return <ModelComparison />;
      case 'hospital-management':
        return <HospitalManagement />;
      case 'dataset-management':
        return <DatasetManagement />;
      case 'disease-prediction':
        return <DiseasePrediction />;
      case 'prediction-history':
        return <PredictionHistory />;
      case 'audit-logs':
        return <AuditLogs />;
      case 'system-settings':
        return <SystemSettings />;
      case 'landing':
        return (
          <LandingPage
            onNavigateToLogin={() => {}}
            onExploreDemo={() => setCurrentPage(getDefaultPageForRole(user.role))}
          />
        );
      default:
        return <HospitalDashboard onNavigate={(p: any) => setCurrentPage(p)} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentPage={currentPage} onSelectPage={setCurrentPage} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
