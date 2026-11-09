"use client";

import { useTranslations } from "next-intl";
import { PressLink, Rise, Stagger, press } from "@/components/common/motion";
import { IconTile } from "@/components/common/icons";

export default function NotFound() {
  const t = useTranslations();
  return (
    <Stagger className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <Rise>
        <IconTile icon="notFound" tone="muted" size="xl" />
      </Rise>
      <Rise>
        <h1 className="mt-4 text-xl font-semibold">{t("pageNotFound")}</h1>
      </Rise>
      <Rise>
        <PressLink href="/" {...press} className="mt-5 inline-flex min-h-12 items-center rounded-full bg-brand px-6 font-semibold text-brand-ink shadow-card">
          {t("goHome")}
        </PressLink>
      </Rise>
    </Stagger>
  );
}
