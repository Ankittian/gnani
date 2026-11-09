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
        className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
          active ? "text-brand-strong" : "text-muted hover:text-ink"
        }`}
        aria-current={active ? "page" : undefined}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
        <span className="leading-none">{tr(t.key)}</span>
      </Link>
    );
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-center px-2">
        {tab(TABS[0])}
        {tab(TABS[1])}
        <div className="flex justify-center">
          <motion.button
            type="button"
            onClick={() => voice.open()}
            whileTap={{ scale: 0.94 }}
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-bg bg-brand text-brand-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            aria-label={tr("tapToSpeak")}
          >
            <Mic className="h-6 w-6" strokeWidth={2.2} />
          </motion.button>
        </div>
        {tab(TABS[2])}
        {tab(TABS[3])}
      </div>
    </nav>
  );
}
