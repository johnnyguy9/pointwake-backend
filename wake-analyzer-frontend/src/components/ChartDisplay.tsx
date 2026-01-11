'use client';

/**
 * Chart Display Component
 * Displays generated charts as images
 */

interface ChartDisplayProps {
  chartData: string | null;
}

export default function ChartDisplay({ chartData }: ChartDisplayProps) {
  if (!chartData) {
    return null;
  }

  return (
    <div className="border border-border rounded-lg p-6 bg-card">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Visualization</h3>
      <div className="rounded-lg overflow-hidden bg-white">
        <img
          src={chartData}
          alt="Analysis chart"
          className="w-full h-auto"
        />
      </div>
    </div>
  );
}
