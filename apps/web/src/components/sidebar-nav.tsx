"use client";

import { AlertTriangle, Building2, LayoutDashboard, ListChecks, Package, Settings, ShoppingCart, Truck, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PortalType } from "@/lib/portal-types";
import { cn } from "@/lib/utils";

const SALES_ROLE_KEYS = new Set(["SALES_MANAGER", "SALES_EXECUTIVE"]);
const WAREHOUSE_ROLE_KEYS = new Set(["WAREHOUSE"]);

function staffGroups(roleKey?: string) {
  const isSales = roleKey ? SALES_ROLE_KEYS.has(roleKey) : false;
  const isWarehouse = roleKey ? WAREHOUSE_ROLE_KEYS.has(roleKey) : false;
  const workspaceItems = [
    { href: "/dashboard", label: "My workspace", icon: LayoutDashboard, exact: true },
    ...(isSales ? [
      { href: "/dashboard/follow-ups", label: "Follow-ups", icon: ListChecks, exact: false },
      { href: "/dashboard/leads", label: "Leads", icon: UserPlus, exact: false },
    ] : []),
    ...(isWarehouse ? [{ href: "/dashboard/dispatch", label: "Dispatch", icon: Truck, exact: false }] : []),
    { href: "/dashboard/clients", label: "Clients", icon: Building2, exact: false },
    ...(isSales ? [{ href: "/dashboard/orders", label: "Orders", icon: ShoppingCart, exact: false }] : []),
    ...(isWarehouse ? [{ href: "/dashboard/inventory", label: "Inventory", icon: AlertTriangle, exact: false }] : []),
    ...(isSales ? [{ href: "/dashboard/products", label: "Products", icon: Package, exact: false }] : []),
  ];
  return [
    { label: "Workspace", items: workspaceItems },
    { label: "Account", items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings, exact: true }] },
  ];
}

export function SidebarNav({ portal = "ADMIN", roleKey, canManageStaff = false, onNavigate }: { portal?: PortalType; roleKey?: string; canManageStaff?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = portal === "ADMIN" ? [
    { label: "Workspace", items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
      ...(canManageStaff ? [{ href: "/dashboard/staff", label: "Staff & Access", icon: UsersRound, exact: false }] : []),
      ...(roleKey === "SUPER_ADMIN" ? [{ href: "/dashboard/products", label: "Products", icon: Package, exact: false }] : []),
    ] },
    { label: "Account", items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings, exact: true }] },
  ] : staffGroups(roleKey);
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
                    "relative flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold transition-colors duration-150",
                    active
                      ? "bg-brand-soft text-brand before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand"
                      : "text-muted hover:bg-brand-soft/60 hover:text-brand-dark",
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
