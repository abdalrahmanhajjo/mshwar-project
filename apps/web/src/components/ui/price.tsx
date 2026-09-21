import * as React from "react";
import { formatCurrency } from "@/i18n/format";
import { parseLocale } from "@/lib/locale";
import { messages } from "@/lib/messages";
import { cn } from "@/lib/utils";

export interface PriceProps extends React.HTMLAttributes<HTMLParagraphElement> {
  amount: number;
  currency?: string;
  locale?: string;
  estimate?: boolean;
  estimateLabel?: string;
  period?: string;
}

function Price({
  amount,
  currency = "USD",
  locale = "en",
  estimate = false,
  estimateLabel,
  period,
  className,
  ...props
}: PriceProps) {
  const parsed = parseLocale(locale.slice(0, 2));
  const formatted = formatCurrency(parsed, amount, currency);
  const estimateCopy = estimateLabel ?? messages[parsed].estimate;

  return (
    <p className={cn("text-[2rem] font-semibold leading-none tracking-[-0.03em] text-text", className)} {...props}>
      <span>{formatted}</span>
      {period ? <span className="text-sm font-normal tracking-normal text-text-muted"> / {period}</span> : null}
      {estimate ? (
        <span className="ms-2 text-label font-medium tracking-normal text-text-muted">{estimateCopy}</span>
      ) : null}
    </p>
  );
}

export { Price };
