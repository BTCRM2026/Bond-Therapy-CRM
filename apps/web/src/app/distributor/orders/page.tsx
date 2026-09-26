import { cookies } from "next/headers";
import { DashboardShell } from "@/components/dashboard-shell";
import { DistributorOrders } from "@/components/distributor-orders";
import type { OrderListResponse } from "@/components/orders-module";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireDistributorSession } from "@/lib/session";

async function loadOrders() {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/orders?pageSize=100`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: "DISTRIBUTOR" }, cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as OrderListResponse;
  } catch {
    return null;
  }
}

export default async function DistributorOrdersPage() {
  const session = await requireDistributorSession();
  const initial = await loadOrders();
  return (
    <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Distributor"} roleKey={session.roles[0]?.key} headerTitle="Orders" headerSubtitle="Fulfill orders routed to you from your stock" portal="DISTRIBUTOR">
      <DistributorOrders initial={initial} />
    </DashboardShell>
  );
}
