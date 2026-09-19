"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

export function SidebarUserMenu({ userName, roleName }: { userName: string; roleName: string }) {
  const [open, setOpen] = useState(false);
  const initials = userName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="mt-auto border-t pt-4">
      <div className={cn("overflow-hidden rounded-xl border border-transparent transition-[border-color,box-shadow] duration-150", open && "border-border bg-white shadow-[0_8px_20px_rgba(23,35,31,0.07)]")}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-3 p-2 text-left outline-none transition-colors hover:bg-brand-soft/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/20"
          aria-expanded={open}
          aria-label={`${open ? "Close" : "Open"} account menu for ${userName}`}
        >
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg text-xs font-semibold transition-colors", open ? "bg-brand text-white" : "bg-brand-soft text-brand")}>{initials}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-foreground">{userName}</span>
            <span className="mt-0.5 block truncate text-[11px] text-muted">{roleName}</span>
          </span>
          {open ? <ChevronDown className="shrink-0 text-muted" size={16} /> : <ChevronUp className="shrink-0 text-muted" size={16} />}
        </button>
        {open && (
          <div className="border-t p-1.5">
            <LogoutButton />
          </div>
        )}
      </div>
    </div>
  );
}
