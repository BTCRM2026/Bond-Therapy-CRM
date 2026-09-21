import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { PerformanceModule } from "@/components/performance-module";
import { requireSession } from "@/lib/session";

const SALES_ROLE_KEYS = new Set(["SALES_MANAGER", "SALES_EXECUTIVE"]);

export default async function PerformancePage() {
  const session = await requireSession("STAFF");
  if (!SALES_ROLE_KEYS.has(session.roles[0]?.key ?? "")) redirect("/dashboard/access-denied");
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Staff"} roleKey={session.roles[0]?.key} headerTitle="Performance" headerSubtitle="Target, revenue, visits and conversion" portal="STAFF"><PerformanceModule /></DashboardShell>;
}
