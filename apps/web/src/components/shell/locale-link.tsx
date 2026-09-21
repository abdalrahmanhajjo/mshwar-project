"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useLocale } from "@/components/shell/locale-provider";
import { withLocalePrefix } from "@/lib/locale";

export function LocaleLink({ href, ...props }: ComponentProps<typeof Link>) {
  const { locale } = useLocale();
  const nextHref = typeof href === "string" ? withLocalePrefix(locale, href) : href;
  return <Link href={nextHref} {...props} />;
}
