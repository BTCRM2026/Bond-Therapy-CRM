"use client";

import { AlertTriangle, Building2, LayoutDashboard, ListChecks, Package, Settings, ShoppingCart, Truck, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PortalType } from "@/lib/portal-types";
import { cn } from "@/lib/utils";

const SALES_ROLE_KEYS = new Set(["SALES_MANAGER", "SALES_EXECUTIVE"]);
const WAREHOUSE_ROLE_KEYS = new Set(["WAREHOUSE"]);

export function BottomTabBar({ portal = "ADMIN", roleKey, canManageStaff = false }: { portal?: PortalType; roleKey?: string; canManageStaff?: boolean }) {
  const pathname = usePathname();
  const isSales = roleKey ? SALES_ROLE_KEYS.has(roleKey) : false;
  const isWarehouse = roleKey ? WAREHOUSE_ROLE_KEYS.has(roleKey) : false;
  const items = portal === "ADMIN"
    ? [
        { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
        ...(canManageStaff ? [{ href: "/dashboard/staff", label: "Staff", icon: UsersRound, exact: false }] : []),
        ...(roleKey === "SUPER_ADMIN" ? [{ href: "/dashboard/products", label: "Products", icon: Package, exact: false }] : []),
        { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: true },
      ]
    : portal === "DISTRIBUTOR"
      ? [
          { href: "/distributor/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
          { href: "/distributor/orders", label: "Orders", icon: ShoppingCart, exact: false },
          { href: "/distributor/stock", label: "Stock", icon: Package, exact: false },
          { href: "/distributor/replenishment", label: "Restock", icon: Truck, exact: false },
        ]
    : isSales
      ? [
          { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
          { href: "/dashboard/follow-ups", label: "Follow-ups", icon: ListChecks, exact: false },
          { href: "/dashboard/leads", label: "Leads", icon: UserPlus, exact: false },
          { href: "/dashboard/clients", label: "Clients", icon: Building2, exact: false },
          { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: true },
        ]
      : isWarehouse
        ? [
            { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
            { href: "/dashboard/dispatch", label: "Dispatch", icon: Truck, exact: false },
            { href: "/dashboard/inventory", label: "Inventory", icon: AlertTriangle, exact: false },
            { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: true },
          ]
        : [
            { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
            { href: "/dashboard/clients", label: "Clients", icon: Building2, exact: false },
            { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: true },
          ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Primary navigation"
    >
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              active ? "text-brand" : "text-muted",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={22} strokeWidth={active ? 2.1 : 1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
