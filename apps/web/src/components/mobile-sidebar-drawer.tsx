"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SidebarBrand } from "@/components/sidebar-brand";
import { SidebarNav } from "@/components/sidebar-nav";
import type { PortalType } from "@/lib/portal-types";

export function MobileSidebarDrawer({ portal, roleKey, canManageStaff = false }: { portal: PortalType; roleKey?: string; canManageStaff?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid size-11 shrink-0 place-items-center rounded-lg border bg-white text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:bg-brand-soft lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={19} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-label="Close navigation" />
          <aside role="dialog" aria-modal="true" aria-label="Portal navigation" className="relative flex h-[100dvh] w-[min(86vw,304px)] flex-col border-r bg-sidebar px-4 py-5 shadow-[16px_0_40px_rgba(26,31,26,0.12)]">
            <div className="flex min-h-14 items-center justify-between border-b px-2 pb-4">
              <SidebarBrand />
              <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-lg text-muted hover:bg-background" aria-label="Close navigation">
                <X size={18} />
              </button>
            </div>
            <SidebarNav portal={portal} roleKey={roleKey} canManageStaff={canManageStaff} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
