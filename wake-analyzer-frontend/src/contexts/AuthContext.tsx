'use client';

/**
 * Authentication Context
 * Manages user authentication state across the application
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User, LoginCredentials, RegisterData, AuthTokens } from '@/types';
import * as api from '@/lib/api';
import * as auth from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = async () => {
      const storedUser = auth.getUser();
      const token = auth.getToken();

      if (storedUser && token) {
        try {
          // Verify token is still valid by fetching current user
          const currentUser = await api.getCurrentUser();
          setUser(currentUser);
          auth.saveAuth({ access_token: token, token_type: 'bearer' }, currentUser);
        } catch (error) {
          // Token invalid, clear auth
          auth.clearAuth();
          setUser(null);
        }
      }

      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const tokens = await api.login(credentials);
    const currentUser = await api.getCurrentUser();

    auth.saveAuth(tokens, currentUser);
    setUser(currentUser);

    router.push('/dashboard');
  };

  const register = async (data: RegisterData) => {
    const newUser = await api.register(data);

    // Auto-login after registration
    const tokens = await api.login({
      username: data.username,
      password: data.password,
    });

    auth.saveAuth(tokens, newUser);
    setUser(newUser);

    router.push('/dashboard');
  };

  const logout = () => {
    auth.clearAuth();
    setUser(null);
    router.push('/login');
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
