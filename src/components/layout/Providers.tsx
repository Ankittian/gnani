"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { BottomNav } from "@/components/layout/BottomNav";
import { VoiceProvider } from "@/components/voice/VoiceProvider";
import { DostOrb } from "@/components/orb/DostOrb";
import { useShop } from "@/hooks/useShop";

function ShopGate({ children }: { children: ReactNode }) {
  const { shop, loading } = useShop();
  const pathname = usePathname();
  const router = useRouter();
  const onboarding = pathname.startsWith("/onboarding");

  useEffect(() => {
    if (!loading && shop === null && !onboarding) router.replace("/onboarding");
  }, [loading, shop, onboarding, router]);

  useEffect(() => {
    if (shop?.language) document.documentElement.lang = shop.language.split("-")[0];
  }, [shop?.language]);

  if (loading || (shop === null && !onboarding)) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <DostOrb state="idle" size={110} />
      </div>
    );
  }

  return (
    <>
      <main className={`mx-auto w-full max-w-lg ${onboarding ? "" : "pb-nav"}`}>{children}</main>
      {!onboarding && <BottomNav />}
    </>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <VoiceProvider>
      <ShopGate>{children}</ShopGate>
      <Toaster position="top-center" richColors closeButton />
    </VoiceProvider>
  );
}
