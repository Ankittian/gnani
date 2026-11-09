"use client";

import { ModuleTile, PageHeader } from "@/components/common/ui";
import { useShop } from "@/hooks/useShop";

export default function MorePage() {
  const { tr } = useShop();
  return (
    <div>
      <PageHeader title={tr("navMore")} />
      <div className="grid grid-cols-2 gap-3 px-4">
        <ModuleTile href="/orders" icon="orders" tone="saffron" label={tr("modOrders")} />
        <ModuleTile href="/hisaab" icon="hisaab" tone="leaf" label={tr("modHisaab")} />
        <ModuleTile href="/settings" icon="settings" tone="muted" label={tr("settings")} />
      </div>
    </div>
  );
}
