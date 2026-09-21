"use client";

import { Compass } from "lucide-react";
import { DestinationCard } from "@/components/browse/destination-card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { Destination } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/** Editorial mosaic: wide-narrow, then rows of three. */
const SPANS = ["lg:col-span-2", "lg:col-span-1"];

export function DestinationsView({ destinations }: { destinations: Destination[] }) {
  const copy = useBrowseCopy();
  return (
    <div className="shell-frame grid gap-12 pb-20 pt-12 md:gap-14 md:pt-16">
      <PageHeader
        eyebrow={copy.destinationsEyebrow}
        title={copy.destinationsTitle}
        description={copy.destinationsBody}
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((destination, index) => (
          <DestinationCard
            key={destination.slug}
            destination={destination}
            className={cn(SPANS[index] ?? "", "[&_article]:min-h-[20rem] md:[&_article]:min-h-[24rem]")}
          />
        ))}
      </div>
      <Notice icon={<Compass aria-hidden />} className="px-5 py-4 text-[0.9375rem]">
        {copy.destinationsNote}
      </Notice>
    </div>
  );
}
