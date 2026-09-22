import { DashboardShell } from "@/components/dashboard-shell";
import { ProfileSettings } from "@/components/profile-settings";
import { requireSession } from "@/lib/session";
import { cookies } from "next/headers";
import { BillingSettings, type BillingSettingsData } from "@/components/billing-settings";
import { PORTAL_HEADER } from "@/lib/portal";

async function loadBillingSettings() {
  try { const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/billing/settings`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: "ADMIN" }, cache: "no-store" }); return response.ok ? await response.json() as BillingSettingsData : null; } catch { return null; }
}

export default async function SettingsPage() {
  const session = await requireSession();
  const roleName = session.roles[0]?.name ?? "Authorized user";
  const canManageBilling = session.portal === "ADMIN" && session.roles.some((role) => role.key === "SUPER_ADMIN");
  const billingSettings = canManageBilling ? await loadBillingSettings() : null;

  return (
    <DashboardShell
      userName={session.name}
      roleName={roleName}
      roleKey={session.roles[0]?.key}
      headerTitle="Settings"
      headerSubtitle={canManageBilling ? "Profile, security, and company-wide billing controls" : "Profile and account security"}
      portal={session.portal}
      canManageStaff={session.permissions.includes("admin.staff.manage")}
    >
      <div className="space-y-5"><ProfileSettings
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
      />{canManageBilling && <BillingSettings initial={billingSettings} />}</div>
    </DashboardShell>
  );
}
