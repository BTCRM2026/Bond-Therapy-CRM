import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { DistributorManagement } from "@/components/distributor-management";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireSession } from "@/lib/session";

async function loadJson(path: string) {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}${path}`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: "ADMIN" }, cache: "no-store" });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export default async function DistributorsPage() {
  const session = await requireSession("ADMIN");
  const isAdmin = session.roles.some((role) => role.key === "SUPER_ADMIN");
  if (!isAdmin) redirect("/dashboard");

  const [distributors, requests] = await Promise.all([loadJson("/distributors"), loadJson("/replenishment")]);

  return (
    <DashboardShell
      userName={session.name}
      roleName={session.roles[0]?.name ?? "Super Admin"}
      roleKey={session.roles[0]?.key}
      headerTitle="Distributors"
      headerSubtitle="Regional stockists, their portal logins, and replenishment"
      portal="ADMIN"
      canManageStaff={session.permissions.includes("admin.staff.manage")}
    >
      <DistributorManagement initialDistributors={distributors} initialRequests={requests} />
    </DashboardShell>
  );
}
