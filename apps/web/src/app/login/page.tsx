import { BarChart3, Boxes, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";

const capabilities = [
  { icon: BarChart3, label: "Sales and finance visibility" },
  { icon: Boxes, label: "Inventory and operations control" },
  { icon: ShieldCheck, label: "Secure role-based access" },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background p-3 sm:p-5 lg:p-6">
      <section className="mx-auto grid min-h-[calc(100vh-24px)] max-w-[1440px] overflow-hidden rounded-xl border bg-white lg:min-h-[calc(100vh-48px)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#eaf0ff_0%,#edf8f6_100%)] p-12 text-foreground lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgba(66,99,223,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(66,99,223,.08) 1px, transparent 1px)", backgroundSize: "52px 52px" }} />
          <div className="absolute -bottom-40 -right-28 size-[520px] rounded-full border border-brand/15" />
          <div className="absolute -bottom-20 -right-48 size-[520px] rounded-full border border-accent/15" />
          <div className="relative"><BrandMark /></div>
          <div className="relative max-w-xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand">One connected business workspace</p>
            <h1 className="max-w-lg text-[40px] font-semibold leading-[1.12] tracking-[-0.035em] xl:text-[46px]">Clarity across every team, order and decision.</h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-muted">Bond Therapy CRM brings sales, warehouse, accounts, people and distributor operations into one secure system.</p>
            <div className="mt-9 grid max-w-md gap-3">
              {capabilities.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-sm font-medium text-foreground/80">
                  <span className="grid size-8 place-items-center rounded-lg border border-brand/10 bg-white/75 text-brand"><Icon size={16} /></span>{label}
                </div>
              ))}
            </div>
          </div>
          <p className="relative text-xs text-muted">Bond Therapy CRM · Authorized access only</p>
        </div>

        <div className="flex min-h-[calc(100vh-24px)] flex-col bg-white px-6 py-7 sm:px-10 lg:min-h-0 lg:px-16 xl:px-24">
          <div className="flex items-center justify-between lg:justify-end">
            <div className="lg:hidden"><BrandMark /></div>
            <span className="rounded-full border bg-background px-3 py-1.5 text-[11px] font-medium text-muted">Secure portal</span>
          </div>
          <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12">
            <div className="mb-8 hidden lg:block"><BrandMark /></div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Bond Therapy CRM</p>
            <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.025em] text-foreground">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Enter your credentials to open your assigned workspace.</p>
            <LoginForm />
            <div className="mt-8 flex items-center gap-2 border-t pt-5 text-xs leading-5 text-subtle"><ShieldCheck size={15} className="shrink-0" />Your access is protected and activity is recorded for security.</div>
          </div>
          <p className="text-center text-[11px] text-subtle">© {new Date().getFullYear()} Bond Therapy. Internal business system.</p>
        </div>
      </section>
    </main>
  );
}
