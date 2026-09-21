import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { LeadsModule, type LeadListResponse } from "@/components/leads-module";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireSession } from "@/lib/session";

const SALES_ROLE_KEYS = new Set(["SALES_MANAGER", "SALES_EXECUTIVE"]);

async function loadLeads() {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/leads?page=1&pageSize=20`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: "STAFF" }, cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as LeadListResponse;
  } catch { return null; }
}

export default async function LeadsPage() {
  const session = await requireSession("STAFF");
  if (!SALES_ROLE_KEYS.has(session.roles[0]?.key ?? "")) redirect("/dashboard/access-denied");
  const initial = await loadLeads();
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Staff"} roleKey={session.roles[0]?.key} headerTitle="Leads" headerSubtitle="Track enquiries from first contact to conversion" portal="STAFF"><LeadsModule initial={initial} /></DashboardShell>;
}
