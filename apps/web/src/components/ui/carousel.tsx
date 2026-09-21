"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DirectionalIcon } from "@/components/ui/directional-icon";
import { isRtlDocument } from "@/i18n/rtl";
import { cn } from "@/lib/utils";

export function Carousel({
  children,
  label,
  previousLabel = "Previous",
  nextLabel = "Next",
  className,
}: {
  children: React.ReactNode;
  label: string;
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  function scroll(direction: 1 | -1) {
    const rtl = isRtlDocument();
    const delta = 200 * direction * (rtl ? -1 : 1);
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  return (
    <div className={cn("grid gap-2", className)} aria-roledescription="carousel" aria-label={label}>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label={previousLabel} onClick={() => scroll(-1)}>
          <DirectionalIcon icon={ChevronLeft} />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label={nextLabel} onClick={() => scroll(1)}>
          <DirectionalIcon icon={ChevronRight} />
        </Button>
      </div>
      <div ref={scrollerRef} className="flex gap-3 overflow-x-auto scroll-ps-4" dir="inherit">
        {children}
      </div>
    </div>
  );
}
