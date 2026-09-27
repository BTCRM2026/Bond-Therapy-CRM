import { DashboardShell } from "@/components/dashboard-shell";
import { ClientsModule, type ClientListResponse } from "@/components/clients-module";
import { PORTAL_HEADER, requestPortal } from "@/lib/portal";
import { requireSession } from "@/lib/session";
import { cookies } from "next/headers";

async function loadClients(portal: "ADMIN" | "STAFF") {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/clients?page=1&pageSize=20`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: portal }, cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as ClientListResponse;
  } catch { return null; }
}

export default async function ClientsPage() {
  const portal = await requestPortal();
  if (portal !== "ADMIN" && portal !== "STAFF") return null;
  const session = await requireSession(portal);
  const initial = await loadClients(portal);
  const admin = portal === "ADMIN";
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Staff"} roleKey={session.roles[0]?.key} headerTitle="Salon 360" headerSubtitle={admin ? "Every salon relationship, history and growth opportunity" : "Your assigned salon relationships"} portal={portal}><ClientsModule initial={initial} allSalons={admin} /></DashboardShell>;
}
