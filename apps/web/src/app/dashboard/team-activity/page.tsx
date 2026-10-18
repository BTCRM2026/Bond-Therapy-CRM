import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { TeamActivity } from "@/components/team-activity";
import { requireSession } from "@/lib/session";

export default async function TeamActivityPage() {
  const session = await requireSession("ADMIN");
  if (!session.roles.some((role) => role.key === "SUPER_ADMIN")) redirect("/dashboard/access-denied");
  return (
    <DashboardShell userName={session.name} roleName="Super Admin" roleKey={session.roles[0]?.key} headerTitle="Team Activity" headerSubtitle="Attendance, visits, daily reports, leads and follow-ups of your sales team" portal="ADMIN" canManageStaff={session.permissions.includes("admin.staff.manage")}>
      <TeamActivity />
    </DashboardShell>
  );
}
