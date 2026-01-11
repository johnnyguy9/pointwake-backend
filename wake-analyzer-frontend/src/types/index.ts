/**
 * TypeScript type definitions for Wake Analyzer
 */

export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  full_name?: string;
}

export interface Dataset {
  id: string;
  session_id: string;
  filename: string;
  row_count: number;
  column_count: number;
  columns: string[];
  column_types: Record<string, string>;
  uploaded_at: string;
  expires_at: string;
}

export interface DatasetMetadata {
  columns: string[];
  column_types: Record<string, string>;
  row_count: number;
  preview: Array<Record<string, any>>;
}

export interface UploadResponse {
  success: boolean;
  session_id: string;
  metadata: DatasetMetadata;
}

export interface Filter {
  column: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
  value: any;
}

export interface ExecutionPlan {
  operation: 'mean' | 'sum' | 'count' | 'min' | 'max' | 'std' | 'correlation' | 'regression' | 'forecast';
  target_column?: string;
  filters?: Filter[];
  group_by?: string[];
  time_column?: string;
  x_axis?: string;
  y_axis?: string;
  chart_type?: 'line' | 'bar' | 'scatter' | 'heatmap' | 'box' | 'histogram';
  requires_clarification?: boolean;
  clarification_question?: string;
}

export interface ExecutionResult {
  success: boolean;
  operation?: string;
  result?: any;
  chart?: string;
  filtered_row_count?: number;
  error?: string;
  requires_clarification?: boolean;
  clarification_question?: string;
}

export interface Analysis {
  id: string;
  session_id: string;
  execution_plan: ExecutionPlan;
  result?: any;
  chart_data?: string;
  filtered_row_count?: number;
  execution_time_ms?: number;
  success: boolean;
  error_message?: string;
  executed_at: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
