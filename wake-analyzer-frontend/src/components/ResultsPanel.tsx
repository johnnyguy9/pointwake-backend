'use client';

/**
 * Results Panel Component
 * Displays execution results
 */

import type { ExecutionResult } from '@/types';
import { formatNumber } from '@/lib/utils';

interface ResultsPanelProps {
  result: ExecutionResult | null;
}

export default function ResultsPanel({ result }: ResultsPanelProps) {
  if (!result) {
    return (
      <div className="border border-border rounded-lg p-8 text-center bg-card">
        <p className="text-muted-foreground">Execute a plan to see results here</p>
      </div>
    );
  }

  if (!result.success) {
    return (
      <div className="border border-destructive rounded-lg p-6 bg-destructive/5">
        <h3 className="font-semibold text-destructive mb-2">Execution Failed</h3>
        <p className="text-sm text-destructive/80">{result.error}</p>
      </div>
    );
  }

  const renderResult = (data: any) => {
    if (typeof data === 'number') {
      return <span className="text-2xl font-bold text-primary">{formatNumber(data)}</span>;
    }

    if (typeof data === 'object' && data !== null) {
      return (
        <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
    }

    return <span className="text-lg">{String(data)}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Success Badge */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Execution Successful
        </div>
        <span className="text-sm text-muted-foreground">
          Operation: <span className="font-medium">{result.operation}</span>
        </span>
      </div>

      {/* Main Result */}
      <div className="border border-border rounded-lg p-6 bg-card">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Result</h3>
        {renderResult(result.result)}
      </div>

      {/* Metadata */}
      {result.filtered_row_count !== undefined && (
        <div className="text-sm text-muted-foreground">
          Analyzed <span className="font-medium">{result.filtered_row_count.toLocaleString()}</span> rows
        </div>
      )}
    </div>
  );
}
