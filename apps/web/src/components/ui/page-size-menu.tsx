"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const PAGE_SIZES = [10, 20, 30] as const;

export function PageSizeMenu({ pageSize, onSelect, toolbar = false }: { pageSize: number; onSelect: (value: number) => void; toolbar?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return <div className="relative shrink-0" ref={root}>
    <button type="button" onClick={() => setOpen((value) => !value)} className={`flex items-center gap-1 bg-white font-medium text-foreground outline-none transition-colors hover:bg-brand-soft/40 ${toolbar ? "h-[38px] px-3 text-[13px]" : "h-7 rounded-md border px-2 text-xs hover:border-brand/25"}`} aria-haspopup="listbox" aria-expanded={open} aria-label="Rows per page">
      {pageSize}
      <ChevronDown size={12} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div className={`absolute right-0 z-50 w-24 overflow-hidden rounded-lg border bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.14)] ${toolbar ? "top-11" : "top-8"}`} role="listbox">
      {PAGE_SIZES.map((size) => <button key={size} type="button" onClick={() => { onSelect(size); setOpen(false); }} role="option" aria-selected={size === pageSize} className={`w-full rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors ${size === pageSize ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background hover:text-foreground"}`}>{size}</button>)}
    </div>}
  </div>;
}
