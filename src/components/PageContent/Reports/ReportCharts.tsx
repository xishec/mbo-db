import type { ReactNode } from "react";

export type ChartDatum = {
  label: string;
  value: number;
};

export type DailyTrendDatum = {
  label: string;
  value: number;
  mean7: number;
};

export type MultiLineSeries = {
  key: string;
  label: string;
  color: string;
  data: ChartDatum[];
};

type ChartContainerProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function ChartContainer({ title, subtitle, children }: ChartContainerProps) {
  return (
    <div className="rounded-xl border border-default-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-default-900">{title}</h3>
        {subtitle && <p className="text-xs text-default-600">{subtitle}</p>}
      </div>
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}

type BarChartProps = {
  data: ChartDatum[];
  ariaLabel: string;
  height?: number;
  valueFormatter?: (value: number) => string;
};

export function BarChart({ data, ariaLabel, height = 240, valueFormatter }: BarChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-default-500">
        No data available.
      </div>
    );
  }

  // Use a base width that scales with data, but make it responsive
  const baseWidth = 800;
  const width = baseWidth;
  const padding = { top: 20, right: 20, bottom: 60, left: 50 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = width - padding.left - padding.right;
  const maxValue = Math.max(...data.map((datum) => datum.value), 1);
  const barWidth = Math.max(30, chartWidth / data.length);
  const labelOffset = 18;
  const tickCount = 5;
  const tickStep = maxValue / tickCount;
  const primaryColor = "#007575"; // Primary color from theme

  // Generate Y-axis ticks
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const value = i * tickStep;
    const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
    return { value, y };
  });

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke={i === 0 ? "#e5e7eb" : "#f3f4f6"}
            strokeWidth={1}
            strokeDasharray={i === 0 ? "0" : "4 4"}
          />
        ))}

        {/* Axes */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={width - padding.right}
          y2={padding.top + chartHeight}
          stroke="#d1d5db"
          strokeWidth={2}
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
          stroke="#d1d5db"
          strokeWidth={2}
        />

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text
            key={i}
            x={padding.left - 8}
            y={tick.y + 4}
            textAnchor="end"
            fontSize={10}
            fill="#6b7280"
          >
            {valueFormatter ? valueFormatter(tick.value) : Math.round(tick.value)}
          </text>
        ))}

        {/* Bars */}
        {data.map((datum, index) => {
          const barHeight = (datum.value / maxValue) * chartHeight;
          const x = padding.left + index * barWidth + barWidth * 0.1;
          const y = padding.top + chartHeight - barHeight;
          const barActualWidth = barWidth * 0.8;

          return (
            <g key={datum.label}>
              <rect
                x={x}
                y={y}
                width={barActualWidth}
                height={barHeight}
                fill={primaryColor}
                rx={4}
                className="hover:opacity-80 transition-opacity"
              />
              {barHeight > 20 && (
                <text
                  x={x + barActualWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#1f2937"
                  fontWeight="500"
                >
                  {valueFormatter ? valueFormatter(datum.value) : datum.value}
                </text>
              )}
              <text
                x={x + barActualWidth / 2}
                y={padding.top + chartHeight + labelOffset}
                textAnchor="middle"
                fontSize={10}
                fill="#6b7280"
                transform={`rotate(${datum.label.length > 8 ? 35 : 0} ${x + barActualWidth / 2} ${padding.top + chartHeight + labelOffset})`}
              >
                {datum.label}
              </text>
              <title>{`${datum.label}: ${valueFormatter ? valueFormatter(datum.value) : datum.value}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type LineChartProps = {
  data: ChartDatum[];
  ariaLabel: string;
  height?: number;
  valueFormatter?: (value: number) => string;
};

export function LineChart({ data, ariaLabel, height = 240, valueFormatter }: LineChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-default-500">
        No data available.
      </div>
    );
  }

  // Use a base width that scales with data, but make it responsive
  const baseWidth = 800;
  const width = baseWidth;
  const padding = { top: 30, right: 20, bottom: 70, left: 50 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = width - padding.left - padding.right;
  const maxValue = Math.max(...data.map((datum) => datum.value), 1);
  const pointCount = Math.max(data.length - 1, 1);
  const tickCount = 5;
  const tickStep = maxValue / tickCount;
  const primaryColor = "#007575"; // Primary color from theme

  const points = data.map((datum, index) => {
    const x = padding.left + (index / pointCount) * chartWidth;
    const y = padding.top + chartHeight - (datum.value / maxValue) * chartHeight;
    return { x, y, datum, index };
  });

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  // Generate Y-axis ticks
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const value = i * tickStep;
    const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
    return { value, y };
  });

  // Smart label selection: only show labels for key points to avoid overlap
  // Show: first, last, peaks, valleys, and evenly spaced points
  const getKeyPoints = () => {
    if (points.length <= 5) return points; // Show all if few points

    const keyPoints = new Set<number>([0, points.length - 1]); // Always show first and last

    // Find peaks and valleys
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1].datum.value;
      const curr = points[i].datum.value;
      const next = points[i + 1].datum.value;
      
      // Peak: higher than neighbors
      if (curr > prev && curr > next) {
        keyPoints.add(i);
      }
      // Valley: lower than neighbors
      if (curr < prev && curr < next) {
        keyPoints.add(i);
      }
    }

    // Add evenly spaced points if we still have room
    const maxLabels = Math.min(12, Math.ceil(points.length / 4)); // Max 12 labels or 1 per 4 points
    const spacing = Math.max(1, Math.floor(points.length / maxLabels));
    for (let i = 0; i < points.length; i += spacing) {
      keyPoints.add(i);
    }

    return Array.from(keyPoints)
      .sort((a, b) => a - b)
      .map((idx) => points[idx]);
  };

  const keyPoints = getKeyPoints();

  // Smart x-axis label selection: show fewer labels to prevent overlap
  const getXAxisLabels = () => {
    if (points.length <= 8) return points; // Show all if few points

    const maxXLabels = Math.min(8, Math.ceil(points.length / 6)); // Max 8 labels
    const spacing = Math.max(1, Math.floor(points.length / maxXLabels));
    const labels: typeof points = [];
    
    // Always include first and last
    labels.push(points[0]);
    for (let i = spacing; i < points.length - 1; i += spacing) {
      labels.push(points[i]);
    }
    if (points.length > 1 && labels[labels.length - 1] !== points[points.length - 1]) {
      labels.push(points[points.length - 1]);
    }
    
    return labels;
  };

  const xAxisLabels = getXAxisLabels();

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke={i === 0 ? "#e5e7eb" : "#f3f4f6"}
            strokeWidth={1}
            strokeDasharray={i === 0 ? "0" : "4 4"}
          />
        ))}

        {/* Axes */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={width - padding.right}
          y2={padding.top + chartHeight}
          stroke="#d1d5db"
          strokeWidth={2}
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
          stroke="#d1d5db"
          strokeWidth={2}
        />

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text
            key={i}
            x={padding.left - 8}
            y={tick.y + 4}
            textAnchor="end"
            fontSize={10}
            fill="#6b7280"
          >
            {valueFormatter ? valueFormatter(tick.value) : Math.round(tick.value)}
          </text>
        ))}

        {/* Line */}
        <path d={path} fill="none" stroke={primaryColor} strokeWidth={2.5} className="drop-shadow-sm" />

        {/* All points (smaller, no labels) */}
        {points.map((point) => (
          <circle
            key={`point-${point.index}`}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={primaryColor}
            stroke="white"
            strokeWidth={1.5}
            className="hover:r-5 transition-all"
          >
            <title>{`${point.datum.label}: ${valueFormatter ? valueFormatter(point.datum.value) : point.datum.value}`}</title>
          </circle>
        ))}

        {/* Key points with value labels */}
        {keyPoints.map((point) => (
          <g key={`key-${point.index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={6}
              fill={primaryColor}
              stroke="white"
              strokeWidth={2.5}
              className="hover:r-7 transition-all"
            />
            <text
              x={point.x}
              y={point.y - 14}
              textAnchor="middle"
              fontSize={11}
              fill="#1f2937"
              fontWeight="600"
            >
              {valueFormatter ? valueFormatter(point.datum.value) : point.datum.value}
            </text>
            <title>{`${point.datum.label}: ${valueFormatter ? valueFormatter(point.datum.value) : point.datum.value}`}</title>
          </g>
        ))}

        {/* X-axis labels (only for selected points) */}
        {xAxisLabels.map((point) => (
          <text
            key={`xlabel-${point.index}`}
            x={point.x}
            y={padding.top + chartHeight + 20}
            textAnchor="middle"
            fontSize={10}
            fill="#6b7280"
            transform={`rotate(45 ${point.x} ${padding.top + chartHeight + 20})`}
          >
            {point.datum.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

type MultiLineChartProps = {
  series: MultiLineSeries[];
  ariaLabel: string;
  height?: number;
  valueFormatter?: (value: number) => string;
};

export function MultiLineChart({ series, ariaLabel, height = 260, valueFormatter }: MultiLineChartProps) {
  if (!series.length || !series[0].data.length) {
    return <div className="flex h-60 items-center justify-center text-sm text-default-500">No data available.</div>;
  }

  const baseWidth = 900;
  const width = baseWidth;
  const padding = { top: 30, right: 20, bottom: 70, left: 50 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = width - padding.left - padding.right;
  const labels = series[0].data.map((datum) => datum.label);
  const pointCount = Math.max(labels.length - 1, 1);
  const maxValue = Math.max(
    ...series.flatMap((entry) => entry.data.map((datum) => datum.value)),
    1
  );
  const tickCount = 5;
  const tickStep = maxValue / tickCount;

  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const value = i * tickStep;
    const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
    return { value, y };
  });

  const linePaths = series.map((entry) => {
    const points = entry.data.map((datum, index) => {
      const x = padding.left + (index / pointCount) * chartWidth;
      const y = padding.top + chartHeight - (datum.value / maxValue) * chartHeight;
      return { x, y, datum };
    });
    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
    return { ...entry, points, path };
  });

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-default-600">
        {series.map((entry) => (
          <div key={entry.key} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.label}
          </div>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke={i === 0 ? "#e5e7eb" : "#f3f4f6"}
            strokeWidth={1}
            strokeDasharray={i === 0 ? "0" : "4 4"}
          />
        ))}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={width - padding.right}
          y2={padding.top + chartHeight}
          stroke="#d1d5db"
          strokeWidth={2}
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
          stroke="#d1d5db"
          strokeWidth={2}
        />
        {yTicks.map((tick, i) => (
          <text key={i} x={padding.left - 8} y={tick.y + 4} textAnchor="end" fontSize={10} fill="#6b7280">
            {valueFormatter ? valueFormatter(tick.value) : Math.round(tick.value)}
          </text>
        ))}

        {linePaths.map((entry) => (
          <path
            key={entry.key}
            d={entry.path}
            fill="none"
            stroke={entry.color}
            strokeWidth={2.5}
          />
        ))}

        {linePaths.map((entry) =>
          entry.points.map((point, index) => (
            <circle key={`${entry.key}-${index}`} cx={point.x} cy={point.y} r={2} fill={entry.color}>
              <title>
                {point.datum.label}: {valueFormatter ? valueFormatter(point.datum.value) : point.datum.value}
              </title>
            </circle>
          ))
        )}

        {labels.map((label, index) => {
          const x = padding.left + (index / pointCount) * chartWidth;
          const y = padding.top + chartHeight + 18;
          if (index % 2 !== 0) return null;
          return (
            <text key={label} x={x} y={y} textAnchor="middle" fontSize={10} fill="#6b7280">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

type DailyTrendChartProps = {
  data: DailyTrendDatum[];
  ariaLabel: string;
  height?: number;
  valueFormatter?: (value: number) => string;
};

export function DailyTrendChart({ data, ariaLabel, height = 260, valueFormatter }: DailyTrendChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-default-500">
        No data available.
      </div>
    );
  }

  const baseWidth = 900;
  const width = baseWidth;
  const padding = { top: 28, right: 20, bottom: 70, left: 50 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = width - padding.left - padding.right;
  const maxValue = Math.max(1, ...data.map((datum) => Math.max(datum.value, datum.mean7)));
  const barWidth = chartWidth / data.length;
  const meanLineColor = "#0f766e";
  const barColor = "#99d5cf";

  const tickCount = 5;
  const tickStep = maxValue / tickCount;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const value = i * tickStep;
    const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
    return { value, y };
  });

  const points = data.map((datum, index) => {
    const x = padding.left + index * barWidth + barWidth / 2;
    const y = padding.top + chartHeight - (datum.mean7 / maxValue) * chartHeight;
    return { x, y, datum, index };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const maxXLabels = Math.min(10, Math.ceil(data.length / 10));
  const spacing = Math.max(1, Math.floor(data.length / maxXLabels));
  const xLabels = data.filter((_, index) => index % spacing === 0 || index === data.length - 1);

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-default-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: barColor }} />
          Daily total
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5" style={{ background: meanLineColor }} />
          7-day running mean
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke={i === 0 ? "#e5e7eb" : "#f3f4f6"}
            strokeWidth={1}
            strokeDasharray={i === 0 ? "0" : "4 4"}
          />
        ))}

        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={width - padding.right}
          y2={padding.top + chartHeight}
          stroke="#d1d5db"
          strokeWidth={2}
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
          stroke="#d1d5db"
          strokeWidth={2}
        />

        {yTicks.map((tick, i) => (
          <text
            key={i}
            x={padding.left - 8}
            y={tick.y + 4}
            textAnchor="end"
            fontSize={10}
            fill="#6b7280"
          >
            {valueFormatter ? valueFormatter(tick.value) : Math.round(tick.value)}
          </text>
        ))}

        {data.map((datum, index) => {
          const barHeight = (datum.value / maxValue) * chartHeight;
          const x = padding.left + index * barWidth + barWidth * 0.15;
          const y = padding.top + chartHeight - barHeight;
          const barActualWidth = Math.max(1, barWidth * 0.7);

          return (
            <rect
              key={`${datum.label}-${index}`}
              x={x}
              y={y}
              width={barActualWidth}
              height={barHeight}
              fill={barColor}
              rx={2}
            >
              <title>{`${datum.label}: ${valueFormatter ? valueFormatter(datum.value) : datum.value}`}</title>
            </rect>
          );
        })}

        <path d={linePath} fill="none" stroke={meanLineColor} strokeWidth={2.5} />
        {points.map((point) => (
          <circle
            key={`mean-${point.index}`}
            cx={point.x}
            cy={point.y}
            r={3.5}
            fill={meanLineColor}
            stroke="white"
            strokeWidth={1.5}
          >
            <title>{`${point.datum.label}: ${valueFormatter ? valueFormatter(point.datum.mean7) : point.datum.mean7}`}</title>
          </circle>
        ))}

        {xLabels.map((datum) => {
          const index = data.indexOf(datum);
          const x = padding.left + index * barWidth + barWidth / 2;
          return (
            <text
              key={`xlabel-${datum.label}-${index}`}
              x={x}
              y={padding.top + chartHeight + 20}
              textAnchor="middle"
              fontSize={10}
              fill="#6b7280"
              transform={`rotate(45 ${x} ${padding.top + chartHeight + 20})`}
            >
              {datum.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
