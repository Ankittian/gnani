"use client";

import { motion } from "motion/react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "happy" | "sad";

interface DostOrbProps {
  state: OrbState;
  /** 0..1 live audio level (mic RMS while listening, output level while speaking). */
  level?: number;
  size?: number;
  className?: string;
}

/** The "Dost" — a marigold character that shows what the assistant is doing. */
export function DostOrb({ state, level = 0, size = 120, className = "" }: DostOrbProps) {
  const lvl = Math.max(0, Math.min(1, level));
  const mouthOpen = state === "speaking" ? 3 + lvl * 14 : state === "happy" ? 8 : 3;
  const eyeY = state === "sad" ? 2 : 0;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      data-state={state}
      role="img"
      aria-label={`Dukaan Dost is ${state}`}
    >
      {state === "listening" && (
        <>
          <span className="animate-ring absolute inset-0 rounded-full bg-brand/40" />
          <span className="animate-ring absolute inset-0 rounded-full bg-brand/30 [animation-delay:0.5s]" />
          <motion.span
            className="absolute inset-0 rounded-full bg-brand/25"
            animate={{ scale: 1 + lvl * 0.45 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
          />
        </>
      )}

      <motion.div
        className={`relative overflow-hidden rounded-full shadow-sticker ${state === "idle" ? "animate-breathe" : ""}`}
        style={{
          width: size * 0.82,
          height: size * 0.82,
          background: "radial-gradient(circle at 35% 30%, #fde68a 0%, #fbbf24 38%, #f59e0b 70%, #d97706 100%)",
        }}
        animate={
          state === "happy"
            ? { y: [0, -14, 0, -7, 0], rotate: [0, -4, 4, 0] }
            : state === "sad"
              ? { y: 4, rotate: 0 }
              : { y: 0, rotate: 0 }
        }
        transition={{ duration: state === "happy" ? 0.8 : 0.3 }}
      >
        {state === "thinking" && (
          <span className="animate-shimmer absolute -inset-y-4 left-0 w-1/3 bg-white/40 blur-md" />
        )}

        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          {/* cheeks */}
          <circle cx="27" cy="60" r="7" fill="#fb7185" opacity="0.35" />
          <circle cx="73" cy="60" r="7" fill="#fb7185" opacity="0.35" />
          {/* eyes */}
          <g className={state === "idle" || state === "listening" ? "animate-blink" : ""} style={{ transformBox: "fill-box" }}>
            {state === "happy" ? (
              <>
                <path d="M30 46 q6 -7 12 0" stroke="#7c2d12" strokeWidth="4" fill="none" strokeLinecap="round" />
                <path d="M58 46 q6 -7 12 0" stroke="#7c2d12" strokeWidth="4" fill="none" strokeLinecap="round" />
              </>
            ) : (
              <>
                <ellipse cx="36" cy={45 + eyeY} rx="5" ry={state === "thinking" ? 3 : 6} fill="#7c2d12" />
                <ellipse cx="64" cy={45 + eyeY} rx="5" ry={state === "thinking" ? 3 : 6} fill="#7c2d12" />
                <circle cx="38" cy={43 + eyeY} r="1.6" fill="#fff" />
                <circle cx="66" cy={43 + eyeY} r="1.6" fill="#fff" />
              </>
            )}
          </g>
          {/* mouth */}
          {state === "sad" ? (
            <path d="M40 70 q10 -8 20 0" stroke="#7c2d12" strokeWidth="4" fill="none" strokeLinecap="round" />
          ) : state === "speaking" || state === "happy" ? (
            <ellipse cx="50" cy="66" rx="9" ry={mouthOpen / 2 + 2} fill="#7c2d12" />
          ) : (
            <path d="M40 64 q10 9 20 0" stroke="#7c2d12" strokeWidth="4" fill="none" strokeLinecap="round" />
          )}
        </svg>
      </motion.div>

      {state === "thinking" && (
        <div className="absolute -bottom-1 flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="animate-dot h-2 w-2 rounded-full bg-brand-strong" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      )}

      {state === "happy" && (
        <span className="absolute -right-1 top-0 text-2xl" aria-hidden>
          ✨
        </span>
      )}
    </div>
  );
}
