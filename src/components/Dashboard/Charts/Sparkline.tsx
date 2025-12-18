'use client';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  showDots?: boolean;
}

export default function Sparkline({
  data,
  width = 80,
  height = 24,
  color = '#3b82f6',
  fillColor = 'rgba(59, 130, 246, 0.1)',
  showDots = false,
}: SparklineProps) {
  if (data.length === 0) {
    return <div style={{ width, height }} />;
  }

  const max = Math.max(...data);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const stepX = chartWidth / (data.length - 1 || 1);
  const points = data.map((value, i) => {
    const x = padding + i * stepX;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return { x, y, value };
  });

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const fillPath =
    path +
    ` L ${points[points.length - 1].x} ${height - padding}` +
    ` L ${padding} ${height - padding} Z`;

  return (
    <svg width={width} height={height} className="inline-block">
      {/* Fill area */}
      <path d={fillPath} fill={fillColor} />

      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots */}
      {showDots &&
        points.map((point, i) => (
          <circle key={i} cx={point.x} cy={point.y} r="1.5" fill={color} />
        ))}
    </svg>
  );
}
