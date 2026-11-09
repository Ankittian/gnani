"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, LayoutGrid, Mic, Package } from "@/components/common/icons";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useVoice } from "@/components/voice/VoiceProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const TABS: { href: string; key: MessageKey; icon: typeof Home; match: (p: string) => boolean }[] = [
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
  const t = useTranslations();
  const voice = useVoice();

  const tab = (tb: (typeof TABS)[number]) => {
    const active = tb.match(pathname);
    const Icon = tb.icon;
    return (
      <Link
        key={tb.href}
        href={tb.href}
        className={`relative flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
          active ? "text-brand-strong" : "text-muted hover:text-ink"
        }`}
        aria-current={active ? "page" : undefined}
      >
        {active && (
          <motion.span layoutId="nav-pill" className="absolute inset-x-3 top-1 -z-0 h-8 rounded-full bg-brand-soft" transition={{ type: "spring", stiffness: 500, damping: 36 }} />
        )}
        <motion.span className="relative z-10" animate={{ y: active ? -1 : 0, scale: active ? 1.08 : 1 }} transition={{ type: "spring", stiffness: 500, damping: 24 }}>
          <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
        </motion.span>
        <span className="relative z-10 leading-none">{t(tb.key)}</span>
      </Link>
    );
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label={t("navAria")}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-center px-2">
        {tab(TABS[0])}
        {tab(TABS[1])}
        <div className="flex justify-center">
          <motion.button
            type="button"
            onClick={() => voice.open()}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.04 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-bg bg-brand text-brand-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            aria-label={t("tapToSpeak")}
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
