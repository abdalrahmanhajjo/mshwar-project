import { LogoSymbol } from "@/components/shell/brand-mark";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="grid justify-items-center gap-4">
        <LogoSymbol className="h-9 animate-pulse" />
        <div className="h-1 w-24 overflow-hidden rounded-pill bg-brand-subtle">
          <div className="h-full w-1/2 animate-pulse rounded-pill bg-brand" />
        </div>
      </div>
    </div>
  );
}
