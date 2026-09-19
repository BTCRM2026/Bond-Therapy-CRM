import { DashboardShell } from "@/components/dashboard-shell";
import { requireAdminSession, serverApiFetch } from "@/lib/session";
import { AccessManagementClient, type RoleRow } from "./access-management-client";

export default async function AccessManagementPage() {
  const session = await requireAdminSession();
  const roleName = session.roles[0]?.name ?? "Authorized user";

  const rolesRes = await serverApiFetch("/roles");
  const roles = rolesRes.ok ? ((await rolesRes.json()) as RoleRow[]) : [];

  return (
    <DashboardShell
      userName={session.name}
      roleName={roleName}
      headerTitle="Access management"
      headerSubtitle="Control which roles can sign in to the CRM"
    >
      <AccessManagementClient initialRoles={roles} />
    </DashboardShell>
  );
}
