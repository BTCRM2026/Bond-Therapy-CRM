"use client";

import { Activity, Bell, FileSignature, LayoutDashboard, ShieldCheck, Truck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/team", label: "Team management", icon: Users },
  { href: "/dashboard/access", label: "Access management", icon: ShieldCheck },
  { href: "/dashboard/distributors", label: "Distributors", icon: Truck },
  { href: "/dashboard/agreements", label: "Agreements", icon: FileSignature },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/audit-log", label: "Audit log", icon: Activity },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-8 space-y-1 text-sm">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 font-medium transition-colors",
              active ? "bg-brand-soft text-brand-dark ring-1 ring-brand/10" : "text-muted hover:bg-background hover:text-foreground",
            )}
          >
            <Icon size={17} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
