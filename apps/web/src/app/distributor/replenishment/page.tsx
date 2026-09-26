import { cookies } from "next/headers";
import { DashboardShell } from "@/components/dashboard-shell";
import { DistributorReplenishment, type ReplenishmentRequest } from "@/components/distributor-replenishment";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireDistributorSession } from "@/lib/session";

async function loadRequests() {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/replenishment`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: "DISTRIBUTOR" }, cache: "no-store" });
    if (!response.ok) return [];
    return (await response.json()) as ReplenishmentRequest[];
  } catch {
    return [];
  }
}

export default async function DistributorReplenishmentPage() {
  const session = await requireDistributorSession();
  const initial = await loadRequests();
  return (
    <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Distributor"} roleKey={session.roles[0]?.key} headerTitle="Replenishment" headerSubtitle="Request stock from Bond Therapy's central warehouse" portal="DISTRIBUTOR">
      <DistributorReplenishment initial={initial} roleKey={session.roles[0]?.key} />
    </DashboardShell>
  );
}
