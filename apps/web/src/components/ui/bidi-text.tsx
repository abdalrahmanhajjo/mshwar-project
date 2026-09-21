import { detectRunDirection, hasMixedDirection } from "@/i18n/bidi";

export function BidiText({
  children,
  dir,
  isolate = true,
}: {
  children: string;
  dir?: "ltr" | "rtl";
  isolate?: boolean;
}) {
  const resolved = dir ?? detectRunDirection(children);
  return (
    <span
      dir={resolved}
      className={isolate ? "unicode-bidi-isolate" : undefined}
      data-mixed={hasMixedDirection(children) || undefined}
    >
      {children}
    </span>
  );
}
