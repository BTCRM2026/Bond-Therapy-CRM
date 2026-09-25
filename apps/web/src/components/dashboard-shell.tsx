import { Sprout } from "lucide-react";
import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { MobileNavigation } from "@/components/mobile-navigation";
import { MobileSidebarDrawer } from "@/components/mobile-sidebar-drawer";
import { NotificationCenter } from "@/components/notification-center";
import { SidebarBrand } from "@/components/sidebar-brand";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarUserMenu } from "@/components/sidebar-user-menu";
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
    <main className="crm-shell min-h-screen bg-background lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen min-h-0 border-r bg-sidebar px-4 pt-4 pb-4 lg:flex lg:flex-col">
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
