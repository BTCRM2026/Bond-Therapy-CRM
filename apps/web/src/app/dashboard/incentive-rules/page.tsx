import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { IncentiveRulesAdmin } from "@/components/incentive-rules-admin";
import { requireSession } from "@/lib/session";

export default async function IncentiveRulesPage() {
  const session = await requireSession("ADMIN");
  if (!session.roles.some((role) => role.key === "SUPER_ADMIN")) redirect("/dashboard/access-denied");
  return (
    <DashboardShell
      userName={session.name}
      roleName="Super Admin"
      roleKey={session.roles[0]?.key}
      headerTitle="Incentives"
      headerSubtitle="Commission rules, versions and approvals"
      portal="ADMIN"
      canManageStaff={session.permissions.includes("admin.staff.manage")}
    >
      <IncentiveRulesAdmin />
    </DashboardShell>
  );
}
