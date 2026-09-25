"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type FilterOption<T extends string> = { key: T; label: string; count?: number };

export function FilterMenu<T extends string>({ value, options, onSelect, showLabelOnMobile = false, fullWidth = false, ariaLabel = "Filter results" }: { value: T; options: readonly FilterOption<T>[]; onSelect: (key: T) => void; showLabelOnMobile?: boolean; fullWidth?: boolean; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const active = options.find((item) => item.key === value) ?? options[0];
  return <div className={cn("relative shrink-0", fullWidth && "w-full")} ref={root}>
    <button type="button" onClick={() => setOpen((v) => !v)} className={cn("flex h-11 items-center gap-2 rounded-lg border bg-white px-3 text-[13px] font-medium text-foreground outline-none transition-colors hover:border-brand/25 hover:bg-brand-soft/40 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/10 sm:h-10", fullWidth && "w-full justify-between")} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}>
      <SlidersHorizontal size={15} className="text-muted" />
      <span className={showLabelOnMobile ? "" : "hidden sm:inline"}>{active.label}</span>
      {active.count !== undefined && <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted">{active.count}</span>}
      <ChevronDown size={14} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div className={cn("absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-lg border bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.14)]", fullWidth && "left-0 right-auto min-w-full")} role="listbox">
      {options.map((item) => <button key={item.key} type="button" onClick={() => { onSelect(item.key); setOpen(false); }} role="option" aria-selected={item.key === value} className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors ${item.key === value ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background hover:text-foreground"}`}>
        {item.label}
        {item.count !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${item.key === value ? "bg-white/70 text-brand" : "bg-background text-muted"}`}>{item.count}</span>}
      </button>)}
    </div>}
  </div>;
}
