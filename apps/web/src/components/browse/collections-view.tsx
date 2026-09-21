"use client";

import { ArrowUpRight } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { LocaleLink } from "@/components/shell/locale-link";
import { PageHeader } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { Idea } from "@/lib/catalog";
import { cn, focusRing } from "@/lib/utils";

export function CollectionsView({ collections }: { collections: Idea[] }) {
  const copy = useBrowseCopy();
  return (
    <div className="shell-frame grid gap-12 pb-20 pt-12 md:pt-16">
      <PageHeader eyebrow={copy.collectionsEyebrow} title={copy.collectionsTitle} description={copy.collectionsBody} />
      <div className="grid gap-6 md:grid-cols-2">
        {collections.map((collection, index) => (
          <article key={collection.slug} className={cn(index === 0 && collections.length % 2 === 1 && "md:col-span-2")}>
            <LocaleLink
              href={`/collections/${collection.slug}`}
              className={cn("group relative isolate block overflow-hidden rounded-[1.5rem] bg-brand", focusRing)}
            >
              <div className={cn("aspect-[4/3]", index === 0 && collections.length % 2 === 1 && "md:aspect-[21/9]")}>
                <CatalogImage
                  src={collection.image}
                  alt={collection.imageAlt}
                  className="transition-transform duration-slow group-hover:scale-[1.03]"
                />
              </div>
              <div className="photo-scrim absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 grid gap-2 p-6 text-white md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">{collection.kicker}</p>
                <h2 className="title-section">{collection.title}</h2>
                <p className="max-w-md text-sm text-white/85">{collection.description}</p>
                <span className="mt-2 inline-flex w-fit items-center gap-2 border-b border-white/50 pb-1 text-sm font-medium">
                  {copy.exploreDay}
                  <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
                </span>
              </div>
            </LocaleLink>
          </article>
        ))}
      </div>
    </div>
  );
}
