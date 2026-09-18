import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-svh bg-background p-3 sm:p-4 lg:h-svh lg:overflow-hidden">
      <section className="mx-auto grid min-h-[calc(100svh-24px)] max-w-[1400px] overflow-hidden rounded-xl border bg-white lg:h-[calc(100svh-32px)] lg:min-h-0 lg:grid-cols-[1.04fr_0.96fr]">
        <div
          className="relative hidden overflow-hidden bg-cover bg-center p-8 lg:flex lg:flex-col lg:justify-between xl:p-10"
          style={{ backgroundImage: "url('/brand/login-product.jpeg')" }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(25,17,17,.36)_0%,rgba(40,20,21,.44)_48%,rgba(72,25,29,.84)_100%)]" />
          <div className="relative w-fit rounded-lg bg-white/95 px-4 py-2 shadow-sm backdrop-blur-sm">
            <BrandMark className="w-[145px]" />
          </div>
          <div className="relative max-w-[520px] pb-1 text-white">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">One connected business workspace</p>
            <h1 className="text-[34px] font-semibold leading-[1.12] tracking-[-0.035em] xl:text-[40px]">Clarity across every team, order and decision.</h1>
            <p className="mt-4 max-w-[470px] text-sm leading-6 text-white/80">Sales, inventory, accounts, people and distributor operations in one secure system.</p>
            <p className="mt-6 text-[11px] text-white/60">Bond Therapy CRM · Authorized access only</p>
          </div>
        </div>

        <div className="flex min-h-[calc(100svh-24px)] flex-col bg-white px-6 py-5 sm:px-10 lg:min-h-0 lg:px-14 xl:px-20">
          <div className="flex items-center justify-between lg:justify-end">
            <div className="lg:hidden"><BrandMark /></div>
            <span className="rounded-full border bg-background px-3 py-1.5 text-[11px] font-medium text-muted">Secure portal</span>
          </div>
          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-6 lg:py-3">
            <div className="mb-5 hidden lg:block"><BrandMark /></div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Bond Therapy CRM</p>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.025em] text-foreground">Welcome back</h2>
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
