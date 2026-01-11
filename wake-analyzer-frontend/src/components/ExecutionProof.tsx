'use client';

/**
 * Execution Proof Panel
 * Always-visible panel showing execution proof and audit trail
 */

import type { Analysis } from '@/types';
import { formatDate } from '@/lib/utils';

interface ExecutionProofProps {
  analyses: Analysis[];
}

export default function ExecutionProof({ analyses }: ExecutionProofProps) {
  if (analyses.length === 0) {
    return (
      <div className="border border-border rounded-lg p-6 bg-card">
        <h3 className="text-sm font-semibold mb-2">📋 Execution Proof</h3>
        <p className="text-sm text-muted-foreground">No executions yet. All results are logged here.</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-6 bg-card">
      <h3 className="text-sm font-semibold mb-4">📋 Execution Proof</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Complete audit trail - all numerical results verified by Python execution
      </p>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {analyses.map((analysis) => (
          <div
            key={analysis.id}
            className={`border rounded-lg p-3 text-sm ${
              analysis.success
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">
                {analysis.execution_plan.operation}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(analysis.executed_at)}
              </span>
            </div>

            {analysis.success ? (
              <>
                <div className="text-xs text-muted-foreground mb-1">
                  ✅ Executed successfully in {analysis.execution_time_ms}ms
                </div>
                {analysis.filtered_row_count && (
                  <div className="text-xs text-muted-foreground">
                    Analyzed {analysis.filtered_row_count.toLocaleString()} rows
                  </div>
                )}
                {analysis.result && (
                  <div className="mt-2 text-xs">
                    <span className="font-medium">Result: </span>
                    {typeof analysis.result === 'object' ? (
                      <span className="text-muted-foreground">
                        {JSON.stringify(analysis.result).substring(0, 50)}...
                      </span>
                    ) : (
                      <span className="font-semibold">{analysis.result}</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-destructive">
                ❌ {analysis.error_message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
