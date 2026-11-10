"use client";

import { useTranslations } from "next-intl";
import { Rise, Stagger } from "@/components/common/motion";
import { ModuleTile, PageHeader } from "@/components/common/ui";

export default function MorePage() {
  const t = useTranslations();
  return (
    <Stagger>
      <Rise>
        <PageHeader title={t("navMore")} />
      </Rise>
      <Rise className="grid grid-cols-2 gap-3 px-4">
        <ModuleTile href="/memory" icon="memory" tone="brand" label={t("memoryPage")} />
        <ModuleTile href="/orders" icon="orders" tone="saffron" label={t("modOrders")} />
        <ModuleTile href="/hisaab" icon="hisaab" tone="leaf" label={t("modHisaab")} />
        <ModuleTile href="/settings" icon="settings" tone="muted" label={t("settings")} />
      </Rise>
    </Stagger>
  );
}
