import { DashboardShell } from "@/components/dashboard-shell";
import { ProfileSettings } from "@/components/profile-settings";
import { requireSession } from "@/lib/session";

export default async function SettingsPage() {
  const session = await requireSession();
  const roleName = session.roles[0]?.name ?? "Authorized user";

  return (
    <DashboardShell
      userName={session.name}
      roleName={roleName}
      headerTitle="Settings"
      headerSubtitle="Profile and account security"
      portal={session.portal}
      canManageStaff={session.permissions.includes("admin.staff.manage")}
    >
      <ProfileSettings
        initialProfile={{
          name: session.name,
          email: session.email,
          loginId: session.loginId,
          roleName,
          portal: session.portal,
          status: session.status,
          department: session.department,
          dataScope: session.dataScope,
          managerName: session.manager?.name ?? null,
          staffProfile: session.profile,
        }}
        canChangePassword={session.portal === "ADMIN"}
      />
    </DashboardShell>
  );
}
