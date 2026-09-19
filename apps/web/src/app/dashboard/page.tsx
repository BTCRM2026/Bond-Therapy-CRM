import { Boxes, Calculator, CalendarCheck, CheckCircle2, HeartHandshake, LockKeyhole, ShieldCheck, UserRoundCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/session";

const STAFF_WORKSPACES = [
  { permission: "staff.sales.access", label: "Sales", description: "Manage customer relationships and the complete sales cycle.", features: ["Leads and salons", "Visits and follow-ups", "Quotations and orders"], icon: HeartHandshake, tone: "bg-info-soft text-info" },
  { permission: "staff.accounts.access", label: "Accounts", description: "Keep billing, collections and credit activity under control.", features: ["Invoices and payments", "Ledgers and statements", "Credit control"], icon: Calculator, tone: "bg-accent-soft text-accent" },
  { permission: "staff.warehouse.access", label: "Warehouse", description: "Coordinate inventory and fulfilment from one workspace.", features: ["Inventory control", "Picking and packing", "Dispatch tracking"], icon: Boxes, tone: "bg-warning-soft text-warning" },
  { permission: "staff.hr.access", label: "Human Resources", description: "Manage people operations with controlled access.", features: ["Team records", "Attendance and leave", "Payroll inputs"], icon: UserRoundCheck, tone: "bg-magenta-soft text-magenta" },
  { permission: "staff.demo.access", label: "Demo Team", description: "Plan demos and hand qualified activity to Sales.", features: ["Demo schedules", "Training activity", "Sales handoff"], icon: CalendarCheck, tone: "bg-info-soft text-info" },
];

export default async function DashboardPage() {
  const session = await requireSession();
  const roleName = session.roles[0]?.name ?? "Authorized user";

  if (session.portal === "STAFF") {
    const workspaces = STAFF_WORKSPACES.filter((workspace) => session.permissions.includes(workspace.permission));
    return (
      <DashboardShell
        userName={session.name}
        roleName={roleName}
        headerTitle={`${roleName} workspace`}
        headerSubtitle="Your secure Staff Portal"
        portal="STAFF"
      >
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Staff workspace</p>
            <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.025em] text-foreground">Welcome back, {session.name}</h1>
            <p className="mt-1.5 text-sm text-muted">Everything available to your role, in one focused workspace.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-brand/10 bg-white px-3 py-2 text-xs font-semibold text-brand shadow-[0_1px_2px_rgba(23,32,51,0.03)]">
            <span className="size-2 rounded-full bg-[#17b26a]" />{roleName}
          </span>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.7fr)]">
          <section className="overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(23,32,51,0.025)]">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Your workspaces</h2>
                <p className="mt-1 text-xs text-muted">Only areas assigned to your role are shown.</p>
              </div>
              <span className="rounded-md bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">{workspaces.length} active</span>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {workspaces.map(({ permission, label, description, features, icon: Icon, tone }) => (
                <article key={permission} className={`rounded-xl border bg-[#fcfcfd] p-5 transition-colors hover:border-brand/25 hover:bg-white ${workspaces.length === 1 ? "md:col-span-2" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={20} strokeWidth={1.8} /></span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ecfdf3] px-2.5 py-1 text-[11px] font-semibold text-[#067647]"><CheckCircle2 size={12} /> Available</span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{label}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-muted">{description}</p>
                  <ul className={`mt-4 border-t pt-4 ${workspaces.length === 1 ? "grid gap-3 sm:grid-cols-3" : "space-y-2"}`}>
                    {features.map((feature) => <li key={feature} className="flex items-center gap-2 text-xs text-muted"><span className="size-1.5 rounded-full bg-brand/45" />{feature}</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-xl border bg-white p-5 shadow-[0_1px_2px_rgba(23,32,51,0.025)]">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><ShieldCheck size={18} /></span>
                <div><h2 className="text-sm font-semibold text-foreground">Access overview</h2><p className="mt-0.5 text-xs text-muted">Your current account scope</p></div>
              </div>
              <dl className="mt-5 divide-y text-xs">
                <div className="flex items-center justify-between py-3"><dt className="text-muted">Portal</dt><dd className="font-semibold text-foreground">Staff</dd></div>
                <div className="flex items-center justify-between py-3"><dt className="text-muted">Role</dt><dd className="font-semibold text-foreground">{roleName}</dd></div>
                <div className="flex items-center justify-between py-3"><dt className="text-muted">Workspaces</dt><dd className="font-semibold text-foreground">{workspaces.length}</dd></div>
                <div className="flex items-center justify-between py-3"><dt className="text-muted">Permissions</dt><dd className="font-semibold text-foreground">{session.permissions.length}</dd></div>
              </dl>
            </section>
            <section className="rounded-xl bg-brand p-5 text-white shadow-[0_10px_24px_rgba(23,27,114,0.15)]">
              <LockKeyhole size={20} className="text-white/80" />
              <h2 className="mt-4 text-sm font-semibold">Secure by default</h2>
              <p className="mt-1.5 text-xs leading-5 text-white/70">Your session is restricted to this Staff Portal and the workspaces assigned by an administrator.</p>
            </section>
          </aside>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      userName={session.name}
      roleName={roleName}
      headerTitle={`${roleName} workspace`}
      headerSubtitle="Secure administration dashboard"
    >
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Super Admin dashboard</p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.025em] text-foreground">Welcome back, {session.name}</h1>
        <p className="mt-1.5 text-sm text-muted">Your focused administration workspace.</p>
      </div>
      <section className="max-w-2xl rounded-xl border bg-white p-5 shadow-[0_1px_2px_rgba(23,32,51,0.025)] sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <ShieldCheck size={20} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Administration workspace</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted">This dashboard is restricted to your Super Admin session and is ready for the next approved module.</p>
          </div>
        </div>
        <dl className="mt-5 grid gap-3 border-t pt-5 text-xs sm:grid-cols-3">
          <div><dt className="text-muted">Portal</dt><dd className="mt-1 font-semibold text-foreground">Super Admin</dd></div>
          <div><dt className="text-muted">Role</dt><dd className="mt-1 font-semibold text-foreground">{roleName}</dd></div>
          <div><dt className="text-muted">Session</dt><dd className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[#067647]"><span className="size-1.5 rounded-full bg-[#17b26a]" />Protected</dd></div>
        </dl>
      </section>
    </DashboardShell>
  );
}
