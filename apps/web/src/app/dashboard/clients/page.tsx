import { DashboardShell } from "@/components/dashboard-shell";
import { ClientsModule, type ClientListResponse } from "@/components/clients-module";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireSession } from "@/lib/session";
import { cookies } from "next/headers";

async function loadClients() {
  try {
    const portal = "STAFF";
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/clients?page=1&pageSize=20`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: portal }, cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as ClientListResponse;
  } catch { return null; }
}

export default async function ClientsPage() {
  const session = await requireSession("STAFF");
  const initial = await loadClients();
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Staff"} roleKey={session.roles[0]?.key} headerTitle="Clients" headerSubtitle="Your assigned salon relationships" portal="STAFF"><ClientsModule initial={initial} /></DashboardShell>;
}
