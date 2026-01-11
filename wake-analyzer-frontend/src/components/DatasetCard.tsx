'use client';

/**
 * Dataset Card Component
 * Displays dataset metadata in a card format
 */

import Link from 'next/link';
import type { Dataset } from '@/types';
import { formatDate } from '@/lib/utils';

interface DatasetCardProps {
  dataset: Dataset;
}

export default function DatasetCard({ dataset }: DatasetCardProps) {
  return (
    <Link href={`/analyze/${dataset.session_id}`}>
      <div className="border border-border rounded-lg p-6 hover:border-primary hover:shadow-lg transition-all cursor-pointer bg-card">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">{dataset.filename}</h3>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium">{dataset.row_count.toLocaleString()}</span> rows ×{' '}
                <span className="font-medium">{dataset.column_count}</span> columns
              </p>
              <p>Uploaded {formatDate(dataset.uploaded_at)}</p>
            </div>
          </div>
          <svg
            className="h-6 w-6 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {dataset.columns.slice(0, 5).map((col) => (
            <span
              key={col}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground"
            >
              {col}
            </span>
          ))}
          {dataset.columns.length > 5 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              +{dataset.columns.length - 5} more
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
