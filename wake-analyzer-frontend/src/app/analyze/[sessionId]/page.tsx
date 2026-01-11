'use client';

/**
 * Analysis Page
 * Core page for executing analytics on a dataset
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import DataHealthView from '@/components/DataHealthView';
import QueryInterface from '@/components/QueryInterface';
import ResultsPanel from '@/components/ResultsPanel';
import ChartDisplay from '@/components/ChartDisplay';
import ExecutionProof from '@/components/ExecutionProof';
import { getDataset, executePlan, getAnalysisHistory } from '@/lib/api';
import type { Dataset, ExecutionPlan, ExecutionResult, Analysis } from '@/types';

export default function AnalyzePage() {
  const params = useParams();
  const router = useRouter();
  const { logout } = useAuth();
  const sessionId = params.sessionId as string;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [currentResult, setCurrentResult] = useState<ExecutionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    loadData();
  }, [sessionId]);

  const loadData = async () => {
    try {
      const [datasetData, analysisHistory] = await Promise.all([
        getDataset(sessionId),
        getAnalysisHistory(sessionId),
      ]);

      setDataset(datasetData);
      setAnalyses(analysisHistory);

      // Show most recent result if available
      if (analysisHistory.length > 0) {
        const latest = analysisHistory[0];
        setCurrentResult({
          success: latest.success,
          operation: latest.execution_plan.operation,
          result: latest.result,
          chart: latest.chart_data || undefined,
          filtered_row_count: latest.filtered_row_count || undefined,
          error: latest.error_message || undefined,
        });
      }
    } catch (error) {
      console.error('Failed to load dataset:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (plan: ExecutionPlan) => {
    setExecuting(true);

    try {
      const result = await executePlan(sessionId, plan);
      setCurrentResult(result);

      // Reload analyses to show in execution proof
      const updatedAnalyses = await getAnalysisHistory(sessionId);
      setAnalyses(updatedAnalyses);
    } catch (error: any) {
      setCurrentResult({
        success: false,
        error: error.response?.data?.detail || error.message || 'Execution failed',
      });
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Loading dataset...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!dataset) {
    return null;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-xl font-bold">{dataset.filename}</h1>
                  <p className="text-sm text-muted-foreground">
                    {dataset.row_count.toLocaleString()} rows × {dataset.column_count} columns
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Query & Data Health */}
            <div className="space-y-6">
              <DataHealthView dataset={dataset} />
              <ExecutionProof analyses={analyses} />
            </div>

            {/* Middle Column - Query Interface */}
            <div>
              <QueryInterface onExecute={handleExecute} loading={executing} />
            </div>

            {/* Right Column - Results */}
            <div className="space-y-6">
              <ResultsPanel result={currentResult} />
              {currentResult?.chart && <ChartDisplay chartData={currentResult.chart} />}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
