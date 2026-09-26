import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { DistributorTeam } from "@/components/distributor-team";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireDistributorSession } from "@/lib/session";

async function loadTeam() {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/distributors/me/users`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: "DISTRIBUTOR" }, cache: "no-store" });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export default async function DistributorTeamPage() {
  const session = await requireDistributorSession();
  if (session.roles[0]?.key !== "DISTRIBUTOR_OWNER") redirect("/distributor/dashboard");
  const initial = await loadTeam();
  return (
    <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Owner"} roleKey={session.roles[0]?.key} headerTitle="Team" headerSubtitle="Manage who has access to your distributor portal" portal="DISTRIBUTOR">
      <DistributorTeam initial={initial} />
    </DashboardShell>
  );
}
