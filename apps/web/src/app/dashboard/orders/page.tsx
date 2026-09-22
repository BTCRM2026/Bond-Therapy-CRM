import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { OrdersModule, type OrderListResponse } from "@/components/orders-module";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireSession } from "@/lib/session";

const ORDER_ROLE_KEYS = new Set(["SALES_MANAGER", "SALES_EXECUTIVE", "ACCOUNTS_BILLING", "SUPER_ADMIN"]);

async function loadOrders(portal: "ADMIN" | "STAFF") {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/orders?page=1&pageSize=20`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: portal }, cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as OrderListResponse;
  } catch { return null; }
}

export default async function OrdersPage() {
  const session = await requireSession();
  const roleKey = session.roles[0]?.key ?? "";
  if (!ORDER_ROLE_KEYS.has(roleKey)) redirect("/dashboard/access-denied");
  const initial = await loadOrders(session.portal as "ADMIN" | "STAFF");
  const accounts = roleKey === "ACCOUNTS_BILLING" || roleKey === "SUPER_ADMIN";
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Staff"} roleKey={roleKey} headerTitle={accounts ? "Order approvals" : "Order drafts"} headerSubtitle={accounts ? "Review pricing and tax, approve drafts, and generate invoices" : "Prepare customer orders and submit them to Accounts"} portal={session.portal} canManageStaff={session.permissions.includes("admin.staff.manage")}><OrdersModule initial={initial} roleKey={roleKey} /></DashboardShell>;
}
