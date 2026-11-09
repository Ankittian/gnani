"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { PageFade } from "@/components/common/motion";
import { LocaleProvider } from "@/components/layout/LocaleProvider";
import { BottomNav } from "@/components/layout/BottomNav";
import { VoiceProvider } from "@/components/voice/VoiceProvider";
import { Splash } from "@/components/common/Splash";
import { useShop } from "@/hooks/useShop";

function ShopGate({ children }: { children: ReactNode }) {
  const { shop, loading } = useShop();
  const pathname = usePathname();
  const router = useRouter();
  const onboarding = pathname.startsWith("/onboarding");
  const [splashDone, setSplashDone] = useState(false);

  // Brand splash with usage tips: once per browser session, long enough to read one tip.
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("dd-splash") === "1";
    } catch {}
    const t = setTimeout(
      () => {
        try {
          sessionStorage.setItem("dd-splash", "1");
        } catch {}
        setSplashDone(true);
      },
      seen ? 0 : 1800,
    );
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && shop === null && !onboarding) router.replace("/onboarding");
  }, [loading, shop, onboarding, router]);

  if (!splashDone || loading || (shop === null && !onboarding)) {
    return <Splash />;
  }

  return (
    <>
      <main className={`mx-auto w-full max-w-lg ${onboarding ? "" : "pb-nav"}`}>
        <PageFade key={pathname}>{children}</PageFade>
      </main>
      {!onboarding && <BottomNav />}
    </>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LocaleProvider>
        <VoiceProvider>
          <ShopGate>{children}</ShopGate>
          <Toaster
            position="top-center"
            toastOptions={{ style: { background: "var(--card)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 14 } }}
          />
        </VoiceProvider>
      </LocaleProvider>
    </MotionConfig>
  );
}
