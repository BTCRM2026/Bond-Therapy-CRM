import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Activity, LayoutDashboard, ShieldCheck, Users } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LogoutButton } from "@/components/logout-button";

type SessionUser = {
  name: string;
  email: string;
  roles: Array<{ key: string; name: string }>;
  dashboardPath: string;
};

async function getSession() {
  const cookieStore = await cookies();
  let response: Response;
  try {
    response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/auth/session`, {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
    });
  } catch {
    redirect("/login");
  }
  if (!response.ok) redirect("/login");
  return (await response.json()) as SessionUser;
}

export default async function DashboardPage() {
  const user = await getSession();
  const roleName = user.roles[0]?.name ?? "Authorized user";
  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r bg-white p-5 lg:flex lg:flex-col">
        <BrandMark />
        <nav className="mt-8 space-y-1 text-sm">
          <div className="flex h-10 items-center gap-3 rounded-lg bg-brand-soft px-3 font-medium text-brand-dark"><LayoutDashboard size={17} />Overview</div>
          <div className="flex h-10 items-center gap-3 rounded-lg px-3 text-muted"><Users size={17} />Team management</div>
          <div className="flex h-10 items-center gap-3 rounded-lg px-3 text-muted"><Activity size={17} />Activity</div>
        </nav>
        <div className="mt-auto rounded-lg border bg-background p-3"><p className="text-xs font-semibold text-foreground">{user.name}</p><p className="mt-1 truncate text-[11px] text-muted">{roleName}</p></div>
      </aside>
      <section>
        <header className="flex h-16 items-center justify-between border-b bg-white px-5 sm:px-6">
          <div className="lg:hidden"><BrandMark /></div>
          <div className="hidden lg:block"><p className="text-sm font-semibold">{roleName} workspace</p><p className="text-xs text-muted">Secure business overview</p></div>
          <LogoutButton />
        </header>
        <div className="p-5 sm:p-6">
          <div className="mb-6"><h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name}</h1><p className="mt-1.5 text-sm text-muted">Your {roleName} access has been verified successfully.</p></div>
          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><ShieldCheck size={20} /></span>
              <div><h2 className="text-base font-semibold">Portal foundation is ready</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Authentication, role assignment, protected sessions and database-driven dashboard routing are active. Business dashboard modules will be added step by step.</p></div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
