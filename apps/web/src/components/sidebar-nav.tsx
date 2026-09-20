"use client";

import { Building2, LayoutDashboard, Settings, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PortalType } from "@/lib/portal-types";
import { cn } from "@/lib/utils";

const STAFF_NAV_GROUPS = [
  { label: "Workspace", items: [{ href: "/dashboard", label: "My workspace", icon: LayoutDashboard, exact: true }, { href: "/dashboard/clients", label: "Clients", icon: Building2, exact: false }] },
  { label: "Account", items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings, exact: true }] },
];

export function SidebarNav({ portal = "ADMIN", canManageStaff = false, onNavigate }: { portal?: PortalType; canManageStaff?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = portal === "ADMIN" ? [
    { label: "Workspace", items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
      ...(canManageStaff ? [{ href: "/dashboard/staff", label: "Staff & Access", icon: UsersRound, exact: false }] : []),
    ] },
    { label: "Account", items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings, exact: true }] },
  ] : STAFF_NAV_GROUPS;
  return (
    <nav className="mt-6 space-y-7 text-sm" aria-label="Portal navigation">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">{group.label}</p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const { href, label, icon: Icon } = item;
              const exact = "exact" in item && item.exact;
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold transition-colors duration-150",
                    active ? "bg-brand text-white shadow-[0_5px_14px_rgba(13,92,82,0.16)]" : "text-muted hover:bg-brand-soft/70 hover:text-brand-dark",
                  )}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
