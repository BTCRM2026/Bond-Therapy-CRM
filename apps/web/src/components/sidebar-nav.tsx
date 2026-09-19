"use client";

import { Activity, Bell, FileSignature, LayoutDashboard, ShieldCheck, Truck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_NAV_GROUPS = [
  { label: "Workspace", items: [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true }] },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/distributors", label: "Distributors", icon: Truck },
      { href: "/dashboard/agreements", label: "Agreements", icon: FileSignature },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/dashboard/team", label: "Team management", icon: Users },
      { href: "/dashboard/access", label: "Access control", icon: ShieldCheck },
      { href: "/dashboard/audit-log", label: "Audit log", icon: Activity },
    ],
  },
];

const STAFF_NAV_GROUPS = [
  { label: "Workspace", items: [{ href: "/dashboard", label: "My workspace", icon: LayoutDashboard, exact: true }] },
];

export function SidebarNav({ portal = "ADMIN" }: { portal?: "ADMIN" | "STAFF" }) {
  const pathname = usePathname();
  const groups = portal === "STAFF" ? STAFF_NAV_GROUPS : ADMIN_NAV_GROUPS;
  return (
    <nav className="mt-7 space-y-6 text-sm">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">{group.label}</p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const { href, label, icon: Icon } = item;
              const exact = "exact" in item && item.exact;
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors",
                    active ? "bg-brand text-white shadow-[0_4px_12px_rgba(23,27,114,0.16)]" : "text-muted hover:bg-background hover:text-foreground",
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
