import { DashboardShell } from "@/components/dashboard-shell";
import { MyLettersModule } from "@/components/my-letters-module";
import { requireSession } from "@/lib/session";

export default async function MyLettersPage() {
  const session = await requireSession("STAFF");
  return (
    <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Staff"} roleKey={session.roles[0]?.key} headerTitle="My Letters" headerSubtitle="Official letters issued to you by the company" portal="STAFF">
      <MyLettersModule />
    </DashboardShell>
  );
}
