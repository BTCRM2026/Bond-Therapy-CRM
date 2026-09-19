"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { SidebarNav } from "@/components/sidebar-nav";

export function MobileNavigation({ portal }: { portal: "ADMIN" | "STAFF" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-9 place-items-center rounded-lg border bg-white text-foreground lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={19} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-foreground/30" onClick={() => setOpen(false)} aria-label="Close navigation" />
          <aside className="relative flex h-full w-[280px] flex-col border-r bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <BrandMark className="!w-[128px]" />
              <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-background" aria-label="Close navigation">
                <X size={18} />
              </button>
            </div>
            <SidebarNav portal={portal} />
          </aside>
        </div>
      )}
    </>
  );
}
