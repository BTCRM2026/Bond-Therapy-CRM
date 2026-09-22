import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { InvoicesModule, type InvoiceListResponse } from "@/components/invoices-module";
import { PORTAL_HEADER } from "@/lib/portal";
import { requireSession } from "@/lib/session";

const ALLOWED = new Set(["SALES_MANAGER", "SALES_EXECUTIVE", "ACCOUNTS_BILLING", "SUPER_ADMIN"]);
async function load(portal: "ADMIN" | "STAFF") { try { const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/billing/invoices?page=1&pageSize=20`, { headers: { cookie: (await cookies()).toString(), [PORTAL_HEADER]: portal }, cache: "no-store" }); return response.ok ? await response.json() as InvoiceListResponse : null; } catch { return null; } }
export default async function InvoicesPage() { const session = await requireSession(); const roleKey = session.roles[0]?.key ?? ""; if (!ALLOWED.has(roleKey)) redirect("/dashboard/access-denied"); const initial = await load(session.portal as "ADMIN" | "STAFF"); const canManage = roleKey === "ACCOUNTS_BILLING" || roleKey === "SUPER_ADMIN"; return <DashboardShell userName={session.name} roleName={session.roles[0]?.name ?? "User"} roleKey={roleKey} portal={session.portal} canManageStaff={session.permissions.includes("admin.staff.manage")} headerTitle="Invoices & payments" headerSubtitle={canManage ? "Issue professional tax invoices and track every payment" : "View approved customer invoices and payment status"}><InvoicesModule initial={initial} canManage={canManage} /></DashboardShell>; }
