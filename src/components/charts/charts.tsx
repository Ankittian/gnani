"use client";

/**
 * Chart primitives (Recharts). Colors come from theme tokens so dark/light just work.
 * All money inputs are paise; tooltips format with formatINR.
 */
import { useId, useMemo } from "react";
import { useLocale } from "next-intl";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/lib/domain/money";

const INK_MUTED = "var(--muted)";
const GRID = "var(--line)";

/** Axis/tooltip day labels in the active language ("Mon" / "सोम" / "திங்.") — never a hardcoded locale. */
function useDayFormats() {
  const locale = useLocale();
  return useMemo(
    () => ({
      dayShort: (iso: string) => new Date(iso + "T00:00").toLocaleDateString(locale, { weekday: "short" }),
      dayLong: (iso: string) => new Date(iso + "T00:00").toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" }),
    }),
    [locale],
  );
}

/** ₹1.2k style axis ticks (paise in). */
const compact = (paise: number) => {
  const r = paise / 100;
  if (r >= 100000) return `₹${+(r / 100000).toFixed(1)}L`;
  if (r >= 1000) return `₹${+(r / 1000).toFixed(1)}k`;
  return `₹${Math.round(r)}`;
};

interface TipRow {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

function Tip({ active, payload, label, title }: { active?: boolean; payload?: TipRow[]; label?: string | number; title?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-card px-3 py-2 text-xs shadow-card">
      {label !== undefined && <p className="mb-1 text-muted">{title ? title(String(label)) : String(label)}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 font-medium text-ink">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name && <span className="text-muted">{p.name}</span>}
          <span className="tabular ml-auto pl-3">{formatINR(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

/** Tiny trend line for the hero card (sits on the hero surface, so it inherits the hero ink colour). */
export function Sparkline({ data, label, name }: { data: { date: string; amount: number }[]; label: string; name: string }) {
  const id = useId();
  const { dayLong } = useDayFormats();
  return (
    <div className="h-14 w-full text-hero-ink" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.3} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip cursor={{ stroke: "currentColor", strokeOpacity: 0.4 }} content={<Tip title={dayLong} />} />
          <Area type="monotone" dataKey="amount" name={name} stroke="currentColor" strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4, fill: "currentColor", stroke: "var(--hero)", strokeWidth: 2 }} />
          <XAxis dataKey="date" hide />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Grouped bars: two measures per day. */
export function CompareBars({
  data,
  a,
  b,
  label,
}: {
  data: { date: string }[];
  a: { key: string; name: string; color: string };
  b: { key: string; name: string; color: string };
  label: string;
}) {
  const { dayShort, dayLong } = useDayFormats();
  return (
    <div className="h-52 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 4" />
          <XAxis dataKey="date" tickFormatter={dayShort} tickLine={false} axisLine={false} tick={{ fill: INK_MUTED, fontSize: 11 }} />
          <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} tick={{ fill: INK_MUTED, fontSize: 11 }} tickCount={4} />
          <Tooltip cursor={{ fill: "var(--line)", fillOpacity: 0.5, radius: 8 }} content={<Tip title={dayLong} />} />
          <Bar dataKey={a.key} name={a.name} fill={a.color} radius={[4, 4, 0, 0]} maxBarSize={14} />
          <Bar dataKey={b.key} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-series area/line trend. */
export function TrendArea({ data, name, color, label }: { data: { date: string; amount: number }[]; name: string; color: string; label: string }) {
  const id = useId();
  const { dayShort, dayLong } = useDayFormats();
  return (
    <div className="h-44 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 4" />
          <XAxis dataKey="date" tickFormatter={dayShort} tickLine={false} axisLine={false} tick={{ fill: INK_MUTED, fontSize: 11 }} />
          <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} tick={{ fill: INK_MUTED, fontSize: 11 }} tickCount={4} />
          <Tooltip cursor={{ stroke: color, strokeOpacity: 0.4 }} content={<Tip title={dayLong} />} />
          <Area type="monotone" dataKey="amount" name={name} stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 5, fill: color, stroke: "var(--card)", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface Slice {
  name: string;
  value: number;
  color: string;
}

/** Donut with a centered total; legend (with values) is rendered beside it so color is never the only cue. */
export function Donut({ slices, centerLabel, centerValue, label }: { slices: Slice[]; centerLabel: string; centerValue: string; label: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const data = total > 0 ? slices : [{ name: "—", value: 1, color: "var(--line)" }];
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-36 w-36 shrink-0" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={46} outerRadius={66} paddingAngle={total > 0 ? 3 : 0} cornerRadius={6} stroke="none" startAngle={90} endAngle={-270}>
              {data.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            {total > 0 && <Tooltip content={<Tip />} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-muted">{centerLabel}</span>
          <span className="tabular text-base font-semibold tracking-tight">{centerValue}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-muted">{s.name}</span>
            <span className="tabular font-semibold">{formatINR(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
