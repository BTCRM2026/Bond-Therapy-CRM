import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { LeaveAdmin } from "@/components/leave-admin";
import { LeaveStaff } from "@/components/leave-staff";
import { requireSession } from "@/lib/session";

export default async function LeavePage() {
  const session = await requireSession();
  const isAdmin = session.portal === "ADMIN" && session.roles.some((role) => role.key === "SUPER_ADMIN");
  if (!isAdmin && session.portal !== "STAFF") redirect("/dashboard/access-denied");
  return (
    <DashboardShell
      userName={session.name}
      roleName={session.roles[0]?.name ?? (isAdmin ? "Super Admin" : "Staff")}
      roleKey={session.roles[0]?.key}
      headerTitle="Leave"
      headerSubtitle={isAdmin ? "Approve leave and track salary deductions" : "Apply for leave and track your balance"}
      portal={session.portal}
      canManageStaff={isAdmin && session.permissions.includes("admin.staff.manage")}
    >
      {isAdmin ? <LeaveAdmin /> : <LeaveStaff />}
    </DashboardShell>
  );
}
