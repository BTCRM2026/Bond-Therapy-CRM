import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { LetterManagement } from "@/components/letter-management";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireSession } from "@/lib/session";

async function loadLetters() {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/letters`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: "ADMIN" }, cache: "no-store" });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export default async function LettersPage() {
  const session = await requireSession("ADMIN");
  const isAdmin = session.roles.some((role) => role.key === "SUPER_ADMIN");
  if (!isAdmin) redirect("/dashboard");

  const initial = await loadLetters();

  return (
    <DashboardShell
      userName={session.name}
      roleName={session.roles[0]?.name ?? "Super Admin"}
      roleKey={session.roles[0]?.key}
      headerTitle="Letters"
      headerSubtitle="Generate HR letters with the company letterhead"
      portal="ADMIN"
      canManageStaff={session.permissions.includes("admin.staff.manage")}
    >
      <LetterManagement initial={initial} />
    </DashboardShell>
  );
}
