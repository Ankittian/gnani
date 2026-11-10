"use client";

/**
 * The single place that knows which icon library the app uses (Hugeicons).
 * Components import named icons from here; swapping the set means editing this file only.
 */
import type { ComponentProps } from "react";
import {
  Add01Icon,
  AiBrain01Icon,
  Clock01Icon,
  Download01Icon,
  Upload01Icon,
  Alert02Icon,
  Analytics01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  AudioWave01Icon,
  Book02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Coins01Icon,
  Delete02Icon,
  DeliveryTruck01Icon,
  GridViewIcon,
  Home01Icon,
  Invoice01Icon,
  KeyboardIcon,
  Loading03Icon,
  Mic01Icon,
  MinusSignIcon,
  Money03Icon,
  Notification03Icon,
  PackageIcon,
  PartyIcon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  RotateLeft01Icon,
  Search01Icon,
  SentIcon,
  Settings02Icon,
  Share08Icon,
  ShoppingCart01Icon,
  StopIcon,
  Tick02Icon,
  Undo02Icon,
  UserAdd01Icon,
  UserSearch01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

type IconProps = Omit<ComponentProps<typeof HugeiconsIcon>, "icon" | "size">;

function make(icon: IconSvgElement) {
  // Call sites pass lucide-style weights (2–2.6); Hugeicons strokes read heavier, so scale down.
  return function Icon({ strokeWidth, ...rest }: IconProps) {
    return <HugeiconsIcon icon={icon} size={24} strokeWidth={strokeWidth ? strokeWidth * 0.72 : 1.6} {...rest} />;
  };
}

export const ArrowRight = make(ArrowRight01Icon);
export const Bell = make(Notification03Icon);
export const BookOpen = make(Book02Icon);
export const Check = make(Tick02Icon);
export const ChevronLeft = make(ArrowLeft01Icon);
export const FileAudio = make(AudioWave01Icon);
export const HandCoins = make(Coins01Icon);
export const Home = make(Home01Icon);
export const Keyboard = make(KeyboardIcon);
export const LayoutGrid = make(GridViewIcon);
export const Loader2 = make(Loading03Icon);
export const Mic = make(Mic01Icon);
export const Minus = make(MinusSignIcon);
export const Package = make(PackageIcon);
export const Pause = make(PauseIcon);
export const Play = make(PlayIcon);
export const Plus = make(Add01Icon);
export const RefreshCw = make(RefreshIcon);
export const RotateCcw = make(RotateLeft01Icon);
export const Search = make(Search01Icon);
export const Send = make(SentIcon);
export const Settings = make(Settings02Icon);
export const Share2 = make(Share08Icon);
export const ShoppingCart = make(ShoppingCart01Icon);
export const Square = make(StopIcon);
export const Trash2 = make(Delete02Icon);
export const Undo2 = make(Undo02Icon);
export const UserPlus = make(UserAdd01Icon);
export const X = make(Cancel01Icon);
export const Upload = make(Upload01Icon);
export const Download = make(Download01Icon);
export const Brain = make(AiBrain01Icon);
export const Clock = make(Clock01Icon);

/* ── Semantic icons (replace emoji) ─────────────────────────────── */
const SEMANTIC = {
  khata: Book02Icon,
  stock: PackageIcon,
  orders: DeliveryTruck01Icon,
  hisaab: Analytics01Icon,
  settings: Settings02Icon,
  sales: Invoice01Icon,
  credit: Book02Icon,
  collected: Money03Icon,
  lowStock: Alert02Icon,
  delivered: CheckmarkCircle02Icon,
  celebrate: PartyIcon,
  notFound: UserSearch01Icon,
  memory: AiBrain01Icon,
  upload: Upload01Icon,
} as const;

export type IconKey = keyof typeof SEMANTIC;
export type Tone = "leaf" | "chili" | "brand" | "saffron" | "sky" | "muted";

const TONE: Record<Tone, string> = {
  leaf: "bg-leaf-soft text-leaf",
  chili: "bg-chili-soft text-chili",
  brand: "bg-brand-soft text-brand-strong",
  saffron: "bg-saffron-soft text-saffron",
  sky: "bg-sky-soft text-sky",
  muted: "bg-line/70 text-muted",
};

const SIZE = { sm: ["h-9 w-9 rounded-xl", 20], md: ["h-11 w-11 rounded-[14px]", 22], lg: ["h-12 w-12 rounded-2xl", 26], xl: ["h-20 w-20 rounded-3xl", 40] } as const;

export function IconTile({ icon, tone = "brand", size = "md", className = "" }: { icon: IconKey; tone?: Tone; size?: keyof typeof SIZE; className?: string }) {
  const [box, px] = SIZE[size];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center ${box} ${TONE[tone]} ${className}`}
    >
      <HugeiconsIcon icon={SEMANTIC[icon]} size={px} strokeWidth={1.5} />
    </span>
  );
}
