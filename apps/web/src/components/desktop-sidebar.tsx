"use client";

import { Sprout } from "lucide-react";
import { SidebarBrand } from "@/components/sidebar-brand";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarUserMenu } from "@/components/sidebar-user-menu";
import type { PortalType } from "@/lib/portal-types";

export function DesktopSidebar({ userName, roleName, roleKey, portal, canManageStaff = false }: { userName: string; roleName: string; roleKey?: string; portal?: PortalType; canManageStaff?: boolean }) {
  return (
    <aside className="sticky top-0 hidden h-screen min-h-0 w-[232px] flex-col border-r bg-sidebar px-4 pt-4 pb-4 lg:flex">
      <div className="flex min-h-20 items-center justify-center border-b pb-4">
        <SidebarBrand />
      </div>
      <SidebarNav portal={portal} roleKey={roleKey} canManageStaff={canManageStaff} />
      <SidebarUserMenu userName={userName} roleName={roleName} />
      <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted">
        <Sprout size={13} strokeWidth={1.8} className="text-brand/70" />
        Beauty Builds Confidence
      </div>
    </aside>
  );
}
