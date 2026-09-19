import { DashboardShell } from "@/components/dashboard-shell";
import { requireAdminSession, serverApiFetch } from "@/lib/session";
import { DistributorsClient, type DistributorRow } from "./distributors-client";

export default async function DistributorsPage() {
  const session = await requireAdminSession();
  const roleName = session.roles[0]?.name ?? "Authorized user";

  const res = await serverApiFetch("/distributors");
  const distributors = res.ok ? ((await res.json()) as DistributorRow[]) : [];

  return (
    <DashboardShell
      userName={session.name}
      roleName={roleName}
      headerTitle="Distributor management"
      headerSubtitle="Onboard and track distributor accounts"
    >
      <DistributorsClient initialDistributors={distributors} />
    </DashboardShell>
  );
}
