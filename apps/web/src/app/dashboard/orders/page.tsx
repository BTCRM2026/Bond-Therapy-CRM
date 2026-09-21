import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { OrdersModule, type OrderListResponse } from "@/components/orders-module";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireSession } from "@/lib/session";

const SALES_ROLE_KEYS = new Set(["SALES_MANAGER", "SALES_EXECUTIVE"]);

async function loadOrders() {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/orders?page=1&pageSize=20`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: "STAFF" }, cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as OrderListResponse;
  } catch { return null; }
}

export default async function OrdersPage() {
  const session = await requireSession("STAFF");
  if (!SALES_ROLE_KEYS.has(session.roles[0]?.key ?? "")) redirect("/dashboard/access-denied");
  const initial = await loadOrders();
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Staff"} roleKey={session.roles[0]?.key} headerTitle="Orders" headerSubtitle="Booked orders and stock-checked quotations" portal="STAFF"><OrdersModule initial={initial} /></DashboardShell>;
}
