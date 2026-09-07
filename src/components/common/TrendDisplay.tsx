import React from 'react';
import { FactTrend } from '../../utils/factTrends';

function flagColorClass(flag?: FactTrend['flag']): string {
  if (flag === 'critical' || flag === 'abnormal') return 'text-terracotta';
  if (flag === 'normal') return 'text-sage';
  return 'text-ink-400';
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

interface SparklineProps {
  values: number[];
  width: number;
  height: number;
}

// Tiny glance-view used in dense grids (trend cards, record rows) — no room
// for labels there, the number next to it already carries the latest value.
const Sparkline: React.FC<SparklineProps> = ({ values, width, height }) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible flex-shrink-0">
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 2.2 : 1.5} fill="currentColor" />
      ))}
    </svg>
  );
};

interface LabeledTrendChartProps {
  points: { date: string; value: number }[];
  unit?: string;
}

// The full chart used wherever there's room to actually read it (visit brief,
// assistant answers) — every point gets its value written above it and its
// date below, against a baseline axis, so the chart stands on its own without
// needing the value table underneath it to be legible.
const LabeledTrendChart: React.FC<LabeledTrendChartProps> = ({ points, unit }) => {
  const paddingTop = 20;
  const paddingBottom = 22;
  const paddingX = 24;
  const plotHeight = 56;
  const height = paddingTop + plotHeight + paddingBottom;
  const stepX = 64;
  const width = points.length > 1 ? paddingX * 2 + stepX * (points.length - 1) : paddingX * 2 + stepX;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => ({
    ...p,
    x: points.length > 1 ? paddingX + i * stepX : width / 2,
    y: paddingTop + plotHeight - ((p.value - min) / range) * plotHeight,
  }));
  const axisY = paddingTop + plotHeight;
  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="block">
        <line x1={0} y1={axisY} x2={width} y2={axisY} stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} />
        <polyline
          points={linePoints}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={i === coords.length - 1 ? 3 : 2.2} fill="currentColor" />
            {/* A halo behind each label keeps it legible where the line itself
                passes close by (e.g. the label for a low point sitting right
                under a steep descending segment). */}
            <text
              x={c.x}
              y={c.y - 7}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight={700}
              fill="currentColor"
              stroke="#FBFAF6"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {c.value}
              {unit ? ` ${unit}` : ''}
            </text>
            <text
              x={c.x}
              y={axisY + 14}
              textAnchor="middle"
              fontSize="8.5"
              fill="currentColor"
              fillOpacity={0.55}
              stroke="#FBFAF6"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {formatShortDate(c.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

interface TrendDisplayProps {
  trend: FactTrend;
  variant?: 'compact' | 'full';
}

// A trend can only be plotted as a line when every value parses as a number
// (e.g. not "Stable 60-70%") — falls back to just the table in that case.
export const TrendDisplay: React.FC<TrendDisplayProps> = ({ trend, variant = 'compact' }) => {
  const numericValues = trend.points.map((p) => parseFloat(p.value));
  const isFullyNumeric = numericValues.every((v) => !isNaN(v));
  const colorClass = flagColorClass(trend.flag);

  if (variant === 'compact') {
    return (
      <div className={colorClass}>
        <div className="flex items-center gap-2">
          {isFullyNumeric && <Sparkline values={numericValues} width={44} height={20} />}
          <p className="text-[11.5px] font-serif font-bold text-ink-800">
            {trend.points[trend.points.length - 1].value}
            {trend.unit ? ` ${trend.unit}` : ''} {trend.direction && <span className={colorClass}>{trend.direction}</span>}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isFullyNumeric && (
        <div className={`bg-paper-50 rounded-lg py-2 px-1 flex items-center justify-center ${colorClass}`}>
          <LabeledTrendChart
            points={trend.points.map((p) => ({ date: p.date, value: parseFloat(p.value) }))}
            unit={trend.unit}
          />
        </div>
      )}
      <div className="border border-paper-300 rounded-lg overflow-hidden">
        <table className="w-full text-[10.5px]">
          <tbody>
            {[...trend.points].reverse().map((p, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-paper-50'}>
                <td className="px-2 py-1 text-ink-400">{p.date}</td>
                <td className="px-2 py-1 text-ink-800 font-medium text-right">
                  {p.value}
                  {trend.unit ? ` ${trend.unit}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
