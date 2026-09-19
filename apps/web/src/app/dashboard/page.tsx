import { LockKeyhole, ShieldCheck, UserRoundCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/session";

const titleCase = (value?: string | null) => value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not assigned";

export default async function DashboardPage() {
  const session = await requireSession();
  const roleName = session.roles[0]?.name ?? "Authorized user";

  if (session.portal === "STAFF") {
    return (
      <DashboardShell
        userName={session.name}
        roleName={roleName}
        headerTitle="Dashboard"
        headerSubtitle={`${roleName} workspace overview`}
        portal="STAFF"
        canManageStaff={false}
      >
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Welcome back, {session.name}</h2><p className="mt-1.5 text-sm text-muted">Your secure account overview and assigned access.</p></div>
          <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-brand/15 bg-white px-3 py-2 text-xs font-semibold text-brand shadow-[0_1px_2px_rgba(23,35,31,0.03)]">
            <span className="size-2 rounded-full bg-[#27735f]" />{roleName}
          </span>
        </div>

        <div className="grid max-w-4xl gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
          <section className="rounded-xl border bg-white p-5 shadow-[0_3px_12px_rgba(23,35,31,0.04)] sm:p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><UserRoundCheck size={20} strokeWidth={1.8} /></span>
              <div><h2 className="text-base font-semibold text-foreground">Account access</h2><p className="mt-1 text-sm text-muted">Access is controlled by your administrator.</p></div>
            </div>
            <dl className="mt-5 grid gap-x-6 gap-y-4 border-t pt-5 text-xs sm:grid-cols-2">
              <div><dt className="text-muted">Role</dt><dd className="mt-1 font-semibold text-foreground">{roleName}</dd></div>
              <div><dt className="text-muted">Department</dt><dd className="mt-1 font-semibold text-foreground">{titleCase(session.department)}</dd></div>
              <div><dt className="text-muted">Record access</dt><dd className="mt-1 font-semibold text-foreground">{titleCase(session.dataScope)}</dd></div>
              <div><dt className="text-muted">Reporting manager</dt><dd className="mt-1 font-semibold text-foreground">{session.manager?.name ?? "Not assigned"}</dd></div>
            </dl>
          </section>

          <section className="rounded-xl bg-brand p-5 text-white shadow-[0_10px_24px_rgba(13,92,82,0.14)]">
            <LockKeyhole size={20} className="text-white/80" />
            <h2 className="mt-4 text-sm font-semibold">Secure Staff Portal</h2>
            <p className="mt-1.5 text-xs leading-5 text-white/70">This session works only on the Staff Portal. Use Settings to review and update your profile.</p>
          </section>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      userName={session.name}
      roleName={roleName}
      headerTitle="Dashboard"
      headerSubtitle={`${roleName} administration overview`}
      canManageStaff={session.permissions.includes("admin.staff.manage")}
    >
      <div className="mb-6"><h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Welcome back, {session.name}</h2><p className="mt-1.5 text-sm text-muted">Your focused administration workspace.</p></div>
      <section className="max-w-2xl rounded-xl border bg-white p-5 shadow-[0_3px_12px_rgba(23,35,31,0.04)] sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <ShieldCheck size={20} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Administration workspace</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted">This dashboard is restricted to your {roleName} session and currently includes only approved access.</p>
          </div>
        </div>
        <dl className="mt-5 grid gap-3 border-t pt-5 text-xs sm:grid-cols-3">
          <div><dt className="text-muted">Portal</dt><dd className="mt-1 font-semibold text-foreground">Administration</dd></div>
          <div><dt className="text-muted">Role</dt><dd className="mt-1 font-semibold text-foreground">{roleName}</dd></div>
          <div><dt className="text-muted">Session</dt><dd className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[#27735f]"><span className="size-1.5 rounded-full bg-[#27735f]" />Protected</dd></div>
        </dl>
      </section>
    </DashboardShell>
  );
}
