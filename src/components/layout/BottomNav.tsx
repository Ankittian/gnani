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
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const tab = (t: (typeof TABS)[number]) => {
    const active = t.match(pathname);
    const Icon = t.icon;
    return (
      <Link
        key={t.href}
        href={t.href}
        className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold transition-colors ${
          active ? "text-brand-strong" : "text-muted"
        }`}
        aria-current={active ? "page" : undefined}
      >
        <Icon className="h-6 w-6" strokeWidth={active ? 2.6 : 2} />
        <span className="leading-tight">{tr(t.key)}</span>
      </Link>
    );
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-3"
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
      aria-label="Main"
    >
      <div className="relative flex items-center rounded-[28px] border border-line bg-card/95 px-2 py-1.5 shadow-sticker backdrop-blur">
        {left.map(tab)}
        <div className="w-24 shrink-0" />
        {right.map(tab)}
        <motion.button
          type="button"
          onClick={() => voice.open()}
          whileTap={{ scale: 0.92 }}
          className="absolute left-1/2 top-0 flex h-20 w-20 -translate-x-1/2 -translate-y-7 items-center justify-center rounded-full border-4 border-bg bg-brand text-brand-ink shadow-sticker focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo/50"
          aria-label={tr("tapToSpeak")}
        >
          <Mic className="h-9 w-9" strokeWidth={2.4} />
        </motion.button>
      </div>
    </nav>
  );
}
