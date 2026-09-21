"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Clock3, Download, RotateCcw, Sparkles, UserX } from "lucide-react";
import { ToggleRow } from "@/components/ui/toggle-row";
import { Notice } from "@/components/ui/notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOutAccount } from "@/lib/auth";
import { withLocalePrefix } from "@/lib/locale";
import { deleteAccount, downloadDataExport, resetPersonalisation } from "@/lib/privacy";
import { usePrivacyCopy } from "@/lib/privacy-copy";
import { refreshConsents, updateConsents, useConsents } from "@/lib/consents";
import { useTrustCopy } from "@/lib/trust-copy";
import { useLocale } from "@/components/shell/locale-provider";

export function PrivacyPanel() {
  const copy = usePrivacyCopy();
  const trust = useTrustCopy();
  const { consents } = useConsents();
  const { locale } = useLocale();
  const router = useRouter();
  const [confirmation, setConfirmation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function run(action: () => Promise<void>, done: string) {
    setPending(true);
    setError(null);
    try {
      await action();
      setStatus(done);
    } catch {
      setError(copy.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      id="privacy"
      className="scroll-mt-28 overflow-hidden rounded-card border border-border-subtle bg-surface-raised shadow-sm"
      aria-labelledby="privacy-heading"
    >
      <header className="grid gap-1.5 p-6 md:p-7">
        <h2 id="privacy-heading" className="title-card">
          {copy.privacyTitle}
        </h2>
        <p className="text-sm leading-relaxed text-text-muted">{copy.privacyBody}</p>
      </header>
      <div className="divide-y divide-border-subtle border-t border-border-subtle">
        <div className="grid gap-4 p-6 md:px-7">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-subtle">
              <Sparkles className="size-[1.1rem]" aria-hidden />
            </span>
            <div className="grid gap-1">
              <h3 className="font-semibold">{trust.personalisationTitle}</h3>
              <p className="text-sm text-text-muted">{trust.personalisationBody}</p>
            </div>
          </div>
          {consents ? (
            <ToggleRow
              label={trust.personalisationToggle}
              checked={consents.personalisation}
              onChange={(value) =>
                void run(
                  async () => {
                    await updateConsents({ personalisation: value });
                  },
                  value ? trust.personalisationOn : trust.personalisationOff,
                )
              }
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between md:px-7">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-subtle">
              <Download className="size-[1.1rem]" aria-hidden />
            </span>
            <div className="grid gap-1">
              <h3 className="font-semibold">{copy.exportTitle}</h3>
              <p className="text-sm text-text-muted">{copy.exportBody}</p>
            </div>
          </div>
          <Button type="button" disabled={pending} onClick={() => void run(downloadDataExport, copy.exportDone)}>
            {copy.exportAction}
          </Button>
        </div>

        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between md:px-7">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-subtle">
              <RotateCcw className="size-[1.1rem]" aria-hidden />
            </span>
            <div className="grid gap-1">
              <h3 className="font-semibold">{copy.resetTitle}</h3>
              <p className="text-sm text-text-muted">{copy.resetBody}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              void run(async () => {
                await resetPersonalisation();
                // Resetting also switches personalisation off; show that straight away.
                await refreshConsents().catch(() => undefined);
              }, copy.resetDone)
            }
          >
            {copy.resetAction}
          </Button>
        </div>

        <div className="grid gap-4 bg-danger-subtle/40 p-6 md:px-7">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger-subtle text-danger">
              <UserX className="size-[1.1rem]" aria-hidden />
            </span>
            <div className="grid gap-1">
              <h3 className="font-semibold">{copy.deleteTitle}</h3>
              <p className="text-sm text-text-muted">{copy.deleteBody}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor="delete-confirm">{copy.deleteConfirm}</Label>
              <Input
                id="delete-confirm"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || confirmation.trim().toUpperCase() !== "DELETE"}
              onClick={() =>
                void run(async () => {
                  await deleteAccount(confirmation);
                  await signOutAccount();
                  router.replace(withLocalePrefix(locale, "/"));
                }, copy.deleteTitle)
              }
            >
              {copy.deleteAction}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 p-6 md:px-7">
          <h3 className="font-semibold">{copy.retentionTitle}</h3>
          <ul className="grid gap-2 text-sm text-text-muted sm:grid-cols-2">
            {[
              copy.retentionProfile,
              copy.retentionTrips,
              copy.retentionFavorites,
              copy.retentionReviews,
              copy.retentionBookings,
              copy.retentionPayments,
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 rounded-control bg-surface-sunken px-3.5 py-2.5">
                <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {error || status ? (
        <div className="border-t border-border-subtle p-6 md:px-7">
          {error ? (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          ) : null}
          {status ? (
            <Notice tone="success">
              <p role="status">{status}</p>
            </Notice>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
