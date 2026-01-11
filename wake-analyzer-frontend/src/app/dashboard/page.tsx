'use client';

/**
 * Dashboard Page
 * Main landing page after login - shows datasets and uploader
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import CSVUploader from '@/components/CSVUploader';
import DatasetCard from '@/components/DatasetCard';
import { getDatasets } from '@/lib/api';
import type { Dataset, UploadResponse } from '@/types';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      const data = await getDatasets();
      setDatasets(data);
    } catch (error) {
      console.error('Failed to load datasets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (response: UploadResponse) => {
    setShowUploader(false);
    // Redirect to analyze page
    router.push(`/analyze/${response.session_id}`);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Wake Analyzer</h1>
                <p className="text-sm text-muted-foreground">Conversational Data Analysis Platform</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium">{user?.full_name || user?.username}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Upload Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Your Datasets</h2>
              <button
                onClick={() => setShowUploader(!showUploader)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
              >
                {showUploader ? 'Cancel' : 'Upload CSV'}
              </button>
            </div>

            {showUploader && (
              <div className="mb-8">
                <CSVUploader onUploadSuccess={handleUploadSuccess} />
              </div>
            )}
          </div>

          {/* Datasets Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">Loading datasets...</p>
            </div>
          ) : datasets.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-lg">
              <svg
                className="mx-auto h-16 w-16 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium">No datasets yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload your first CSV file to get started
              </p>
              <button
                onClick={() => setShowUploader(true)}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
              >
                Upload CSV
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {datasets.map((dataset) => (
                <DatasetCard key={dataset.id} dataset={dataset} />
              ))}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
