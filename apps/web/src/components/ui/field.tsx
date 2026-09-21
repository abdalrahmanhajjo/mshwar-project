"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  id,
  label,
  error,
  description,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  description?: string;
  children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>>;
  className?: string;
}) {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const describedBy =
    [description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {description ? (
        <p id={descriptionId} className="-mt-1 text-xs text-text-muted">
          {description}
        </p>
      ) : null}
      {React.cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
