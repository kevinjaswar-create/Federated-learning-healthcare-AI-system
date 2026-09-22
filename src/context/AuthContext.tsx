import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthResponse, RegisterRequest, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  validateSession: () => Promise<boolean>;
  switchDemoUser: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate active token against backend database
  const validateSession = useCallback(async (): Promise<boolean> => {
    const savedToken = localStorage.getItem('fl_token');
    if (!savedToken) {
      setUser(null);
      setToken(null);
      return false;
    }

    try {
      const verifiedUser = await api.getMe();
      setUser(verifiedUser);
      setToken(savedToken);
      localStorage.setItem('fl_user', JSON.stringify(verifiedUser));
      return true;
    } catch (err) {
      console.warn('[AuthContext] Session invalid or expired:', err);
      localStorage.removeItem('fl_token');
      localStorage.removeItem('fl_user');
      setUser(null);
      setToken(null);
      return false;
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('fl_token');
      const savedUser = localStorage.getItem('fl_user');

      if (savedToken && savedUser) {
        try {
          setUser(JSON.parse(savedUser));
          setToken(savedToken);
          // Verify with PostgreSQL backend
          await validateSession();
        } catch (e) {
          localStorage.removeItem('fl_token');
          localStorage.removeItem('fl_user');
        }
      }
      setIsLoading(false);
    };

    initializeAuth();

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      localStorage.removeItem('fl_token');
      localStorage.removeItem('fl_user');
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, [validateSession]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const authData: AuthResponse = await api.login(email, password);
      const u: User = {
        id: authData.user_id,
        name: authData.name,
        email: authData.email,
        role: authData.role,
        hospital_id: authData.hospital_id,
        hospital_name: authData.hospital_name,
        status: 'ACTIVE',
      };
      setToken(authData.access_token);
      setUser(u);
      localStorage.setItem('fl_token', authData.access_token);
      localStorage.setItem('fl_user', JSON.stringify(u));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      const authData: AuthResponse = await api.register(data);
      const u: User = {
        id: authData.user_id,
        name: authData.name,
        email: authData.email,
        role: authData.role,
        hospital_id: authData.hospital_id,
        hospital_name: authData.hospital_name,
        status: 'ACTIVE',
      };
      setToken(authData.access_token);
      setUser(u);
      localStorage.setItem('fl_token', authData.access_token);
      localStorage.setItem('fl_user', JSON.stringify(u));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('fl_token');
      localStorage.removeItem('fl_user');
    }
  };

  const switchDemoUser = async (role: UserRole) => {
    let email = 'admin@federatedhealth.ai';
    let password = 'Admin@12345';

    if (role === 'HOSPITAL_ADMIN') {
      email = 'admin@metrohospital.org';
      password = 'Hospital@12345';
    } else if (role === 'DOCTOR') {
      email = 'doctor@metrohospital.org';
      password = 'Doctor@12345';
    } else if (role === 'RESEARCHER') {
      email = 'doctor@metrohospital.org';
      password = 'Doctor@12345';
    }

    await login(email, password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        validateSession,
        switchDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
