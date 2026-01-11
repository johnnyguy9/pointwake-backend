/**
 * API Client for Wake Analyzer Backend
 * All backend communication happens through this module
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User,
  AuthTokens,
  LoginCredentials,
  RegisterData,
  Dataset,
  UploadResponse,
  ExecutionPlan,
  ExecutionResult,
  Analysis,
  ValidationResult,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ========== AUTHENTICATION ==========

export async function register(data: RegisterData): Promise<User> {
  const response = await api.post<User>('/api/auth/register', data);
  return response.data;
}

export async function login(credentials: LoginCredentials): Promise<AuthTokens> {
  const response = await api.post<AuthTokens>('/api/auth/login', credentials);
  return response.data;
}

export async function getCurrentUser(): Promise<User> {
  const response = await api.get<User>('/api/auth/me');
  return response.data;
}

// ========== ANALYTICS ==========

export async function uploadCSV(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<UploadResponse>('/api/analytics/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export async function validatePlan(plan: ExecutionPlan): Promise<ValidationResult> {
  const response = await api.post<ValidationResult>('/api/analytics/validate', plan);
  return response.data;
}

export async function executePlan(sessionId: string, plan: ExecutionPlan): Promise<ExecutionResult> {
  const response = await api.post<ExecutionResult>('/api/analytics/execute', {
    session_id: sessionId,
    plan,
  });
  return response.data;
}

export async function getDatasets(): Promise<Dataset[]> {
  const response = await api.get<Dataset[]>('/api/analytics/datasets');
  return response.data;
}

export async function getDataset(sessionId: string): Promise<Dataset> {
  const response = await api.get<Dataset>(`/api/analytics/datasets/${sessionId}`);
  return response.data;
}

export async function getAnalysisHistory(sessionId: string): Promise<Analysis[]> {
  const response = await api.get<Analysis[]>(`/api/analytics/history/${sessionId}`);
  return response.data;
}

export async function deleteDataset(sessionId: string): Promise<void> {
  await api.delete(`/api/analytics/datasets/${sessionId}`);
}

// ========== HEALTH CHECK ==========

export async function healthCheck(): Promise<{ status: string; service: string; version: string }> {
  const response = await api.get('/health');
  return response.data;
}

export default api;
