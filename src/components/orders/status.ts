import type { MessageKey } from "@/lib/i18n/messages";
import type { OrderStatus } from "@/lib/types";

export const STATUS_STYLE: Record<OrderStatus, { labelKey: MessageKey; cls: string }> = {
  new: { labelKey: "statusNew", cls: "bg-chili-soft text-chili" },
  packed: { labelKey: "packed", cls: "bg-brand-soft text-brand-ink" },
  delivered: { labelKey: "delivered", cls: "bg-leaf-soft text-leaf" },
};
