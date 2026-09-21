"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

export interface RatingProps {
  value?: number;
  onValueChange?: (value: number) => void;
  max?: number;
  label?: string;
  readOnly?: boolean;
  className?: string;
}

function isRtl(node: HTMLElement | null) {
  if (!node || typeof document === "undefined") {
    return false;
  }
  const closest = node.closest("[dir]");
  const dir = closest?.getAttribute("dir") || document.documentElement.dir;
  return dir === "rtl";
}

function Rating({ value = 0, onValueChange, max = 5, label = "Rating", readOnly = false, className }: RatingProps) {
  const groupId = React.useId();
  const groupRef = React.useRef<HTMLDivElement>(null);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (readOnly) {
      return;
    }
    const rtl = isRtl(groupRef.current);
    const nextKeys = rtl ? ["ArrowLeft", "ArrowUp"] : ["ArrowRight", "ArrowUp"];
    const prevKeys = rtl ? ["ArrowRight", "ArrowDown"] : ["ArrowLeft", "ArrowDown"];
    if (nextKeys.includes(event.key)) {
      event.preventDefault();
      onValueChange?.(Math.min(max, Math.max(1, value) + 1));
    }
    if (prevKeys.includes(event.key)) {
      event.preventDefault();
      onValueChange?.(Math.max(1, value - 1));
    }
    if (event.key === "Home") {
      event.preventDefault();
      onValueChange?.(1);
    }
    if (event.key === "End") {
      event.preventDefault();
      onValueChange?.(max);
    }
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-label font-medium text-text" id={groupId}>
        {label}
      </span>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby={groupId}
        aria-readonly={readOnly || undefined}
        className="inline-flex items-center gap-1"
        onKeyDown={onKeyDown}
      >
        {Array.from({ length: max }, (_, index) => {
          const star = index + 1;
          const filled = star <= value;
          const tabbable = !readOnly && star === (value || 1);
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={star === value}
              disabled={readOnly}
              tabIndex={tabbable ? 0 : -1}
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-control",
                !readOnly && "hover:bg-surface-sunken",
                focusRing,
              )}
              onClick={() => onValueChange?.(star)}
            >
              <Star className={cn("size-5", filled ? "fill-accent text-accent" : "text-border")} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { Rating };
