'use client';

import { ReactNode, useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

type StatBucket = { label: string; count: number };

type StatsData = {
  displayAverage: number | null;
  displayMedian: number | null;
  buckets: StatBucket[];
  totalParticipants: number;
  about: string;
  title: string;
  unit: string;
  label: string;
  precision: number;
};

type GameStatisticsProps = {
  testSlug: string;
  visible: boolean;
};

function formatDisplay(value: number | null, precision: number, unit: string) {
  if (value === null) return '—';
  return `${value.toFixed(precision)} ${unit}`;
}

function linkify(text: string): ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-600 underline hover:text-cyan-800"
        >
          {part}
        </a>
      );
    }
    // Split by newlines for paragraph breaks
    return <span key={i}>{part}</span>;
  });
}

function formatAboutText(text: string): ReactNode[] {
  // Split on double newlines for paragraph breaks
  const paragraphs = text.split('\n\n');
  return paragraphs.map((para, i) => (
    <p key={i} className="text-sm font-medium leading-6 text-slate-600">
      {linkify(para)}
    </p>
  ));
}

export function GameStatistics({ testSlug, visible }: GameStatisticsProps) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/stats/${encodeURIComponent(testSlug)}`)
      .then((res) => res.json())
      .then((json: StatsData) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load statistics.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [testSlug, visible]);

  if (!visible) return null;

  const chartData = (data?.buckets ?? []).map((b) => ({
    name: b.label,
    count: b.count,
  }));

  return (
    <section className="mt-8 rounded-[2rem] border-2 border-slate-200 bg-white p-5 shadow-[0_6px_0_rgba(226,232,240,1)] sm:p-7">
      {loading && (
        <p className="text-sm font-medium text-slate-500">Loading statistics…</p>
      )}

      {error && (
        <p className="text-sm font-medium text-rose-500">{error}</p>
      )}

      {data && (
        <div className="space-y-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Community Statistics
          </p>
          <h3 className="text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">
            {data.title}
          </h3>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Chart (left side) */}
            <div className="min-h-[200px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      hide={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '1rem',
                        border: '2px solid #e2e8f0',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                      formatter={(value) => [value ?? 0, 'Users']}
                    />
                    <Bar
                      dataKey="count"
                      fill="#06b6d4"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-[200px] items-center justify-center text-sm font-medium text-slate-400">
                  No data yet
                </p>
              )}
            </div>

            {/* Stats & about text (right side) */}
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="rounded-[1.2rem] border-2 border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    {data.label}
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-800">
                    {formatDisplay(data.displayAverage, data.precision, data.unit)}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border-2 border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Median {data.unit}
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-800">
                    {formatDisplay(data.displayMedian, data.precision, data.unit)}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border-2 border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Participants
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-800">
                    {data.totalParticipants}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {formatAboutText(data.about)}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}