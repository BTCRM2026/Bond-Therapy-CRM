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
    >
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Account settings</p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.025em] text-foreground">Profile</h1>
        <p className="mt-1.5 text-sm text-muted">Manage your account details and password.</p>
      </div>
      <ProfileSettings
        initialProfile={{
          name: session.name,
          email: session.email,
          loginId: session.loginId,
          roleName,
          portal: session.portal,
          status: session.status,
        }}
      />
    </DashboardShell>
  );
}
