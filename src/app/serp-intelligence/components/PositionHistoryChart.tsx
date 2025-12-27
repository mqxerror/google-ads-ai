'use client';

interface PositionSnapshot {
  snapshot_date: string;
  organic_position: number | null;
}

interface PositionHistoryChartProps {
  keyword: string;
  snapshots: PositionSnapshot[];
  color?: string;
}

export default function PositionHistoryChart({
  keyword,
  snapshots,
  color = '#6366f1',
}: PositionHistoryChartProps) {
  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="p-8 text-center text-text3">
        <p className="text-sm">No position history yet</p>
        <p className="text-xs mt-1">Click "Check Now" to start tracking</p>
      </div>
    );
  }

  // Filter and sort snapshots with positions
  const validSnapshots = snapshots
    .filter((s) => s.organic_position !== null)
    .sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime());

  if (validSnapshots.length === 0) {
    return (
      <div className="p-8 text-center text-text3">
        <p className="text-sm">Not ranked in top 100</p>
      </div>
    );
  }

  // Chart dimensions
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Scale position (1 = best, 100 = worst, inverted for chart)
  const positions = validSnapshots.map((s) => s.organic_position!);
  const minPosition = Math.min(...positions);
  const maxPosition = Math.max(...positions);
  const positionRange = maxPosition - minPosition || 10; // Prevent division by zero

  // Generate points for the line
  const points = validSnapshots.map((snapshot, i) => {
    const x = padding.left + (i / (validSnapshots.length - 1)) * chartWidth;
    const y =
      padding.top +
      chartHeight -
      ((snapshot.organic_position! - minPosition) / positionRange) * chartHeight;
    return { x, y, date: snapshot.snapshot_date, position: snapshot.organic_position };
  });

  // Create SVG path
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Create area path (fill under line)
  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x} ${padding.top + chartHeight}` +
    ` L ${points[0].x} ${padding.top + chartHeight} Z`;

  // Y-axis labels (position numbers)
  const yAxisLabels = [minPosition, Math.round((minPosition + maxPosition) / 2), maxPosition];

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-surface rounded-xl p-6 border border-divider">
      <div className="mb-4">
        <h3 className="font-semibold text-text">{keyword}</h3>
        <p className="text-xs text-text3">Position over time (lower is better)</p>
      </div>

      <svg width={width} height={height} className="overflow-visible">
        {/* Grid lines */}
        {yAxisLabels.map((pos) => {
          const y =
            padding.top + chartHeight - ((pos - minPosition) / positionRange) * chartHeight;
          return (
            <g key={pos}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <text
                x={padding.left - 10}
                y={y}
                textAnchor="end"
                alignmentBaseline="middle"
                className="text-xs fill-text3"
              >
                #{pos}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill={color} fillOpacity="0.1" />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" />

        {/* Data points */}
        {points.map((point, i) => (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill={color}
              stroke="white"
              strokeWidth="2"
              className="cursor-pointer hover:r-6 transition-all"
            />
            {/* Tooltip on hover */}
            <title>
              {formatDate(point.date)}: Position #{point.position}
            </title>
          </g>
        ))}

        {/* X-axis dates */}
        {points.map((point, i) => {
          // Only show first, middle, and last dates
          if (i === 0 || i === Math.floor(points.length / 2) || i === points.length - 1) {
            return (
              <text
                key={i}
                x={point.x}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                className="text-xs fill-text3"
              >
                {formatDate(point.date)}
              </text>
            );
          }
          return null;
        })}

        {/* Current position indicator */}
        {points.length > 0 && (
          <g>
            <rect
              x={points[points.length - 1].x - 25}
              y={points[points.length - 1].y - 30}
              width="50"
              height="20"
              rx="4"
              fill={color}
            />
            <text
              x={points[points.length - 1].x}
              y={points[points.length - 1].y - 17}
              textAnchor="middle"
              className="text-xs fill-white font-semibold"
            >
              #{points[points.length - 1].position}
            </text>
          </g>
        )}
      </svg>

      {/* Position change indicator */}
      {points.length > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-text3">Change:</span>
          {(() => {
            const change = points[0].position! - points[points.length - 1].position!;
            if (change > 0) {
              return (
                <span className="text-green-600 font-medium">
                  ↑ {change} positions (improved)
                </span>
              );
            } else if (change < 0) {
              return (
                <span className="text-red-600 font-medium">
                  ↓ {Math.abs(change)} positions (dropped)
                </span>
              );
            } else {
              return <span className="text-text3">No change</span>;
            }
          })()}
        </div>
      )}
    </div>
  );
}
