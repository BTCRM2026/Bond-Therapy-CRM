import { DashboardShell } from "@/components/dashboard-shell";
import { requireSession, serverApiFetch } from "@/lib/session";
import { TeamManagementClient, type RoleOption, type UserRow } from "./team-management-client";

export default async function TeamManagementPage() {
  const session = await requireSession();
  const roleName = session.roles[0]?.name ?? "Authorized user";

  const [usersRes, rolesRes] = await Promise.all([
    serverApiFetch("/users"),
    serverApiFetch("/roles"),
  ]);
  const users = usersRes.ok ? ((await usersRes.json()) as UserRow[]) : [];
  const roles = rolesRes.ok ? ((await rolesRes.json()) as RoleOption[]) : [];

  return (
    <DashboardShell
      userName={session.name}
      roleName={roleName}
      headerTitle="Team management"
      headerSubtitle="Create accounts, assign roles and manage access"
    >
      <TeamManagementClient initialUsers={users} roles={roles} />
    </DashboardShell>
  );
}
