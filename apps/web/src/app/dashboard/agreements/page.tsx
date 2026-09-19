import { DashboardShell } from "@/components/dashboard-shell";
import { requireAdminSession, serverApiFetch } from "@/lib/session";
import { AgreementsClient, type AgreementRow } from "./agreements-client";
import type { DistributorRow } from "../distributors/distributors-client";

export default async function AgreementsPage() {
  const session = await requireAdminSession();
  const roleName = session.roles[0]?.name ?? "Authorized user";

  const [agreementsRes, distributorsRes] = await Promise.all([
    serverApiFetch("/agreements"),
    serverApiFetch("/distributors"),
  ]);
  const agreements = agreementsRes.ok ? ((await agreementsRes.json()) as AgreementRow[]) : [];
  const distributors = distributorsRes.ok ? ((await distributorsRes.json()) as DistributorRow[]) : [];

  return (
    <DashboardShell
      userName={session.name}
      roleName={roleName}
      headerTitle="Agreements"
      headerSubtitle="Track contracts and expiries across parties"
    >
      <AgreementsClient initialAgreements={agreements} distributors={distributors} />
    </DashboardShell>
  );
}
