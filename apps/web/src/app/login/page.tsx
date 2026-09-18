import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex h-svh items-center justify-center overflow-hidden bg-background p-3 sm:p-5 lg:p-8">
      <section className="grid h-[calc(100svh-24px)] min-h-0 w-full max-w-[1120px] overflow-hidden rounded-xl border bg-white shadow-[0_24px_60px_rgba(60,41,42,0.10),0_4px_16px_rgba(60,41,42,0.05)] sm:h-[calc(100svh-40px)] lg:h-[calc(100svh-64px)] lg:max-h-[720px] lg:min-h-[620px] lg:grid-cols-[0.92fr_1.08fr] lg:gap-4 lg:p-4">
        <div
          className="relative hidden overflow-hidden rounded-lg bg-cover bg-center p-8 lg:flex lg:flex-col lg:justify-between"
          style={{ backgroundImage: "url('/brand/login-product.jpeg')" }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(25,17,17,.36)_0%,rgba(40,20,21,.44)_48%,rgba(72,25,29,.84)_100%)]" />
          <BrandMark className="relative w-[170px] brightness-0 invert" />
          <div className="relative max-w-[430px] pb-1 text-white">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">One connected business workspace</p>
            <h1 className="text-[32px] font-semibold leading-[1.14] tracking-[-0.035em] xl:text-[36px]">Clarity across every team, order and decision.</h1>
            <p className="mt-4 max-w-[470px] text-sm leading-6 text-white/80">Sales, inventory, accounts, people and distributor operations in one secure system.</p>
            <p className="mt-6 text-[11px] text-white/60">Bond Therapy CRM · Authorized access only</p>
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-col bg-white px-6 py-5 sm:px-10 lg:px-12 lg:py-8 xl:px-16">
          <div className="flex items-center justify-between lg:hidden">
            <div className="lg:hidden"><BrandMark /></div>
            <span className="rounded-full border bg-background px-3 py-1.5 text-[11px] font-medium text-muted">Secure portal</span>
          </div>
          <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-6 lg:py-0">
            <span className="mb-7 hidden h-1 w-12 rounded-full bg-brand lg:block" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand lg:hidden">Bond Therapy CRM</p>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.025em] text-foreground lg:mt-0 lg:text-[28px]">Welcome back</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted">Enter your credentials to open your assigned workspace.</p>
            <LoginForm />
            <div className="mt-6 flex items-center gap-2 border-t pt-4 text-xs leading-5 text-subtle"><ShieldCheck size={15} className="shrink-0" />Your access is protected and activity is recorded for security.</div>
          </div>
          <p className="text-center text-[11px] text-subtle">© {new Date().getFullYear()} Bond Therapy. Internal business system.</p>
        </div>
      </section>
    </main>
  );
}
