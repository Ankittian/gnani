"use client";

import { useEffect, type ReactNode } from "react";
import { motion, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";

interface Props {
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** false while work is in flight: no backdrop-tap, Esc or swipe dismissal. */
  dismissible?: boolean;
}

/**
 * Modal bottom sheet: springs up, swipe the handle down to dismiss, backdrop fades.
 * Render inside <AnimatePresence> in the parent so the exit animation can play.
 */
export function BottomSheet({ label, onClose, children, dismissible = true }: Props) {
  const t = useTranslations();
  const controls = useDragControls();

  useEffect(() => {
    if (!dismissible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissible, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={label}>
      <motion.button
        type="button"
        aria-label={t("close")}
        className="absolute inset-0 bg-black/45"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={dismissible ? onClose : undefined}
      />
      <motion.div
        className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-[28px] bg-bg px-4 pb-8"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        drag={dismissible ? "y" : false}
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 600) onClose();
        }}
      >
        <div className="flex h-8 cursor-grab touch-none items-center justify-center" onPointerDown={(e) => dismissible && controls.start(e)} aria-hidden>
          <div className="h-1.5 w-12 rounded-full bg-line" />
        </div>
        {children}
      </motion.div>
    </div>
  );
}
