"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";

interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app confirmation (the browser's confirm() can't be localized or styled). Render inside <AnimatePresence>. */
export function ConfirmDialog({ title, body, confirmLabel, destructive, onConfirm, onCancel }: Props) {
  const t = useTranslations();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" role="alertdialog" aria-modal="true" aria-label={title}>
      <motion.button type="button" aria-label={t("cancel")} className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} />
      <motion.div
        className="relative w-full max-w-sm rounded-[24px] bg-card p-5 shadow-xl"
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={onCancel} className="min-h-12 rounded-2xl border border-line font-semibold">
            {t("cancel")}
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={onConfirm}
            className={`min-h-12 rounded-2xl font-semibold ${destructive ? "bg-chili text-white" : "bg-brand text-brand-ink"}`}
          >
            {confirmLabel}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
