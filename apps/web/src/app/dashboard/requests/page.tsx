import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequestsModule } from "@/components/requests-module";
import { requireSession } from "@/lib/session";

export default async function RequestsPage() {
  const session = await requireSession();
  const isAdmin = session.portal === "ADMIN" && session.roles.some((role) => role.key === "SUPER_ADMIN");
  if (!isAdmin && session.portal !== "STAFF") redirect("/dashboard/access-denied");
  return (
    <DashboardShell
      userName={session.name}
      roleName={session.roles[0]?.name ?? (isAdmin ? "Super Admin" : "Staff")}
      roleKey={session.roles[0]?.key}
      headerTitle="Requests"
      headerSubtitle={isAdmin ? "Review and decide on staff requests" : "Ask for approvals, schemes and support"}
      portal={session.portal}
      canManageStaff={isAdmin && session.permissions.includes("admin.staff.manage")}
    >
      <RequestsModule admin={isAdmin} />
    </DashboardShell>
  );
}
