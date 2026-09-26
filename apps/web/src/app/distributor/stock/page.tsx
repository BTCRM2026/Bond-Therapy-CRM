import { cookies } from "next/headers";
import { DashboardShell } from "@/components/dashboard-shell";
import { DistributorStockView } from "@/components/distributor-stock-view";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireDistributorSession } from "@/lib/session";

async function loadJson(path: string) {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}${path}`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: "DISTRIBUTOR" }, cache: "no-store" });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export default async function DistributorStockPage() {
  const session = await requireDistributorSession();
  const [stock, movements] = await Promise.all([loadJson("/distributor-stock"), loadJson("/distributor-stock/movements")]);
  return (
    <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Distributor"} roleKey={session.roles[0]?.key} headerTitle="My Stock" headerSubtitle="Stock on hand and movement history" portal="DISTRIBUTOR">
      <DistributorStockView stock={stock} movements={movements} />
    </DashboardShell>
  );
}
