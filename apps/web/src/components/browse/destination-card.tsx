import { LocaleLink } from "@/components/shell/locale-link";
import { ArrowUpRight } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { BidiText } from "@/components/ui/bidi-text";
import type { Destination } from "@/lib/catalog";
import { cn, focusRing } from "@/lib/utils";

export function DestinationCard({
  destination,
  kicker,
  subtitle,
  className,
}: {
  destination: Destination;
  /** Overrides the region label above the name. */
  kicker?: string;
  /** Overrides the tag line under the name. */
  subtitle?: string;
  className?: string;
}) {
  return (
    <LocaleLink
      href={`/destinations/${destination.slug}`}
      aria-label={destination.name}
      className={cn("group block h-full rounded-card", focusRing, className)}
    >
      <article className="relative isolate h-full min-h-[18rem] overflow-hidden rounded-card bg-brand md:min-h-[22rem]">
        <CatalogImage
          src={destination.image}
          alt={destination.imageAlt}
          className="absolute inset-0 transition-transform duration-slow ease-standard group-hover:scale-[1.04]"
        />
        <div className="photo-scrim absolute inset-0" />
        <span className="absolute end-4 top-4 grid size-9 place-items-center rounded-full text-white transition-colors duration-normal group-hover:bg-white/20 group-hover:backdrop-blur">
          <ArrowUpRight className="size-5 rtl:-scale-x-100" aria-hidden />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-7">
          <p className="text-xs font-medium tracking-wide text-white/80">{kicker ?? destination.region}</p>
          <h3 className="mt-1 text-[1.9rem] font-semibold leading-tight tracking-[-0.035em]">
            <BidiText>{destination.name}</BidiText>
          </h3>
          <p className="mt-1.5 text-sm text-white/85">{subtitle ?? destination.tags.join(" · ")}</p>
        </div>
      </article>
    </LocaleLink>
  );
}
