import type { ComponentPropsWithoutRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIRECTIONAL_ICON_CLASS } from "@/i18n/rtl";

export function DirectionalIcon({
  icon: Icon,
  className,
  ...props
}: {
  icon: LucideIcon;
  className?: string;
} & ComponentPropsWithoutRef<"svg">) {
  return <Icon className={cn("size-4", DIRECTIONAL_ICON_CLASS, className)} aria-hidden {...props} />;
}
