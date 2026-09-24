import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { TargetsAdmin } from "@/components/targets-admin";
import { requireSession } from "@/lib/session";

export default async function TargetsPage() {
  const session = await requireSession("ADMIN");
  if (!session.roles.some((role) => role.key === "SUPER_ADMIN")) redirect("/dashboard/access-denied");
  return (
    <DashboardShell
      userName={session.name}
      roleName="Super Admin"
      roleKey={session.roles[0]?.key}
      headerTitle="Target & Performance"
      headerSubtitle="Set targets and track company-wide performance"
      portal="ADMIN"
      canManageStaff={session.permissions.includes("admin.staff.manage")}
    >
      <TargetsAdmin />
    </DashboardShell>
  );
}
