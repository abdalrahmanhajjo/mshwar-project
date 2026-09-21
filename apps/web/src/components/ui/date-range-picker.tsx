"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DateRange {
  start: string;
  end: string;
}

export interface DateRangePickerProps {
  value?: DateRange;
  onValueChange?: (value: DateRange) => void;
  startLabel?: string;
  endLabel?: string;
  legend?: string;
  disabled?: boolean;
  className?: string;
}

function DateRangePicker({
  value,
  onValueChange,
  startLabel = "Start date",
  endLabel = "End date",
  legend = "Dates",
  disabled,
  className,
}: DateRangePickerProps) {
  const startId = React.useId();
  const endId = React.useId();
  const start = value?.start ?? "";
  const end = value?.end ?? "";

  return (
    <fieldset className={cn("min-w-0 space-y-3", className)} dir="inherit" data-rtl-datepicker>
      <legend className="text-sm font-medium text-text">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={startId}>{startLabel}</Label>
          <Input
            id={startId}
            type="date"
            value={start}
            disabled={disabled}
            max={end || undefined}
            onChange={(event) => onValueChange?.({ start: event.target.value, end })}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={endId}>{endLabel}</Label>
          <Input
            id={endId}
            type="date"
            value={end}
            disabled={disabled}
            min={start || undefined}
            onChange={(event) => onValueChange?.({ start, end: event.target.value })}
          />
        </div>
      </div>
    </fieldset>
  );
}

export { DateRangePicker };
