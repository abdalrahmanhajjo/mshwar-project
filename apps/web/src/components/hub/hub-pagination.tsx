"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";
import { useHubCopy } from "@/lib/hub-copy";
import { HUB_PAGE_SIZE } from "@/lib/hub";

export function HubPagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const copy = useBrowseCopy();
  const hub = useHubCopy();
  const pages = Math.max(1, Math.ceil(total / HUB_PAGE_SIZE));
  if (pages <= 1) {
    return null;
  }
  return (
    <nav className="flex items-center justify-center gap-3 pt-2" aria-label={hub.pageLabel}>
      <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ArrowLeft className="rtl:rotate-180" aria-hidden />
        {copy.pagePrevious}
      </Button>
      <p className="min-w-16 text-center text-sm tabular-nums text-text-muted">
        {page} / {pages}
      </p>
      <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {copy.pageNext}
        <ArrowRight className="rtl:rotate-180" aria-hidden />
      </Button>
    </nav>
  );
}

export function HubLoading() {
  return (
    <div className="grid gap-4" aria-hidden>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-card bg-brand-subtle/50" />
      ))}
    </div>
  );
}
