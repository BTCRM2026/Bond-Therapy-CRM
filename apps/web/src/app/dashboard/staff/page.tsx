import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { StaffManagement, type StaffDirectory } from "@/components/staff-management";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireSession } from "@/lib/session";

async function loadDirectory() {
  try {
    const cookieStore = await cookies();
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/users`, {
      headers: { cookie: cookieStore.toString(), [PORTAL_HEADER]: "ADMIN" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json() as StaffDirectory;
  } catch {
    return null;
  }
}

export default async function StaffPage() {
  const session = await requireSession("ADMIN");
  if (!session.roles.some((role) => role.key === "SUPER_ADMIN")) redirect("/dashboard/access-denied");
  const directory = await loadDirectory();
  return (
    <DashboardShell
      userName={session.name}
      roleName="Super Admin"
      headerTitle="Staff & Access"
      headerSubtitle="Manage portal accounts and permissions"
      portal="ADMIN"
      canManageStaff
    >
      <StaffManagement initialDirectory={directory} />
    </DashboardShell>
  );
}
