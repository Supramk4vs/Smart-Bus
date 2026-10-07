import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser, UserRole } from '../types/index.ts';
import { Api } from '../lib/api.ts';

interface AuthContextType {
  user: AppUser | null;
  role: UserRole | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string, role?: string) => Promise<void>;
  qrLogin: (qrToken: string) => Promise<void>;
  logout: () => void;
  updateCurrentUser: (updated: AppUser) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('campus_transport_user');
      const savedRole = localStorage.getItem('campus_transport_role');
      const savedToken = localStorage.getItem('campus_transport_token');

      if (savedUser && savedRole && savedToken) {
        setUser(JSON.parse(savedUser));
        setRole(savedRole as UserRole);
        setToken(savedToken);
      }
    } catch (e) {
      console.error('Error restoring session from localStorage:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (identifier: string, password: string, selectedRole?: string) => {
    setIsLoading(true);
    try {
      const res = await Api.login(identifier, password, selectedRole);
      setUser(res.user);
      setRole(res.role);
      setToken(res.token);

      localStorage.setItem('campus_transport_user', JSON.stringify(res.user));
      localStorage.setItem('campus_transport_role', res.role);
      localStorage.setItem('campus_transport_token', res.token);
    } finally {
      setIsLoading(false);
    }
  };

  const qrLogin = async (qrToken: string) => {
    setIsLoading(true);
    try {
      const res = await Api.qrLogin(qrToken);
      setUser(res.user);
      setRole(res.role);
      setToken(res.token);

      localStorage.setItem('campus_transport_user', JSON.stringify(res.user));
      localStorage.setItem('campus_transport_role', res.role);
      localStorage.setItem('campus_transport_token', res.token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    setToken(null);
    localStorage.removeItem('campus_transport_user');
    localStorage.removeItem('campus_transport_role');
    localStorage.removeItem('campus_transport_token');
  };

  const updateCurrentUser = (updated: AppUser) => {
    setUser(updated);
    localStorage.setItem('campus_transport_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isLoading,
        login,
        qrLogin,
        logout,
        updateCurrentUser,
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
