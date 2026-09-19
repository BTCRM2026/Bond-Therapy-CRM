import { ArrowLeft, ShieldX } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/session";

export default async function AccessDeniedPage() {
  const session = await requireSession();
  const roleName = session.roles[0]?.name ?? "Authorized user";
  return (
    <DashboardShell
      userName={session.name}
      roleName={roleName}
      headerTitle="Access denied"
      headerSubtitle="This area is restricted"
      portal={session.portal}
      canManageStaff={session.permissions.includes("admin.staff.manage")}
    >
      <section className="mx-auto mt-8 max-w-lg rounded-xl border bg-white p-6 text-center shadow-[0_8px_24px_rgba(23,35,31,0.06)] sm:p-8">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-red-50 text-danger"><ShieldX size={22} /></span>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-danger">Restricted access</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">You cannot open this page</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">Your account does not include permission for this area. Contact your administrator if you believe this is incorrect.</p>
        <Link href="/dashboard" className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
      </section>
    </DashboardShell>
  );
}
