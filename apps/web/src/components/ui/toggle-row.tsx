"use client";

import * as React from "react";

/** Generic labelled switch used by consent and preference panels. */
export function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-control border border-border-subtle px-4 py-3.5 transition-colors hover:bg-surface-sunken/60">
      <span className="flex items-center gap-3 text-sm font-medium">
        {icon ? <span className="text-text-muted [&_svg]:size-[1.1rem]">{icon}</span> : null}
        {label}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-pill bg-border transition-colors after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-surface-raised after:shadow-sm after:transition-transform peer-checked:bg-brand peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 rtl:peer-checked:after:-translate-x-5"
      />
    </label>
  );
}
