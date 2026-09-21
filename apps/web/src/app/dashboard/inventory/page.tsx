import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { InventoryModule } from "@/components/inventory-module";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireSession } from "@/lib/session";

const WAREHOUSE_ROLE_KEYS = new Set(["WAREHOUSE"]);

async function loadProducts() {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/products?page=1&pageSize=100`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: "STAFF" }, cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

export default async function InventoryPage() {
  const session = await requireSession("STAFF");
  if (!WAREHOUSE_ROLE_KEYS.has(session.roles[0]?.key ?? "")) redirect("/dashboard/access-denied");
  const initial = await loadProducts();
  return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "Staff"} roleKey={session.roles[0]?.key} headerTitle="Inventory" headerSubtitle="Stock levels, receiving and damage" portal="STAFF"><InventoryModule initial={initial} /></DashboardShell>;
}
