import React, { useEffect, useId, useMemo, useState } from 'react';
import { WeightLog } from '../types';
import { diffLocalDays, shiftLocalDate } from '../utils/date';

type ChartSpan = 'week' | 'month' | 'all';

interface WeightTrendChartProps {
  logs: WeightLog[];
  span: ChartSpan;
  today: string;
  rangeStart: string;
  goal: number | null;
  slotLabel: (slot: WeightLog['timeSlot']) => string;
}

interface ChartPoint {
  log: WeightLog;
  x: number;
  y: number;
}

const WIDTH = 360;
const HEIGHT = 208;
const PAD = { left: 38, right: 16, top: 24, bottom: 32 };

function niceStep(raw: number): number {
  const safe = raw > 0 ? raw : 1;
  const power = 10 ** Math.floor(Math.log10(safe));
  const fraction = safe / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * power;
}

function formatMonthDay(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

function formatFullDate(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${month}月${day}日`;
}

// 单调三次插值只在相邻两点之间过渡，并把切线限制在同向区间内，
// 因而不会越过相邻记录的极值。稀疏记录仍按真实日期位于其横轴位置。
function makeSafeCurve(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const secants: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    secants.push(dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx);
  }

  const tangents = points.map((_, i) => {
    if (i === 0) return secants[0] || 0;
    if (i === points.length - 1) return secants[secants.length - 1] || 0;
    const prev = secants[i - 1];
    const next = secants[i];
    if (prev === 0 || next === 0 || prev * next < 0) return 0;
    const a = Math.abs(prev);
    const b = Math.abs(next);
    return (2 * a * b) / (a + b) * Math.sign(prev);
  });

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = (p1.x - p0.x) / 3;
    path += ` C ${p0.x + dx} ${p0.y + tangents[i] * dx}, ${p1.x - dx} ${p1.y - tangents[i + 1] * dx}, ${p1.x} ${p1.y}`;
  }
  return path;
}

export const WeightTrendChart: React.FC<WeightTrendChartProps> = ({
  logs,
  span,
  today,
  rangeStart,
  goal,
  slotLabel,
}) => {
  const gradientId = useId().replace(/:/g, '');
  const sortedLogs = useMemo(
    () => [...logs]
      .filter(log => log.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    [logs, today],
  );

  const firstDate = span === 'all' ? (sortedLogs[0]?.date || today) : rangeStart;
  const lastDate = span === 'all' ? (sortedLogs[sortedLogs.length - 1]?.date || today) : today;
  const singleDateRange = span === 'all' && firstDate === lastDate;
  const actualRangeStart = singleDateRange ? shiftLocalDate(firstDate, -3) : firstDate;
  const actualRangeEnd = singleDateRange ? shiftLocalDate(lastDate, 3) : lastDate;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(prev => {
      if (prev && sortedLogs.some(log => log.id === prev)) return prev;
      return sortedLogs[sortedLogs.length - 1]?.id ?? null;
    });
  }, [span, rangeStart, today, sortedLogs]);

  const selectedLog = sortedLogs.find(log => log.id === selectedId) || sortedLogs[sortedLogs.length - 1] || null;

  const chart = useMemo(() => {
    if (sortedLogs.length === 0) return null;

    const totalDays = Math.max(1, diffLocalDays(actualRangeStart, actualRangeEnd));
    const plotWidth = WIDTH - PAD.left - PAD.right;
    const plotHeight = HEIGHT - PAD.top - PAD.bottom;
    const values = sortedLogs.map(log => log.weight);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const dataSpread = dataMax - dataMin;
    const goalDistance = goal === null
      ? Number.POSITIVE_INFINITY
      : goal < dataMin ? dataMin - goal : goal > dataMax ? goal - dataMax : 0;
    // 目标距离过远时优先保留体重差异的可读性，目标改在图表下方明确标注。
    const showGoal = goal !== null && goalDistance <= Math.max(3, dataSpread * 2.5);
    const scaleMin = showGoal && goal !== null ? Math.min(dataMin, goal) : dataMin;
    const scaleMax = showGoal && goal !== null ? Math.max(dataMax, goal) : dataMax;
    const step = niceStep(Math.max(scaleMax - scaleMin, 0.8) / 3);
    const yMin = Math.floor((scaleMin - Math.max(0.2, (scaleMax - scaleMin) * 0.12)) / step) * step;
    const yMax = Math.ceil((scaleMax + Math.max(0.2, (scaleMax - scaleMin) * 0.12)) / step) * step;
    const safeYMin = yMin === yMax ? yMin - step : yMin;
    const safeYMax = yMin === yMax ? yMax + step : yMax;

    const xOf = (date: string) => {
      const days = diffLocalDays(actualRangeStart, date);
      return PAD.left + Math.max(0, Math.min(totalDays, days)) / totalDays * plotWidth;
    };
    const yOf = (value: number) =>
      PAD.top + (safeYMax - value) / (safeYMax - safeYMin) * plotHeight;

    const points: ChartPoint[] = sortedLogs.map(log => ({
      log,
      x: xOf(log.date),
      y: yOf(log.weight),
    }));
    const curve = makeSafeCurve(points);
    const area = points.length > 1
      ? `${curve} L ${points[points.length - 1].x} ${HEIGHT - PAD.bottom} L ${points[0].x} ${HEIGHT - PAD.bottom} Z`
      : '';

    const yTicks = Array.from(
      new Set([safeYMin, (safeYMin + safeYMax) / 2, safeYMax].map(value => value.toFixed(1))),
    ).map(Number);

    const midDate = shiftLocalDate(actualRangeStart, Math.round(totalDays / 2));
    const xTicks = [
      { date: actualRangeStart, x: PAD.left },
      { date: midDate, x: PAD.left + plotWidth / 2 },
      { date: actualRangeEnd, x: PAD.left + plotWidth },
    ].filter((tick, index, list) => index === 0 || tick.date !== list[index - 1].date);

    return {
      points,
      curve,
      area,
      yTicks,
      yOf,
      xTicks,
      goalY: showGoal && goal !== null ? yOf(goal) : null,
      showGoal,
    };
  }, [actualRangeEnd, actualRangeStart, goal, sortedLogs]);

  const rangeText = `${formatMonthDay(actualRangeStart)}–${formatMonthDay(actualRangeEnd)}`;

  if (!chart) {
    return (
      <div
        className="rounded-ctl border border-dashed border-line-strong bg-surface-subtle px-4 py-8 text-center"
        data-testid="weight-chart-empty"
      >
        <p className="text-body font-semibold text-ink-2">{rangeText} 暂无体重记录</p>
        <p className="mt-1 text-cap text-ink-3">这里只显示所选真实日期范围内的数据</p>
      </div>
    );
  }

  return (
    <div className="min-w-0" data-testid="weight-trend-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="block h-auto w-full overflow-visible"
        role="group"
        aria-label={`${rangeText} 体重走势，共 ${sortedLogs.length} 条记录。可用点击或键盘选择记录点。`}
        onPointerDown={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / bounds.width * WIDTH;
          const closest = chart.points.reduce((best, point) =>
            Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best,
          );
          setSelectedId(closest.log.id);
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--c-success))" stopOpacity="0.2" />
            <stop offset="100%" stopColor="rgb(var(--c-success))" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {chart.yTicks.map(tick => {
          const y = chart.yOf(tick);
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                y1={y}
                x2={WIDTH - PAD.right}
                y2={y}
                stroke="rgb(var(--c-line))"
                strokeDasharray="2 5"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 7}
                y={y + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="rgb(var(--c-ink-3))"
              >
                {tick.toFixed(1)}
              </text>
            </g>
          );
        })}
        <text x="2" y="13" fontSize="10" fontWeight="600" fill="rgb(var(--c-ink-3))">kg</text>

        {chart.xTicks.map((tick, index) => (
          <text
            key={`${tick.date}-${index}`}
            x={tick.x}
            y={HEIGHT - 10}
            textAnchor={index === 0 ? 'start' : index === chart.xTicks.length - 1 ? 'end' : 'middle'}
            fontSize="10"
            fill="rgb(var(--c-ink-3))"
          >
            {formatMonthDay(tick.date)}
          </text>
        ))}

        {chart.goalY !== null && goal !== null && (
          <g>
            <line
              x1={PAD.left}
              y1={chart.goalY}
              x2={WIDTH - PAD.right}
              y2={chart.goalY}
              stroke="rgb(var(--c-accent))"
              strokeDasharray="5 4"
              strokeWidth="1.25"
            />
            <text
              x={WIDTH - PAD.right}
              y={chart.goalY - 5}
              textAnchor="end"
              fontSize="10"
              fontWeight="600"
              fill="rgb(var(--c-accent))"
            >
              目标 {goal.toFixed(1)}
            </text>
          </g>
        )}

        {chart.area && <path d={chart.area} fill={`url(#${gradientId})`} />}
        <path
          d={chart.curve}
          fill="none"
          stroke="rgb(var(--c-success))"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {chart.points.map(point => {
          const selected = point.log.id === selectedLog?.id;
          return (
            <g
              key={point.log.id}
              role="button"
              tabIndex={selected ? 0 : -1}
              aria-label={`${formatFullDate(point.log.date)}，${point.log.weight} 千克`}
              aria-pressed={selected}
              onClick={(event) => {
                if (event.detail === 0) setSelectedId(point.log.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedId(point.log.id);
                }
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  const index = chart.points.findIndex(item => item.log.id === point.log.id);
                  const nextIndex = Math.max(0, Math.min(chart.points.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
                  setSelectedId(chart.points[nextIndex].log.id);
                  event.currentTarget.parentElement?.querySelectorAll<SVGGElement>('[data-testid="weight-chart-point"]')[nextIndex]?.focus();
                }
              }}
              className="cursor-pointer outline-none"
              data-testid="weight-chart-point"
            >
              <circle cx={point.x} cy={point.y} r="11" fill="transparent" />
              {selected && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="7"
                  fill="rgb(var(--c-success))"
                  fillOpacity="0.14"
                  stroke="rgb(var(--c-success))"
                  strokeOpacity="0.35"
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={selected ? 4 : 2.5}
                fill={selected ? 'rgb(var(--c-success))' : 'rgb(var(--c-surface))'}
                stroke="rgb(var(--c-success))"
                strokeWidth={selected ? 2 : 1.5}
              />
            </g>
          );
        })}
      </svg>

      <div
        className="mt-1 flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-ctl bg-surface-subtle px-3 py-2"
        aria-live="polite"
        data-testid="weight-selected-detail"
      >
        {selectedLog ? (
          <>
            <span className="text-sm2 font-semibold text-ink">
              {formatFullDate(selectedLog.date)} · {selectedLog.weight.toFixed(1)} kg
            </span>
            <span className="text-cap text-ink-3">{slotLabel(selectedLog.timeSlot)}</span>
          </>
        ) : (
          <span className="text-sm2 text-ink-3">选择记录点查看详情</span>
        )}
      </div>

      {goal !== null && !chart.showGoal && (
        <p className="mt-1 text-cap text-ink-3">
          目标 {goal.toFixed(1)}kg 距当前数据较远，图表优先显示体重变化细节
        </p>
      )}
    </div>
  );
};
