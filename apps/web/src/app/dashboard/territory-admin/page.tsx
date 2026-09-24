import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { TerritoryAdmin } from "@/components/territory-admin";
import { requireSession } from "@/lib/session";

export default async function TerritoryAdminPage() {
  const session = await requireSession("ADMIN");
  if (!session.roles.some((role) => role.key === "SUPER_ADMIN")) redirect("/dashboard/access-denied");
  return (
    <DashboardShell
      userName={session.name}
      roleName="Super Admin"
      roleKey={session.roles[0]?.key}
      headerTitle="Territory Management"
      headerSubtitle="Manage geographical hierarchy, staff responsibility and route coverage"
      portal="ADMIN"
      canManageStaff={session.permissions.includes("admin.staff.manage")}
    >
      <TerritoryAdmin />
    </DashboardShell>
  );
}
