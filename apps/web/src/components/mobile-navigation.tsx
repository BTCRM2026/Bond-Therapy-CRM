"use client";

import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/logout-button";

export function MobileNavigation({ userName, roleName }: { userName: string; roleName: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const initials = userName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") setOpen(false);
      if (event instanceof MouseEvent && root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, []);

  return (
    <div className="relative lg:hidden" ref={root}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid size-11 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand transition-colors hover:bg-brand/15"
        aria-label={`${open ? "Close" : "Open"} account menu`}
        aria-expanded={open}
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border bg-white shadow-[0_18px_48px_rgba(15,23,42,0.15)]">
          <div className="border-b px-4 py-3">
            <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
            <p className="mt-0.5 truncate text-xs text-muted">{roleName}</p>
          </div>
          <div className="p-1.5">
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  );
}
