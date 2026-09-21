import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Salon360 } from "@/components/salon-360";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireSession } from "@/lib/session";

async function loadClient(id: string) {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/clients/${encodeURIComponent(id)}`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: "STAFF" }, cache: "no-store" });
    if (response.status === 404) return undefined;
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

export default async function Salon360Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession("STAFF");
  const { id } = await params;
  const detail = await loadClient(id);
  if (!detail) notFound();
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Staff"} roleKey={session.roles[0]?.key} headerTitle="Salon 360" headerSubtitle="Complete relationship view" portal="STAFF"><Salon360 initial={detail} /></DashboardShell>;
}
