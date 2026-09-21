import { LocaleLink } from "@/components/shell/locale-link";
import { cn, focusRing } from "@/lib/utils";

/** The Mshwar path symbol — a mountain-and-sea route that ends in the orange stop. */
export function LogoSymbol({ className, tone = "brand" }: { className?: string; tone?: "brand" | "inverse" }) {
  return (
    <svg viewBox="0 0 68 34" className={cn("h-7 w-auto shrink-0", className)} aria-hidden focusable="false">
      <path
        d="M6 29.5V18.2c0-2.3.8-4.4 2.3-6.1l3.9-4.4c2.5-2.8 6.9-2.8 9.4 0l5.6 6.4c1.6 1.8 4.4 1.8 6 0l4.6-5.3c2.5-2.9 7-2.9 9.5 0l6.6 7.6c1.3 1.5 3 2.5 4.9 2.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="7.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={tone === "inverse" ? "text-brand-foreground" : "text-brand"}
      />
      <circle cx="63.4" cy="20.6" r="3.6" className="fill-accent" />
    </svg>
  );
}

export function Wordmark({ className, dot = true }: { className?: string; dot?: boolean }) {
  return (
    <span className={cn("font-sans text-[1.6rem] font-bold leading-none tracking-[-0.06em]", className)} dir="ltr">
      mshwar
      {dot ? <span className="text-accent">.</span> : null}
    </span>
  );
}

export function BrandMark({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <LocaleLink
      href={href}
      aria-label="Mshwar"
      dir="ltr"
      className={cn(
        "inline-flex min-h-[var(--layout-min-target)] items-center gap-2 rounded-control text-text",
        focusRing,
      )}
    >
      <LogoSymbol className={compact ? "h-6" : "h-7"} />
      <span className="flex flex-col items-start leading-none">
        <span className={cn("font-bold tracking-[-0.055em]", compact ? "text-[1.3rem]" : "text-[1.45rem]")}>
          mshwar
        </span>
        <span
          lang="ar"
          className="-mt-0.5 ms-3 font-arabic text-[0.72rem] font-semibold leading-none text-text/80"
          aria-hidden
        >
          مشـوار
        </span>
      </span>
    </LocaleLink>
  );
}
