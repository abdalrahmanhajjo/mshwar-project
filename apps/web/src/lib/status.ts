export type StatusTone = "secondary" | "success" | "danger" | "warning" | "outline";

/** Shared badge tone for booking lifecycle states across traveller, business and admin views. */
export const BOOKING_STATUS_VARIANT: Record<string, StatusTone> = {
  pending: "warning",
  held: "warning",
  requested: "warning",
  confirmed: "success",
  paid: "success",
  cancelled: "outline",
  rejected: "danger",
  expired: "secondary",
  completed: "secondary",
};

export function statusTone(status: string | null | undefined): StatusTone {
  if (!status) {
    return "secondary";
  }
  const key = status.toLowerCase();
  if (key in BOOKING_STATUS_VARIANT) {
    return BOOKING_STATUS_VARIANT[key];
  }
  if (["verified", "published", "active", "open", "healthy", "delivered", "sent", "ok"].includes(key)) {
    return "success";
  }
  if (["pending", "paused", "draft", "queued", "review", "in_review", "retrying", "warning"].includes(key)) {
    return "warning";
  }
  if (["rejected", "suspended", "failed", "error", "blocked", "removed", "hidden"].includes(key)) {
    return "danger";
  }
  return "secondary";
}
