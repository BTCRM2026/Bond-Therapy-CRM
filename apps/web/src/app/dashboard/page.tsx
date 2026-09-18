import Link from "next/link";
import { Activity, Bell, FileSignature, ShieldCheck, Truck, Users } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatRow } from "@/components/ui/stat-row";
import { requireSession, serverApiFetch } from "@/lib/session";

type UsersSummary = Array<{ status: string }>;
type DistributorsSummary = Array<{ status: string }>;
type AgreementsSummary = Array<{ status: string }>;
type NotificationsSummary = Array<{ isRead: boolean }>;

const QUICK_LINKS = [
  { href: "/dashboard/team", label: "Team management", description: "Create accounts and assign roles", icon: Users },
  { href: "/dashboard/access", label: "Access management", description: "Enable or disable portal roles", icon: ShieldCheck },
  { href: "/dashboard/distributors", label: "Distributor management", description: "Track distributor onboarding", icon: Truck },
  { href: "/dashboard/agreements", label: "Agreements", description: "Monitor contract expiries", icon: FileSignature },
  { href: "/dashboard/notifications", label: "Notifications", description: "Review system alerts", icon: Bell },
  { href: "/dashboard/audit-log", label: "Audit log", description: "See every change, in order", icon: Activity },
];

export default async function DashboardPage() {
  const session = await requireSession();
  const roleName = session.roles[0]?.name ?? "Authorized user";

  const [usersRes, distributorsRes, agreementsRes, notificationsRes] = await Promise.all([
    serverApiFetch("/users"),
    serverApiFetch("/distributors"),
    serverApiFetch("/agreements"),
    serverApiFetch("/notifications"),
  ]);
  const users = usersRes.ok ? ((await usersRes.json()) as UsersSummary) : [];
  const distributors = distributorsRes.ok ? ((await distributorsRes.json()) as DistributorsSummary) : [];
  const agreements = agreementsRes.ok ? ((await agreementsRes.json()) as AgreementsSummary) : [];
  const notifications = notificationsRes.ok ? ((await notificationsRes.json()) as NotificationsSummary) : [];

  const stats = [
    { label: "Team accounts", value: users.length },
    { label: "Distributors", value: distributors.length },
    { label: "Active agreements", value: agreements.filter((a) => a.status === "ACTIVE").length },
    { label: "Unread alerts", value: notifications.filter((n) => !n.isRead).length },
  ];

  return (
    <DashboardShell
      userName={session.name}
      roleName={roleName}
      headerTitle={`${roleName} workspace`}
      headerSubtitle="Secure business overview"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome, {session.name}</h1>
        <p className="mt-1.5 text-sm text-muted">Here is what is happening across the business right now.</p>
      </div>

      <StatRow stats={stats} className="mb-6" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {QUICK_LINKS.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-3 rounded-xl border bg-white p-5 transition-colors hover:border-brand/40 hover:bg-brand-soft/30"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon size={19} /></span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{label}</h2>
              <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </DashboardShell>
  );
}
