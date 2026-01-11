'use client';

/**
 * Data Health View Component
 * Shows dataset metadata, columns, types, and preview
 */

import type { Dataset } from '@/types';

interface DataHealthViewProps {
  dataset: Dataset;
}

export default function DataHealthView({ dataset }: DataHealthViewProps) {
  return (
    <div className="border border-border rounded-lg p-6 bg-card">
      <h3 className="text-lg font-semibold mb-4">Dataset Health</h3>

      {/* Overview */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-primary">{dataset.row_count.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Rows</div>
        </div>
        <div className="border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-primary">{dataset.column_count}</div>
          <div className="text-sm text-muted-foreground">Columns</div>
        </div>
        <div className="border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">✓</div>
          <div className="text-sm text-muted-foreground">Healthy</div>
        </div>
      </div>

      {/* Columns */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Columns & Types</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {dataset.columns.map((col) => (
            <div key={col} className="flex items-center justify-between py-2 px-3 bg-secondary rounded-md">
              <span className="font-medium text-sm">{col}</span>
              <span className="text-xs px-2 py-1 bg-background rounded">
                {dataset.column_types[col]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
