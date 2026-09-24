import { redirect } from "next/navigation";
import { AttendanceModule } from "@/components/attendance-module";
import { AttendanceAdmin } from "@/components/attendance-admin";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/session";

const SALES_ROLE_KEYS = new Set(["SALES_MANAGER", "SALES_EXECUTIVE"]);

export default async function AttendancePage() {
  const session = await requireSession();
  const isAdmin = session.portal === "ADMIN" && session.roles.some((role) => role.key === "SUPER_ADMIN");
  if (!isAdmin && !SALES_ROLE_KEYS.has(session.roles[0]?.key ?? "")) redirect("/dashboard/access-denied");
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? (isAdmin ? "Super Admin" : "Staff")} roleKey={session.roles[0]?.key} headerTitle="Attendance" headerSubtitle={isAdmin ? "Attendance, leave and correction oversight" : "Punch in, punch out and monthly report"} portal={session.portal} canManageStaff={isAdmin && session.permissions.includes("admin.staff.manage")}>{isAdmin ? <AttendanceAdmin /> : <AttendanceModule />}</DashboardShell>;
}
