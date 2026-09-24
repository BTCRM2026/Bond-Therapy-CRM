import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { MyPerformance } from "@/components/my-performance";
import { requireSession } from "@/lib/session";

const SALES_ROLE_KEYS = new Set(["SALES_MANAGER", "SALES_EXECUTIVE"]);

export default async function MyPerformancePage() {
  const session = await requireSession("STAFF");
  if (!SALES_ROLE_KEYS.has(session.roles[0]?.key ?? "")) redirect("/dashboard/access-denied");
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Staff"} roleKey={session.roles[0]?.key} headerTitle="My Performance" headerSubtitle="Annual target progress and incentive status" portal="STAFF"><MyPerformance /></DashboardShell>;
}
