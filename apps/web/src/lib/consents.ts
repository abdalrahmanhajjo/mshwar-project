import * as React from "react";
import { apiRequest } from "@/lib/api/client";

/** A signed-in person's consent state (MSHWAR-113); each purpose is separate and revocable. */
export type ConsentState = {
  personalisation: boolean;
  marketing_email: boolean;
  marketing_in_app: boolean;
  policies: Record<string, { current: string; accepted: string | null; effective_at: string }>;
  history: {
    purpose: string;
    granted: boolean;
    policy_version: string | null;
    source: string | null;
    created_at: string;
  }[];
};

export type ConsentUpdate = Partial<Pick<ConsentState, "personalisation" | "marketing_email" | "marketing_in_app">>;

const CHANGE_EVENT = "mshwar:consents";

export function fetchConsents(): Promise<ConsentState> {
  return apiRequest<ConsentState>("/api/v1/privacy/consents");
}

/** Omitted purposes stay as they are. Other panels on the page are told about the change. */
export async function updateConsents(patch: ConsentUpdate): Promise<ConsentState> {
  const next = await apiRequest<ConsentState>("/api/v1/privacy/consents", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  window.dispatchEvent(new CustomEvent<ConsentState>(CHANGE_EVENT, { detail: next }));
  return next;
}

/** Re-reads consent state and tells every panel on the page. */
export async function refreshConsents(): Promise<ConsentState> {
  const next = await fetchConsents();
  window.dispatchEvent(new CustomEvent<ConsentState>(CHANGE_EVENT, { detail: next }));
  return next;
}

/** Loads consent state and keeps it in step with changes made elsewhere on the page. */
export function useConsents(): { consents: ConsentState | null; failed: boolean } {
  const [consents, setConsents] = React.useState<ConsentState | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetchConsents()
      .then((state) => {
        if (!cancelled) {
          setConsents(state);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    const onChange = (event: Event) => setConsents((event as CustomEvent<ConsentState>).detail);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);

  return { consents, failed };
}
