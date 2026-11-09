"use client";

/**
 * Shared motion language (mobile-ui patterns, built on `motion`): springs for physical feedback,
 * short staggered entrances for lists, number count-ups. <MotionConfig reducedMotion="user"> in Providers
 * turns transforms off for people who ask the OS for reduced motion.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { animate, motion, type HTMLMotionProps, type Variants } from "motion/react";

export const SPRING = { type: "spring", stiffness: 380, damping: 30 } as const;
export const SOFT_SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } } };
const rise: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: SPRING } };

/** Parent that staggers its <Rise> children in. */
export function Stagger({ children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={container} initial="hidden" animate="show" {...rest}>
      {children}
    </motion.div>
  );
}

export function StaggerList({ children, ...rest }: HTMLMotionProps<"ul">) {
  return (
    <motion.ul variants={container} initial="hidden" animate="show" {...rest}>
      {children}
    </motion.ul>
  );
}

/** Child of <Stagger>/<StaggerList>: fades and rises into place. */
export function Rise({ children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={rise} {...rest}>
      {children}
    </motion.div>
  );
}

export function RiseItem({ children, ...rest }: HTMLMotionProps<"li">) {
  return (
    <motion.li variants={rise} {...rest}>
      {children}
    </motion.li>
  );
}

/** Route-level enter animation (keyed by pathname in the layout). */
export function PageFade({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

/** next/link with a springy press. */
export const PressLink = motion.create(Link);

export const press = { whileTap: { scale: 0.96 }, transition: SPRING } as const;

/** Counts up/down to `value` (paise by default) whenever it changes. */
export function AnimatedNumber({ value, format, duration = 0.8 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(0);
  const first = useRef(true);
  useEffect(() => {
    const from = first.current ? 0 : prev.current;
    first.current = false;
    prev.current = value;
    const controls = animate(from, value, { duration, ease: "easeOut", onUpdate: (x) => setShown(Math.round(x)) });
    return () => controls.stop();
  }, [value, duration]);
  return <>{format(shown)}</>;
}
