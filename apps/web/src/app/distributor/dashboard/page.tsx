import { cookies } from "next/headers";
import { DashboardShell } from "@/components/dashboard-shell";
import { DistributorDashboard } from "@/components/distributor-dashboard";
import type { Order, OrderListResponse } from "@/components/orders-module";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireDistributorSession } from "@/lib/session";

async function loadJson(path: string) {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}${path}`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: "DISTRIBUTOR" }, cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export default async function DistributorDashboardPage() {
  const session = await requireDistributorSession();
  const ordersResponse = (await loadJson("/orders?pageSize=100")) as OrderListResponse | null;
  const orders: Order[] = ordersResponse?.items ?? [];

  return (
    <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Distributor"} roleKey={session.roles[0]?.key} headerTitle="Dashboard" headerSubtitle="Your fulfillment and stock at a glance" portal="DISTRIBUTOR">
      <DistributorDashboard orders={orders} />
    </DashboardShell>
  );
}
