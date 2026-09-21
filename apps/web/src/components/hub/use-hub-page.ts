"use client";

import * as React from "react";
import type { HubPage } from "@/lib/hub";

export function useHubPage<T>(loader: (page: number) => Promise<HubPage<T>>) {
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<HubPage<T> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(true);

  const load = React.useCallback(
    async (nextPage: number) => {
      setPending(true);
      setError(null);
      try {
        const result = await loader(nextPage);
        setData(result);
        setPage(result.page);
      } catch (err) {
        setError(err instanceof Error ? err.message : "error");
      } finally {
        setPending(false);
      }
    },
    [loader],
  );

  React.useEffect(() => {
    let cancelled = false;
    loader(1)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setData(result);
        setPage(result.page);
        setPending(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : "error");
        setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loader]);

  return { page, data, error, pending, load, setData, setError };
}
