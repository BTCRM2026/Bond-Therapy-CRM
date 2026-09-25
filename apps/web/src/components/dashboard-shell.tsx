import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { MobileNavigation } from "@/components/mobile-navigation";
import { MobileSidebarDrawer } from "@/components/mobile-sidebar-drawer";
import { NotificationCenter } from "@/components/notification-center";
import type { PortalType } from "@/lib/portal-types";

export function DashboardShell({
  userName,
  roleName,
  roleKey,
  headerTitle,
  headerSubtitle,
  portal = "ADMIN",
  canManageStaff = false,
  children,
}: {
  userName: string;
  roleName: string;
  roleKey?: string;
  headerTitle: string;
  headerSubtitle: string;
  portal?: PortalType;
  canManageStaff?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="crm-shell min-h-screen bg-background lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
      <DesktopSidebar userName={userName} roleName={roleName} roleKey={roleKey} portal={portal} canManageStaff={canManageStaff} />
      <section className="min-w-0">
        <header className="sticky top-0 z-30 flex h-[60px] items-center justify-between gap-3 border-b bg-white/95 px-4 shadow-[0_1px_0_rgba(26,31,26,0.04)] backdrop-blur sm:px-6 lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <MobileSidebarDrawer portal={portal} roleKey={roleKey} canManageStaff={canManageStaff} />
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold tracking-[-0.018em] text-foreground sm:text-base">{headerTitle}</h1>
              <p className="hidden text-[11px] text-muted sm:block">{headerSubtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div id="page-header-actions" className="flex items-center gap-2" />
            <NotificationCenter />
            <MobileNavigation userName={userName} roleName={roleName} />
          </div>
        </header>
        <div className="w-full p-4 pb-24 sm:p-5 sm:pb-24 lg:p-5 lg:pb-5">{children}</div>
        <BottomTabBar portal={portal} roleKey={roleKey} canManageStaff={canManageStaff} />
      </section>
    </main>
  );
}
