import { Skeleton } from "@/components/ui/skeleton";

export function ExperiencesSkeleton() {
  return (
    <div className="shell-frame grid gap-8 pb-20 pt-12 md:pt-16">
      <div className="grid gap-4">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-14 w-full max-w-lg" />
        <Skeleton className="h-5 w-80" />
      </div>
      <Skeleton className="h-20 w-full rounded-card" />
      <div className="flex gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-28 rounded-pill" />
        ))}
      </div>
      <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="grid gap-3">
            <Skeleton className="aspect-[4/3] w-full rounded-card" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
