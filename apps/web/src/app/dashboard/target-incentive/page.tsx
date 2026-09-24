import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { TargetIncentiveAdmin } from "@/components/target-incentive-admin";
import { requireSession } from "@/lib/session";

export default async function TargetIncentivePage() {
  const session = await requireSession("ADMIN");
  if (!session.roles.some((role) => role.key === "SUPER_ADMIN")) redirect("/dashboard/access-denied");
  return (
    <DashboardShell
      userName={session.name}
      roleName="Super Admin"
      roleKey={session.roles[0]?.key}
      headerTitle="Target & Incentive"
      headerSubtitle="Assign annual sales targets and achievement-based incentives"
      portal="ADMIN"
      canManageStaff={session.permissions.includes("admin.staff.manage")}
    >
      <TargetIncentiveAdmin />
    </DashboardShell>
  );
}
