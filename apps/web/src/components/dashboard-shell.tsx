import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { LogoutButton } from "@/components/logout-button";
import { MobileNavigation } from "@/components/mobile-navigation";
import { SidebarNav } from "@/components/sidebar-nav";

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
  portal?: "ADMIN" | "STAFF";
  children: ReactNode;
}) {
  const initials = userName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="hidden border-r bg-white p-4 lg:flex lg:flex-col">
        <div className="flex min-h-14 items-center border-b px-2 pb-4">
          <BrandMark className="!w-[132px]" />
        </div>
        <div className="mt-4 inline-flex w-fit rounded-md bg-brand-soft px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
          {portal === "STAFF" ? "Staff Portal" : "Administration"}
        </div>
        <SidebarNav portal={portal} />
        <div className="mt-auto flex items-center gap-3 rounded-xl border bg-[#fafbfc] p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand text-xs font-semibold text-white">{initials}</span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{userName}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted">{roleName}</p>
          </div>
        </div>
      </aside>
      <section className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <MobileNavigation portal={portal} />
            <div>
            <p className="text-sm font-semibold text-foreground">{headerTitle}</p>
              <p className="hidden text-xs text-muted sm:block">{headerSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-md bg-brand-soft px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand sm:inline-flex">
              {portal === "STAFF" ? "Staff" : "Admin"}
            </span>
            <LogoutButton />
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1520px] p-4 sm:p-6 lg:p-8">{children}</div>
      </section>
    </main>
  );
}
