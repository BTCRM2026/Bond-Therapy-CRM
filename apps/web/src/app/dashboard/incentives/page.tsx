import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { IncentivesModule } from "@/components/incentives-module";
import { requireSession } from "@/lib/session";

const SALES_ROLE_KEYS = new Set(["SALES_MANAGER", "SALES_EXECUTIVE"]);

export default async function IncentivesPage() {
  const session = await requireSession("STAFF");
  const roleKey = session.roles[0]?.key ?? "";
  if (!SALES_ROLE_KEYS.has(roleKey)) redirect("/dashboard/access-denied");
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Staff"} roleKey={roleKey} headerTitle="Incentives" headerSubtitle="Commission estimate and approval status" portal="STAFF"><IncentivesModule isManager={roleKey === "SALES_MANAGER"} /></DashboardShell>;
}
