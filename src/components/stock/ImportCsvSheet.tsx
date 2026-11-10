"use client";

import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BottomSheet } from "@/components/common/BottomSheet";
import { Download, Loader2, Package, Upload } from "@/components/common/icons";
import { press } from "@/components/common/motion";
import { useUnit } from "@/components/common/ui";
import { importStockCsv } from "@/lib/db/repo";
import { getDb } from "@/lib/db/schema";
import { parseStockCsv, planStockImport, SAMPLE_STOCK_CSV, type StockCsvError } from "@/lib/domain/csv";
import { formatINR } from "@/lib/domain/money";
import { playTing } from "@/lib/feedback";

const MAX_BYTES = 1_000_000;

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  // BOM so Excel opens Indic scripts correctly.
  const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ImportCsvSheet({ onClose, soundsOn }: { onClose: () => void; soundsOn: boolean }) {
  const t = useTranslations();
  const unitLabel = useUnit();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const products = useLiveQuery(() => getDb().products.toArray(), []);

  const parsed = useMemo(() => (text == null ? null : parseStockCsv(text)), [text]);
  const plan = useMemo(() => (parsed && products ? planStockImport(parsed.rows, products) : []), [parsed, products]);
  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const created = plan.filter((p) => !p.productId).length;
  const updated = plan.length - created;

  const errText = (e: StockCsvError) =>
    e.code === "noNameColumn"
      ? t("csvErrNoName")
      : e.code === "missingName"
        ? t("csvErrMissingName", { line: e.line })
        : e.code === "badUnit"
          ? t("csvErrBadUnit", { line: e.line })
          : t("csvErrBadNumber", { line: e.line, field: e.field ?? "" });

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error(t("csvFailed"));
      return;
    }
    try {
      setText(await f.text());
      setFileName(f.name);
    } catch {
      toast.error(t("csvFailed"));
    }
  };

  const doImport = async () => {
    if (!text) return;
    setBusy(true);
    try {
      const r = await importStockCsv(getDb(), text);
      playTing(soundsOn);
      toast.success(t("csvImported", { created: r.created, updated: r.updated }));
      onClose();
    } catch {
      toast.error(t("csvFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet label={t("csvTitle")} onClose={onClose} dismissible={!busy}>
      <div className="pb-2">
        <h2 className="text-xl font-semibold tracking-tight">{t("csvTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("csvHelp")}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <motion.button
            type="button"
            {...press}
            onClick={() => downloadText("dukaan-dost-stock-sample.csv", SAMPLE_STOCK_CSV)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-card px-3 text-sm font-semibold"
          >
            <Download className="h-4 w-4" /> {t("csvDownloadSample")}
          </motion.button>
          <motion.button
            type="button"
            {...press}
            data-testid="csv-try-sample"
            onClick={() => {
              setText(SAMPLE_STOCK_CSV);
              setFileName("stock-sample.csv");
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-brand bg-brand-soft px-3 text-sm font-semibold text-brand-ink"
          >
            <Package className="h-4 w-4" /> {t("csvTrySample")}
          </motion.button>
        </div>

        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <motion.button
          type="button"
          {...press}
          onClick={() => fileRef.current?.click()}
          className="mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-bg text-base font-semibold"
        >
          <Upload className="h-5 w-5" /> {fileName ?? t("csvChooseFile")}
        </motion.button>

        {parsed && (
          <div className="mt-4">
            <p className="text-sm font-semibold">
              {t("csvSummary", { created, updated })}
              {parsed.errors.length > 0 && <span className="text-chili"> · {t("csvSkipped", { n: parsed.errors.length })}</span>}
            </p>
            {parsed.errors.length > 0 && (
              <ul className="mt-2 space-y-1 rounded-2xl bg-chili-soft px-3 py-2 text-xs font-semibold text-chili">
                {parsed.errors.slice(0, 5).map((e) => (
                  <li key={`${e.line}-${e.code}`}>{errText(e)}</li>
                ))}
              </ul>
            )}
            <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-2xl border border-line bg-card">
              {plan.map(({ row, productId }) => {
                const existing = productId ? byId.get(productId) : undefined;
                return (
                  <li key={row.line} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-xl" aria-hidden>
                      {row.emoji ?? existing?.emoji ?? "📦"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{existing?.name ?? row.name}</p>
                      <p className="truncate text-xs text-muted">
                        {existing && row.stockQty != null && row.stockQty !== existing.stockQty ? `${existing.stockQty} → ` : ""}
                        {row.stockQty ?? existing?.stockQty ?? 0} {unitLabel(existing?.unit ?? row.unit)}
                        {row.pricePaise != null ? ` · ${formatINR(row.pricePaise)}` : ""}
                        {row.supplierName ? ` · ${row.supplierName}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${existing ? "bg-sky-soft text-sky" : "bg-leaf-soft text-leaf"}`}>
                      {existing ? t("csvUpdate") : t("csvNew")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <motion.button
          type="button"
          {...press}
          disabled={busy || plan.length === 0}
          onClick={() => void doImport()}
          data-testid="csv-import"
          className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-leaf text-lg font-semibold text-white shadow-card disabled:opacity-50"
        >
          {busy && <Loader2 className="h-5 w-5 animate-spin" />}
          {t("csvImportN", { n: plan.length })}
        </motion.button>
      </div>
    </BottomSheet>
  );
}
