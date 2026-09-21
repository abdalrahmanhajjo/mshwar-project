"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, controlSize, focusRing } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  emptyText = "No matches",
  id,
  disabled,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listId = React.useId();
  const filterRef = React.useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  React.useEffect(() => {
    if (open) {
      filterRef.current?.focus();
    }
  }, [open]);

  function setOpenState(next: boolean) {
    setOpen(next);
    if (next) {
      setActiveIndex(0);
    } else {
      setQuery("");
    }
  }

  function choose(next: string) {
    onValueChange?.(next);
    setOpenState(false);
  }

  function onFilterKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(filtered.length - 1, index + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) {
        choose(option.value);
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpenState(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpenState}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-control border border-border bg-surface-raised px-3 py-2 text-start text-sm",
            "disabled:cursor-not-allowed disabled:opacity-50",
            focusRing,
            controlSize,
          )}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpenState(true);
            }
          }}
        >
          <span className={cn(!selected && "text-text-muted")}>{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-70" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
        <input
          ref={filterRef}
          className={cn("mb-2 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm", focusRing)}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onFilterKeyDown}
          placeholder="Filter…"
          aria-label="Filter options"
          aria-controls={listId}
          aria-activedescendant={filtered[activeIndex] ? `${listId}-${filtered[activeIndex].value}` : undefined}
        />
        <ul id={listId} role="listbox" aria-label={ariaLabel ?? placeholder} className="max-h-56 overflow-auto">
          {filtered.length === 0 ? (
            <li className="px-2 py-2 text-sm text-text-muted">{emptyText}</li>
          ) : (
            filtered.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${option.value}`}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-control px-2 py-2 text-start text-sm",
                    "hover:bg-brand-subtle",
                    index === activeIndex && "bg-brand-subtle",
                    focusRing,
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option.value)}
                >
                  {option.label}
                  {isSelected ? <Check className="size-4" aria-hidden /> : null}
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export { Combobox };
