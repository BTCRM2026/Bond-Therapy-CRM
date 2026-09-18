import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { LogoutButton } from "@/components/logout-button";
import { SidebarNav } from "@/components/sidebar-nav";

export function DashboardShell({
  userName,
  roleName,
  headerTitle,
  headerSubtitle,
  children,
}: {
  userName: string;
  roleName: string;
  headerTitle: string;
  headerSubtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r bg-white p-5 lg:flex lg:flex-col">
        <BrandMark />
        <SidebarNav />
        <div className="mt-auto rounded-lg border bg-background p-3">
          <p className="text-xs font-semibold text-foreground">{userName}</p>
          <p className="mt-1 truncate text-[11px] text-muted">{roleName}</p>
        </div>
      </aside>
      <section className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b bg-white/95 px-5 sm:px-6">
          <div className="lg:hidden"><BrandMark /></div>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-foreground">{headerTitle}</p>
            <p className="text-xs text-muted">{headerSubtitle}</p>
          </div>
          <LogoutButton />
        </header>
        <div className="p-5 sm:p-6">{children}</div>
      </section>
    </main>
  );
}
