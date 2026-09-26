"use client";

import { Activity, AlertTriangle, Award, Building2, CalendarClock, Clock3, FileCheck2, IndianRupee, LayoutDashboard, ListChecks, MapPin, Navigation, Package, ReceiptText, Settings, ShoppingCart, TrendingUp, Truck, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PortalType } from "@/lib/portal-types";
import { cn } from "@/lib/utils";

const SALES_ROLE_KEYS = new Set(["SALES_MANAGER", "SALES_EXECUTIVE"]);
const WAREHOUSE_ROLE_KEYS = new Set(["WAREHOUSE"]);

function staffGroups(roleKey?: string) {
  const isSales = roleKey ? SALES_ROLE_KEYS.has(roleKey) : false;
  const isWarehouse = roleKey ? WAREHOUSE_ROLE_KEYS.has(roleKey) : false;
  const isAccounts = roleKey === "ACCOUNTS_BILLING";
  const overview = [{ href: "/dashboard", label: "My workspace", icon: LayoutDashboard, exact: true }];
  const operations = isSales ? [
    { href: "/dashboard/follow-ups", label: "Follow-ups", icon: ListChecks, exact: false },
    { href: "/dashboard/leads", label: "Leads", icon: UserPlus, exact: false },
    { href: "/dashboard/clients", label: "Clients", icon: Building2, exact: false },
    { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart, exact: false },
    { href: "/dashboard/invoices", label: "Invoices", icon: ReceiptText, exact: false },
    { href: "/dashboard/products", label: "Products", icon: Package, exact: false },
    { href: "/dashboard/demos", label: "Demo Booking", icon: CalendarClock, exact: false },
  ] : isAccounts ? [
    { href: "/dashboard/orders", label: "Order approvals", icon: FileCheck2, exact: false },
    { href: "/dashboard/invoices", label: "Invoices & payments", icon: ReceiptText, exact: false },
    { href: "/dashboard/clients", label: "Customers", icon: Building2, exact: false },
    { href: "/dashboard/products", label: "Product master", icon: Package, exact: false },
  ] : [
    ...(isWarehouse ? [{ href: "/dashboard/dispatch", label: "Dispatch", icon: Truck, exact: false }] : []),
    { href: "/dashboard/clients", label: "Clients", icon: Building2, exact: false },
    ...(isWarehouse ? [{ href: "/dashboard/inventory", label: "Inventory", icon: AlertTriangle, exact: false }] : []),
  ];
  const planning = isSales ? [
    { href: "/dashboard/territory", label: "Territory", icon: MapPin, exact: false },
    { href: "/dashboard/route", label: "My Route", icon: Navigation, exact: false },
    { href: "/dashboard/performance", label: "Performance", icon: TrendingUp, exact: false },
    { href: "/dashboard/incentives", label: "Incentives", icon: IndianRupee, exact: false },
    { href: "/dashboard/my-performance", label: "My Performance", icon: Award, exact: false },
    { href: "/dashboard/attendance", label: "Attendance", icon: Clock3, exact: false },
  ] : [];
  return [
    { label: "Overview", items: overview },
    { label: isWarehouse ? "Warehouse" : isAccounts ? "Accounts & Billing" : "Sales & Clients", items: operations },
    ...(planning.length ? [{ label: "Planning & Performance", items: planning }] : []),
    { label: "Account", items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings, exact: true }] },
  ];
}

export function SidebarNav({ portal = "ADMIN", roleKey, canManageStaff = false, onNavigate }: { portal?: PortalType; roleKey?: string; canManageStaff?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const managementItems = [
    ...(canManageStaff ? [{ href: "/dashboard/staff", label: "Staff & Access", icon: UsersRound, exact: false }] : []),
    ...(roleKey === "SUPER_ADMIN" ? [{ href: "/dashboard/products", label: "Products", icon: Package, exact: false }] : []),
    ...(roleKey === "SUPER_ADMIN" ? [{ href: "/dashboard/orders", label: "Order approvals", icon: FileCheck2, exact: false }, { href: "/dashboard/invoices", label: "Invoices & payments", icon: ReceiptText, exact: false }] : []),
    ...(roleKey === "SUPER_ADMIN" ? [{ href: "/dashboard/territory-admin", label: "Territory Management", icon: MapPin, exact: false }] : []),
    ...(roleKey === "SUPER_ADMIN" ? [{ href: "/dashboard/targets", label: "Target & Performance", icon: TrendingUp, exact: false }] : []),
    ...(roleKey === "SUPER_ADMIN" ? [{ href: "/dashboard/incentive-rules", label: "Incentives", icon: IndianRupee, exact: false }] : []),
    ...(roleKey === "SUPER_ADMIN" ? [{ href: "/dashboard/target-incentive", label: "Target & Incentive", icon: Award, exact: false }] : []),
    ...(roleKey === "SUPER_ADMIN" ? [{ href: "/dashboard/attendance", label: "Attendance", icon: Clock3, exact: false }] : []),
    ...(roleKey === "SUPER_ADMIN" ? [{ href: "/dashboard/field-activity", label: "Field Activity", icon: Activity, exact: false }] : []),
    ...(roleKey === "SUPER_ADMIN" ? [{ href: "/dashboard/distributors", label: "Distributors", icon: Truck, exact: false }] : []),
  ];
  const distributorGroups = () => [
    { label: "Overview", items: [{ href: "/distributor/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
    { label: "Fulfillment", items: [
      { href: "/distributor/orders", label: "Orders", icon: ShoppingCart, exact: false },
      { href: "/distributor/stock", label: "My Stock", icon: Package, exact: false },
      { href: "/distributor/replenishment", label: "Replenishment", icon: Truck, exact: false },
    ] },
    { label: "Account", items: [{ href: "/distributor/settings", label: "Settings", icon: Settings, exact: true }] },
  ];
  const groups = portal === "ADMIN" ? [
    { label: "Overview", items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ] },
    ...(managementItems.length ? [{ label: "Management", items: managementItems }] : []),
    { label: "Account", items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings, exact: true }] },
  ] : portal === "DISTRIBUTOR" ? distributorGroups() : staffGroups(roleKey);
  return (
    <nav className="mt-[18px] min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden pr-1 text-sm [scrollbar-color:var(--subtle)_transparent] [scrollbar-width:thin]" aria-label="Portal navigation">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">{group.label}</p>
          <div className="space-y-1.5">
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
                    "flex h-10 items-center gap-2.5 rounded-[7px] px-2 text-xs font-medium transition-colors duration-150",
                    active
                      ? "bg-brand-soft font-semibold text-brand-dark"
                      : "text-muted hover:bg-brand-soft/50 hover:text-brand-dark",
                  )}
                >
                  <span className={cn("grid size-[30px] shrink-0 place-items-center rounded-md transition-colors", active ? "bg-brand text-white" : "text-muted")}>
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
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
