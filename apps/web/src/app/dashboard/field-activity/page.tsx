import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { FieldActivityAdmin } from "@/components/field-activity-admin";
import { requireSession } from "@/lib/session";

export default async function FieldActivityPage() {
  const session = await requireSession("ADMIN");
  if (!session.roles.some((role) => role.key === "SUPER_ADMIN")) redirect("/dashboard/access-denied");
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Super Admin"} roleKey={session.roles[0]?.key} headerTitle="Field Activity" headerSubtitle="GPS and photo-verified salon visits" portal="ADMIN" canManageStaff={session.permissions.includes("admin.staff.manage")}><FieldActivityAdmin /></DashboardShell>;
}
