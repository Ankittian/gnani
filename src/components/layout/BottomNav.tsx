"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, LayoutGrid, Mic, Package } from "@/components/common/icons";
import { motion } from "motion/react";
import { useShop } from "@/hooks/useShop";
import { useVoice } from "@/components/voice/VoiceProvider";
import type { StringKey } from "@/lib/i18n/strings";

const TABS: { href: string; key: StringKey; icon: typeof Home; match: (p: string) => boolean }[] = [
  { href: "/", key: "navHome", icon: Home, match: (p) => p === "/" },
  { href: "/khata", key: "navKhata", icon: BookOpen, match: (p) => p.startsWith("/khata") },
  { href: "/stock", key: "navStock", icon: Package, match: (p) => p.startsWith("/stock") },
  {
    href: "/more",
    key: "navMore",
    icon: LayoutGrid,
    match: (p) => ["/more", "/orders", "/hisaab", "/settings"].some((x) => p.startsWith(x)),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { tr } = useShop();
  const voice = useVoice();
  const tab = (t: (typeof TABS)[number]) => {
    const active = t.match(pathname);
    const Icon = t.icon;
    return (
      <Link
        key={t.href}
        href={t.href}
        className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-full text-[11px] font-medium transition-colors ${
          active ? "text-ink" : "text-muted"
        }`}
        aria-current={active ? "page" : undefined}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
        <span className="leading-none">{tr(t.key)}</span>
        {active && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand" />}
      </Link>
    );
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-4"
      style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}
      aria-label="Main"
    >
      <div className="flex items-center gap-3">
        <div className="glass flex flex-1 items-center rounded-full border border-line px-2 py-1 shadow-card">{TABS.map(tab)}</div>
        <motion.button
          type="button"
          onClick={() => voice.open()}
          whileTap={{ scale: 0.94 }}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink shadow-[0_10px_30px_-6px_var(--glow),inset_0_1px_0_rgb(255_255_255/0.25)] focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
          aria-label={tr("tapToSpeak")}
        >
          <Mic className="h-7 w-7" strokeWidth={2.2} />
        </motion.button>
      </div>
    </nav>
  );
}
