import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { MyTeam } from "@/components/my-team";
import { requireSession } from "@/lib/session";
import { isStaffModuleEnabled } from "@/lib/staff-modules";

export default async function MyTeamPage() {
  const session = await requireSession("STAFF");
  if (!isStaffModuleEnabled("/dashboard/my-team")) redirect("/dashboard");
  if (!session.roles.some((role) => role.key === "SALES_MANAGER")) redirect("/dashboard/access-denied");
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Area Sales Manager"} roleKey={session.roles[0]?.key} headerTitle="My Team" headerSubtitle="Sales, attendance and daily reports of your team" portal="STAFF"><MyTeam /></DashboardShell>;
}
