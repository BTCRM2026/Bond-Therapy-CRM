import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { SuperStockistNetwork, type NetworkDistributor } from "@/components/super-stockist-network";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireDistributorSession } from "@/lib/session";

export default async function NetworkPage() {
  const session = await requireDistributorSession();
  if (session.distributionPartner?.partnerType !== "SUPER_STOCKIST") redirect("/distributor/dashboard");
  let initial: NetworkDistributor[] = [];
  try { const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/distributors/me/network`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: "DISTRIBUTOR" }, cache: "no-store" }); if (response.ok) initial = await response.json(); } catch {}
  return <DashboardShell userName={session.name} roleName="Super Stockist" roleKey={session.roles[0]?.key} distributionPartnerType="SUPER_STOCKIST" headerTitle="Distributor network" headerSubtitle="Assigned partners, inventory position and replenishment demand" portal="DISTRIBUTOR"><SuperStockistNetwork initial={initial} /></DashboardShell>;
}
