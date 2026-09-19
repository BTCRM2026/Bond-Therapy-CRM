import type { ReactNode } from "react";
import { MobileNavigation } from "@/components/mobile-navigation";
import { SidebarBrand } from "@/components/sidebar-brand";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarUserMenu } from "@/components/sidebar-user-menu";
import type { PortalType } from "@/lib/portal-types";

export function DashboardShell({
  userName,
  roleName,
  headerTitle,
  headerSubtitle,
  portal = "ADMIN",
  children,
}: {
  userName: string;
  roleName: string;
  headerTitle: string;
  headerSubtitle: string;
  portal?: PortalType;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r bg-white px-4 py-5 lg:flex lg:flex-col">
        <div className="flex min-h-14 items-center border-b px-2 pb-4">
          <SidebarBrand />
        </div>
        <SidebarNav portal={portal} />
        <SidebarUserMenu userName={userName} roleName={roleName} />
      </aside>
      <section className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-white/95 px-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNavigation portal={portal} userName={userName} roleName={roleName} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{headerTitle}</p>
              <p className="hidden text-xs text-muted sm:block">{headerSubtitle}</p>
            </div>
          </div>
          <span className="hidden shrink-0 rounded-md bg-brand-soft px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand md:inline-flex">
            {portal === "ADMIN" ? "Admin" : portal === "STAFF" ? "Staff" : "Distributor"}
          </span>
        </header>
        <div className="mx-auto w-full max-w-[1520px] p-4 sm:p-6 lg:p-8">{children}</div>
      </section>
    </main>
  );
}
