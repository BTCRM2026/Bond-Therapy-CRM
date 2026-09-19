import { DashboardShell } from "@/components/dashboard-shell";
import { requireAdminSession, serverApiFetch } from "@/lib/session";
import { NotificationsClient, type NotificationRow } from "./notifications-client";

export default async function NotificationsPage() {
  const session = await requireAdminSession();
  const roleName = session.roles[0]?.name ?? "Authorized user";

  const res = await serverApiFetch("/notifications");
  const notifications = res.ok ? ((await res.json()) as NotificationRow[]) : [];

  return (
    <DashboardShell
      userName={session.name}
      roleName={roleName}
      headerTitle="Notifications"
      headerSubtitle="System alerts that need your attention"
    >
      <NotificationsClient initialNotifications={notifications} />
    </DashboardShell>
  );
}
