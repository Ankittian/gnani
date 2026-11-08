"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, IconTile, type IconKey, type Tone } from "@/components/common/icons";
import { formatINR } from "@/lib/domain/money";

export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: string | null; back?: string; right?: ReactNode }) {
  return (
    <header className="flex items-center gap-2 px-4 pb-2 pt-5">
      {back && (
        <Link href={back} aria-label="Back" className="-ml-1 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card transition-colors hover:bg-brand-soft">
          <ChevronLeft className="h-5 w-5" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

const AVATAR_COLORS = ["#3b6cff", "#7c5cff", "#0ea5c6", "#10a37f", "#e08a1e", "#d6489b", "#e5603a", "#5b6ee1"];

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  const color = AVATAR_COLORS[h % AVATAR_COLORS.length];
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.45 }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function BalancePill({ balance, size = "md" }: { balance: number; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "px-4 py-1.5 text-2xl" : "px-3 py-1 text-base";
  if (balance > 0) return <span className={`tabular rounded-full bg-chili-soft font-semibold text-chili ${cls}`}>{formatINR(balance)}</span>;
  if (balance < 0)
    return <span className={`tabular rounded-full bg-leaf-soft font-semibold text-leaf ${cls}`}>+{formatINR(-balance)}</span>;
  return <span className={`rounded-full bg-leaf-soft font-semibold text-leaf ${cls}`}>✓ 0</span>;
}

export function StatChip({ icon, label, value, tone }: { icon: IconKey; label: string; value: string; tone: Exclude<Tone, "muted"> }) {
  const toneCls = { leaf: "text-leaf", chili: "text-chili", brand: "text-brand-strong", indigo: "text-indigo" }[tone];
  return (
    <div className="rounded-card border border-line bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs text-muted">
        <IconTile icon={icon} tone={tone} size="sm" />
        <span className="truncate">{label}</span>
      </div>
      <div className={`tabular mt-3 text-[22px] font-semibold tracking-tight ${toneCls}`}>{value}</div>
    </div>
  );
}

export function ModuleTile({ href, icon, tone = "brand", label, sub, badge }: { href: string; icon: IconKey; tone?: Tone; label: string; sub?: string | null; badge?: number }) {
  return (
    <Link
      href={href}
      className="relative flex min-h-28 flex-col justify-between gap-4 rounded-card border border-line bg-card p-4 shadow-card transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo/40"
    >
      <IconTile icon={icon} tone={tone} size="lg" />
      <span>
        <span className="block text-base font-semibold leading-tight">{label}</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
      {badge ? (
        <span className="absolute right-4 top-4 min-w-6 rounded-full bg-chili px-1.5 py-0.5 text-center text-xs font-semibold text-white">{badge}</span>
      ) : null}
    </Link>
  );
}

export function EmptyState({ icon, tone = "brand", title, hint, action }: { icon: IconKey; tone?: Tone; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mx-4 mt-6 flex flex-col items-center rounded-card border border-dashed border-line bg-card/60 px-6 py-10 text-center">
      <IconTile icon={icon} tone={tone} size="xl" />
      <p className="mt-4 text-base font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-card p-4 shadow-card ${className}`}>{children}</div>;
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "abhi";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} ghante`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "kal" : `${d} din`;
}
