'use client';

/**
 * Query Interface Component
 * Allows users to enter JSON execution plans
 */

import { useState } from 'react';
import type { ExecutionPlan } from '@/types';

interface QueryInterfaceProps {
  onExecute: (plan: ExecutionPlan) => void;
  loading: boolean;
}

export default function QueryInterface({ onExecute, loading }: QueryInterfaceProps) {
  const [planJSON, setPlanJSON] = useState('');
  const [error, setError] = useState('');

  const handleExecute = () => {
    setError('');

    try {
      const plan = JSON.parse(planJSON);
      onExecute(plan);
    } catch (err) {
      setError('Invalid JSON format. Please check your execution plan.');
    }
  };

  const insertTemplate = (template: string) => {
    setPlanJSON(template);
  };

  const templates = {
    mean: `{
  "operation": "mean",
  "target_column": "column_name",
  "filters": [],
  "chart_type": "histogram"
}`,
    grouped: `{
  "operation": "sum",
  "target_column": "value_column",
  "filters": [
    {"column": "status", "operator": "==", "value": "active"}
  ],
  "group_by": ["category"],
  "chart_type": "bar"
}`,
    correlation: `{
  "operation": "correlation",
  "x_axis": "column_x",
  "y_axis": "column_y",
  "chart_type": "scatter"
}`,
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Execution Plan (JSON)</label>
          <div className="flex gap-2">
            <button
              onClick={() => insertTemplate(templates.mean)}
              className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
            >
              Mean Template
            </button>
            <button
              onClick={() => insertTemplate(templates.grouped)}
              className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
            >
              Grouped Template
            </button>
            <button
              onClick={() => insertTemplate(templates.correlation)}
              className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
            >
              Correlation Template
            </button>
          </div>
        </div>
        <textarea
          value={planJSON}
          onChange={(e) => setPlanJSON(e.target.value)}
          placeholder="Enter your execution plan in JSON format..."
          rows={12}
          className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        onClick={handleExecute}
        disabled={loading || !planJSON.trim()}
        className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Executing...
          </span>
        ) : (
          'Execute Plan'
        )}
      </button>

      <p className="text-xs text-muted-foreground">
        💡 All results come from Python execution - zero AI hallucination
      </p>
    </div>
  );
}
