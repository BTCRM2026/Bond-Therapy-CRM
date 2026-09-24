import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { TerritoryModule } from "@/components/territory-module";
import { requireSession } from "@/lib/session";

const SALES_ROLE_KEYS = new Set(["SALES_MANAGER", "SALES_EXECUTIVE"]);

export default async function TerritoryPage() {
  const session = await requireSession("STAFF");
  if (!SALES_ROLE_KEYS.has(session.roles[0]?.key ?? "")) redirect("/dashboard/access-denied");
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Staff"} roleKey={session.roles[0]?.key} headerTitle="My Territory" headerSubtitle="View your geographical responsibility and allocation history" portal="STAFF"><TerritoryModule /></DashboardShell>;
}
