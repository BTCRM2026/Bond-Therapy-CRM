import { redirect } from "next/navigation";
import { DailyReportModule } from "@/components/daily-report-module";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/session";

const SALES_ROLE_KEYS = new Set(["SALES_MANAGER", "SALES_EXECUTIVE"]);

export default async function DailyReportPage() {
  const session = await requireSession("STAFF");
  if (!SALES_ROLE_KEYS.has(session.roles[0]?.key ?? "")) redirect("/dashboard/access-denied");
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Sales"} roleKey={session.roles[0]?.key} headerTitle="Daily Report" headerSubtitle="Today’s calls and tomorrow’s visit plan" portal="STAFF"><DailyReportModule /></DashboardShell>;
}
