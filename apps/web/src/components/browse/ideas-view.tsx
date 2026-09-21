"use client";

import { ArrowUpRight } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { Idea } from "@/lib/catalog";
import { splitAtComma, splitSentence } from "@/lib/text";
import { cn } from "@/lib/utils";

export function IdeasView({ ideas }: { ideas: Idea[] }) {
  const copy = useBrowseCopy();
  const [lead, tail] = splitAtComma(copy.ideasTitle);
  return (
    <div className="shell-frame grid gap-14 pb-20 pt-12 md:gap-20 md:pt-16">
      <PageHeader eyebrow={copy.ideasEyebrow} title={lead} accent={tail || undefined} description={copy.ideasBody} />
      <div className="grid gap-16 md:gap-24">
        {ideas.map((idea, index) => {
          const flip = index % 2 === 1;
          const [titleLead, titleTail] = splitSentence(idea.title);
          return (
            <article key={idea.slug} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <div className={cn("relative overflow-hidden rounded-[1.5rem]", flip && "lg:order-2")}>
                <div className="aspect-[4/3] lg:aspect-[5/4]">
                  <CatalogImage src={idea.image} alt={idea.imageAlt} />
                </div>
                <span className="absolute start-4 top-4 rounded-pill bg-surface/95 px-3 py-1 text-xs font-semibold text-text shadow-sm">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <div className={cn("grid gap-5", flip && "lg:order-1")}>
                <p className="eyebrow">{idea.kicker}</p>
                <h2 className="title-page text-balance">
                  {titleLead}
                  {titleTail ? <span className="text-serif block">{titleTail}</span> : null}
                </h2>
                <p className="max-w-md text-lg leading-relaxed text-text-muted">{idea.description}</p>
                <p className="text-sm text-text-muted">
                  {idea.priceFrom > 0 ? (
                    <>
                      {copy.fromPrice}{" "}
                      <span className="text-xl font-semibold tracking-tight text-text">${idea.priceFrom}</span> /{" "}
                      {copy.perPerson} · {copy.preview}
                    </>
                  ) : (
                    <>
                      <span className="text-xl font-semibold tracking-tight text-text">{copy.free}</span> ·{" "}
                      {copy.preview}
                    </>
                  )}
                </p>
                <Progress className="max-w-sm" value={(idea.stops / 3) * 100} label={`${idea.stops} / 3`} />
                <div>
                  <Button asChild size="lg" variant={idea.accent ? "accent" : "default"}>
                    <LocaleLink href={`/collections/${idea.slug}`}>
                      {copy.exploreDay}
                      <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
                    </LocaleLink>
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
