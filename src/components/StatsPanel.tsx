import { useState, useEffect } from 'react';
import { getAll } from '../storage';
import type { LeetCodeEntry } from '../types';
import { colors, fontFamily } from '../styles';
import { getReviewDates, computeStreak } from '../lib/streak';

interface Props {
  onBack: () => void;
}

function getStabilityBuckets(entries: LeetCodeEntry[]): { label: string; value: number }[] {
  const values = entries
    .filter((e) => e.stability != null && e.stability > 0)
    .map((e) => e.stability!);
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const bucketSize = range / 5;
  const buckets = new Array(5).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / bucketSize), 4);
    buckets[idx]++;
  }
  return buckets.map((count, i) => {
    const lo = (min + i * bucketSize).toFixed(1);
    const hi = (min + (i + 1) * bucketSize).toFixed(1);
    return { label: `${lo}-${hi}`, value: count };
  });
}

function SimpleBarChart({
  items,
  color,
  height = 120,
  width = 268,
  xLabel,
}: {
  items: { label: string; value: number; color?: string }[];
  color?: string;
  height?: number;
  width?: number;
  xLabel?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1) * 1.2;
  const chartW = width - 30;
  const n = items.length;
  const gap = Math.min(6, Math.max(2, Math.floor(chartW / n / 6)));
  const barW = Math.floor((chartW - gap * (n - 1)) / n);
  const chartH = height - 30;
  const labelY = chartH + 24;

  return (
    <svg width={width} height={height}>
      <text
        transform={`rotate(-90, 10, ${chartH / 2})`}
        x={10}
        y={chartH / 2}
        textAnchor="middle"
        fill={colors.text}
        fontSize={11}
        fontWeight={600}
      >
        Count
      </text>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = chartH * (1 - t);
        return (
          <g key={t}>
            <line x1={28} y1={y} x2={width} y2={y} stroke={colors.separator} strokeWidth={0.5} />
            <text x={26} y={y + 3} textAnchor="end" fill={colors.text} fontSize={11}>
              {Math.round(t * max)}
            </text>
          </g>
        );
      })}
      {items.map((item, i) => {
        const h = (item.value / max) * chartH;
        const x = 30 + i * (barW + gap);
        return (
          <g key={item.label}>
            <rect
              x={x}
              y={chartH - h}
              width={barW}
              height={h}
              rx={2}
              fill={item.color || color || colors.accent}
            />
            <text
              x={x + barW / 2}
              y={chartH + 14}
              textAnchor="middle"
              fill={colors.text}
              fontSize={11}
              fontWeight={500}
            >
              {item.label}
            </text>
          </g>
        );
      })}
      {xLabel && (
        <text
          x={width / 2}
          y={labelY + 4}
          textAnchor="middle"
          fill={colors.text}
          fontSize={11}
          fontWeight={600}
        >
          {xLabel}
        </text>
      )}
    </svg>
  );
}

function HBarChart({
  items,
  width = 268,
  maxLabelW = 100,
}: {
  items: { label: string; value: number }[];
  width?: number;
  maxLabelW?: number;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const barH = 16;
  const gap = 4;
  const rowH = barH + gap;
  const height = items.length * rowH + 18;

  return (
    <svg width={width} height={height}>
      {items.map((item, i) => {
        const barW = ((width - maxLabelW - 30) / max) * Math.min(item.value, max);
        const y = i * rowH;
        return (
          <g key={item.label}>
            <text
              x={maxLabelW - 4}
              y={y + barH - 3}
              textAnchor="end"
              fill={colors.text}
              fontSize={12}
            >
              {item.label}
            </text>
            <rect
              x={maxLabelW}
              y={y + 1}
              width={barW}
              height={barH - 2}
              rx={3}
              fill={colors.accent}
            />
            <text
              x={maxLabelW + barW + 4}
              y={y + barH - 3}
              fill={colors.text}
              fontSize={12}
              fontWeight={500}
            >
              {item.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: colors.bgSecondary,
        borderRadius: 10,
        padding: '12px 10px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>{value}</div>
      <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
      }}
    >
      {title}
    </div>
  );
}

export default function StatsPanel({ onBack }: Props) {
  const [entries, setEntries] = useState<LeetCodeEntry[]>([]);
  const [chartIdx, setChartIdx] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');

  useEffect(() => {
    getAll().then(setEntries);
  }, []);

  if (!entries.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: `1px solid ${colors.separator}`,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onBack}
            style={{
              flex: 1,
              textAlign: 'left',
              background: 'none',
              border: 'none',
              color: colors.accent,
              fontSize: 15,
              padding: 0,
              fontFamily,
              cursor: 'pointer',
            }}
          >
            ‹ Back
          </button>
          <span
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 15,
              fontWeight: 600,
              color: colors.text,
            }}
          >
            Statistics
          </span>
          <span style={{ flex: 1 }} />
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.textTertiary,
            fontSize: 14,
          }}
        >
          No entries yet
        </div>
      </div>
    );
  }

  const total = entries.length;
  const today = new Date().toISOString().slice(0, 10);
  const dueToday = entries.filter((e) => !e.dueDate || e.dueDate.slice(0, 10) <= today).length;
  const avgRating = total > 0 ? entries.reduce((s, e) => s + e.rating, 0) / total : 0;
  const dates = getReviewDates(entries);
  const streak = computeStreak(dates);
  const diffCounts = [
    {
      label: 'Easy',
      value: entries.filter((e) => e.difficulty === 'easy').length,
      color: colors.difficulty.easy,
    },
    {
      label: 'Medium',
      value: entries.filter((e) => e.difficulty === 'medium').length,
      color: colors.difficulty.medium,
    },
    {
      label: 'Hard',
      value: entries.filter((e) => e.difficulty === 'hard').length,
      color: colors.difficulty.hard,
    },
  ];

  const ratingItems = [1, 2, 3, 4].map((r) => ({
    label: `${r}`,
    value: entries.filter((e) => e.rating === r).length,
  }));

  const tagMap: Record<string, number> = {};
  for (const e of entries) {
    if (e.tags) for (const t of e.tags) tagMap[t] = (tagMap[t] || 0) + 1;
  }
  const topTags = Object.entries(tagMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({
      label: label.length > 15 ? label.slice(0, 15) + '…' : label,
      value,
    }));

  const stabilityBuckets = getStabilityBuckets(entries);
  const stabilityTotal = stabilityBuckets.reduce((s, b) => s + b.value, 0);

  const sections: { title: string; render: () => JSX.Element }[] = [
    {
      title: `Difficulty (${total})`,
      render: () => <SimpleBarChart items={diffCounts} height={150} xLabel="Difficulty" />,
    },
    {
      title: `Rating Distribution (${total})`,
      render: () => (
        <SimpleBarChart items={ratingItems} color={colors.accent} height={150} xLabel="Rating" />
      ),
    },
    ...(topTags.length > 0
      ? [
          {
            title: `Top Topics (${topTags.length})`,
            render: () => <HBarChart items={topTags} maxLabelW={100} />,
          },
        ]
      : []),
    ...(stabilityTotal > 0
      ? [
          {
            title: `Stability (${stabilityTotal})`,
            render: () => (
              <SimpleBarChart
                items={stabilityBuckets}
                color={colors.green}
                height={150}
                xLabel="Stability"
              />
            ),
          },
        ]
      : []),
  ];

  const cur = sections[chartIdx];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: `1px solid ${colors.separator}`,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            flex: 1,
            textAlign: 'left',
            background: 'none',
            border: 'none',
            color: colors.accent,
            fontSize: 15,
            padding: 0,
            fontFamily,
            cursor: 'pointer',
          }}
        >
          ‹ Back
        </button>
        <span
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 15,
            fontWeight: 600,
            color: colors.text,
          }}
        >
          Statistics
        </span>
        <span style={{ flex: 1 }} />
      </div>

      <style>{`
        @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0,
          padding: '16px 16px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <StatCard label="Total Problems" value={total} />
          <StatCard label="Due Today" value={dueToday} />
          <StatCard label="Avg Rating" value={avgRating.toFixed(1)} />
          <StatCard label="Streak" value={`${streak}d`} />
        </div>

        {cur && (
          <div
            key={chartIdx}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: 0,
              animation: direction === 'right' ? 'slideInRight 0.2s ease' : 'slideInLeft 0.2s ease',
            }}
          >
            <SectionHeader title={cur.title} />
            <div style={{ display: 'flex', justifyContent: 'center' }}>{cur.render()}</div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 14,
                marginTop: 10,
              }}
            >
              <button
                onClick={() => {
                  setDirection('left');
                  setChartIdx((i) => (i - 1 + sections.length) % sections.length);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.accent,
                  fontSize: 20,
                  padding: '4px 8px',
                  fontFamily,
                }}
              >
                ‹
              </button>
              <button
                onClick={() => {
                  setDirection('right');
                  setChartIdx((i) => (i + 1) % sections.length);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.accent,
                  fontSize: 20,
                  padding: '4px 8px',
                  fontFamily,
                }}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
