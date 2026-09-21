import type { ReactNode } from "react";
import { ShellMain } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";

export function ShellPage({
  title,
  description,
  eyebrow,
  children,
}: {
  title: string;
  description: string;
  eyebrow?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <ShellMain>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      {children}
    </ShellMain>
  );
}
