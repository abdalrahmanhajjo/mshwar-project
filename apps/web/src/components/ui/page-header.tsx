import * as React from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({
  className,
  dot = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { dot?: boolean }) {
  return (
    <p className={cn("eyebrow inline-flex items-center gap-2", className)} {...props}>
      {dot ? <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden /> : null}
      {children}
    </p>
  );
}

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Optional editorial serif phrase rendered after the title on its own line. */
  accent?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  align?: "start" | "center";
  size?: "page" | "section" | "hero";
  as?: "h1" | "h2";
  icon?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  accent,
  description,
  actions,
  align = "start",
  size = "page",
  as: Heading = "h1",
  icon,
  className,
  ...props
}: PageHeaderProps) {
  const titleClass = size === "hero" ? "title-hero" : size === "section" ? "title-section" : "title-page";
  return (
    <header
      className={cn(
        "flex flex-col gap-6 md:flex-row md:items-end md:justify-between",
        align === "center" && "items-center text-center md:flex-col md:items-center",
        className,
      )}
      {...props}
    >
      <div className={cn("grid max-w-3xl gap-4", align === "center" && "justify-items-center")}>
        {eyebrow ? (
          <Eyebrow className={cn(icon && "[&_svg]:size-4")}>
            {icon}
            {eyebrow}
          </Eyebrow>
        ) : null}
        <Heading className={cn(titleClass, "text-balance text-text")}>
          {title}
          {accent ? (
            <>
              {" "}
              <span className="text-serif block">{accent}</span>
            </>
          ) : null}
        </Heading>
        {description ? (
          <p className="max-w-2xl text-pretty text-base leading-relaxed text-text-muted md:text-lg">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
  className,
  as: Heading = "h2",
  id,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
  id?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="grid gap-3">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Heading id={id} className="title-section text-balance text-text">
          {title}
        </Heading>
      </div>
      {action ? <div className="shrink-0 text-sm font-medium">{action}</div> : null}
    </div>
  );
}
