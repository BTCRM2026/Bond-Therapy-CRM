import { DashboardShell } from "@/components/dashboard-shell";
import { ProfileSettings } from "@/components/profile-settings";
import { requireDistributorSession } from "@/lib/session";

export default async function DistributorSettingsPage() {
  const session = await requireDistributorSession();
  const roleName = session.roles[0]?.name ?? "Distributor";

  return (
    <DashboardShell
      userName={session.name}
      roleName={roleName}
      roleKey={session.roles[0]?.key}
      headerTitle="Settings"
      headerSubtitle="Profile and account details"
      portal="DISTRIBUTOR"
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
        canChangePassword={false}
      />
    </DashboardShell>
  );
}
