import React from 'react';
import { FactTrend } from '../../utils/factTrends';

function flagColorClass(flag?: FactTrend['flag']): string {
  if (flag === 'critical' || flag === 'abnormal') return 'text-terracotta';
  if (flag === 'normal') return 'text-sage';
  return 'text-ink-400';
}

interface SparklineProps {
  values: number[];
  width: number;
  height: number;
}

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
        <div className={`bg-paper-50 rounded-lg p-2 flex items-center justify-center ${colorClass}`}>
          <Sparkline values={numericValues} width={200} height={44} />
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
