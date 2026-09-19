import type { ReactNode } from "react";
import { MobileNavigation } from "@/components/mobile-navigation";
import { NotificationCenter } from "@/components/notification-center";
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
  canManageStaff = false,
  children,
}: {
  userName: string;
  roleName: string;
  headerTitle: string;
  headerSubtitle: string;
  portal?: PortalType;
  canManageStaff?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r bg-white px-4 py-5 lg:flex lg:flex-col">
        <div className="flex min-h-14 items-center border-b px-2 pb-4">
          <SidebarBrand />
        </div>
        <SidebarNav portal={portal} canManageStaff={canManageStaff} />
        <SidebarUserMenu userName={userName} roleName={roleName} />
      </aside>
      <section className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between gap-3 border-b bg-white/95 px-3 py-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNavigation portal={portal} userName={userName} roleName={roleName} canManageStaff={canManageStaff} />
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground sm:text-base">{headerTitle}</h1>
              <p className="hidden text-xs text-muted sm:block">{headerSubtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div id="page-header-actions" className="flex items-center gap-2" />
            <NotificationCenter />
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1520px] p-4 sm:p-6 lg:p-8">{children}</div>
      </section>
    </main>
  );
}
