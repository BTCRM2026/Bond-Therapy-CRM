import { DashboardShell } from "@/components/dashboard-shell";
import { requireAdminSession, serverApiFetch } from "@/lib/session";
import { AuditLogClient, type AuditLogRow } from "./audit-log-client";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const session = await requireAdminSession();
  const roleName = session.roles[0]?.name ?? "Authorized user";
  const { entity } = await searchParams;

  const query = entity ? `?entity=${encodeURIComponent(entity)}` : "";
  const res = await serverApiFetch(`/audit-log${query}`);
  const entries = res.ok ? ((await res.json()) as AuditLogRow[]) : [];

  return (
    <DashboardShell
      userName={session.name}
      roleName={roleName}
      headerTitle="Audit log"
      headerSubtitle="Every change made across the CRM, in order"
    >
      <AuditLogClient initialEntries={entries} activeEntity={entity ?? ""} />
    </DashboardShell>
  );
}
