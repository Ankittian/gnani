"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconTile, type IconKey, type Tone } from "@/components/common/icons";
import { useTimeAgo, useUnit } from "@/components/common/ui";
import { STATUS_STYLE } from "@/components/orders/status";
import type { TimelineEvent, TimelineKind } from "@/lib/domain/memory";
import { formatINR } from "@/lib/domain/money";
import type { MessageKey } from "@/lib/i18n/messages";
import type { LineItem, StockSource } from "@/lib/types";

const KIND: Record<TimelineKind, { icon: IconKey; tone: Tone }> = {
  credit: { icon: "credit", tone: "chili" },
  payment: { icon: "collected", tone: "leaf" },
  sale: { icon: "sales", tone: "leaf" },
  stock: { icon: "stock", tone: "sky" },
  order: { icon: "orders", tone: "saffron" },
};

export const SOURCE_KEY: Record<StockSource, MessageKey> = {
  ledger: "srcLedger",
  sale: "srcSale",
  order: "srcOrder",
  voice: "srcVoice",
  manual: "srcManual",
  import: "srcImport",
};

export function useItemsLine() {
  const unitLabel = useUnit();
  return (items: Pick<LineItem, "name" | "qty" | "unit">[]) =>
    items.map((i) => `${i.qty ?? ""} ${unitLabel(i.unit)} ${i.name}`.replace(/\s+/g, " ").trim()).join(", ");
}

/** One remembered event — every row links to the customer / item / order it is about. */
export function TimelineRow({ e }: { e: TimelineEvent }) {
  const t = useTranslations();
  const timeAgo = useTimeAgo();
  const itemsLine = useItemsLine();
  const k = KIND[e.kind];

  const title =
    e.kind === "credit"
      ? `${e.subject} · ${t("ledgerCredit")}`
      : e.kind === "payment"
        ? `${e.subject} · ${t("ledgerPayment")}`
        : e.kind === "sale"
          ? t("cashSale")
          : e.kind === "order"
            ? `${e.subject || t("customerOrder")} · ${t(STATUS_STYLE[e.status ?? "new"].labelKey)}`
            : `${e.subject} · ${e.delta != null && e.delta > 0 ? "+" : ""}${e.delta ?? ""}`;
  const detail = e.kind === "stock" ? t(SOURCE_KEY[e.source ?? "manual"]) : itemsLine(e.items);

  const body = (
    <>
      {e.emoji ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-line/70 text-2xl" aria-hidden>
          {e.emoji}
        </span>
      ) : (
        <IconTile icon={k.icon} tone={k.tone} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{title}</p>
        <p className="truncate text-xs text-muted">
          {timeAgo(e.at)}
          {detail ? ` · ${detail}` : ""}
        </p>
      </div>
      {e.amount != null && <span className={`tabular shrink-0 font-semibold ${e.kind === "credit" ? "text-chili" : "text-leaf"}`}>{formatINR(e.amount)}</span>}
    </>
  );

  return (
    <li>
      {e.href ? (
        <Link href={e.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">{body}</div>
      )}
    </li>
  );
}
