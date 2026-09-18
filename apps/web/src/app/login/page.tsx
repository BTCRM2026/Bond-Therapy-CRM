import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex h-svh items-center justify-center overflow-hidden bg-background p-3 sm:p-5 lg:p-8">
      <section className="grid h-[calc(100svh-24px)] min-h-0 w-full max-w-[600px] overflow-hidden rounded-xl border bg-white shadow-[0_24px_60px_rgba(60,41,42,0.10),0_4px_16px_rgba(60,41,42,0.05)] sm:h-[calc(100svh-40px)] sm:max-h-[760px] lg:h-[calc(100svh-64px)] lg:max-h-[720px] lg:min-h-[620px] lg:max-w-[1120px] lg:grid-cols-[0.92fr_1.08fr] lg:gap-4 lg:p-4">
        <div
          className="relative hidden overflow-hidden rounded-lg bg-cover bg-center p-8 lg:flex lg:flex-col lg:justify-between"
          style={{ backgroundImage: "url('/brand/login-product.jpeg')" }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(25,17,17,.18)_0%,rgba(40,20,21,.30)_48%,rgba(72,25,29,.78)_100%)] lg:bg-[linear-gradient(180deg,rgba(25,17,17,.36)_0%,rgba(40,20,21,.44)_48%,rgba(72,25,29,.84)_100%)]" />
          <BrandMark className="relative w-[165px] self-end brightness-0 invert lg:w-[170px] lg:self-start" />
          <div className="relative max-w-[430px] pb-1 text-white">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">One connected business workspace</p>
            <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.035em] sm:text-[30px] lg:text-[32px] xl:text-[36px]">Clarity across every team, order and decision.</h1>
            <p className="mt-3 max-w-[470px] text-sm leading-6 text-white/80 lg:mt-4">Sales, inventory, accounts, people and distributor operations in one secure system.</p>
            <p className="mt-4 text-[11px] text-white/60 lg:mt-6">Bond Therapy CRM · Authorized access only</p>
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-col bg-white px-6 py-5 sm:px-10 lg:px-12 lg:py-8 xl:px-16">
          <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center lg:py-0">
            <div className="text-center lg:text-left">
              <BrandMark className="mx-auto mb-5 w-[165px]" />
              <h2 className="text-[26px] font-semibold tracking-[-0.025em] text-foreground lg:text-[28px]">Welcome back</h2>
              <span className="mx-auto mt-3 block h-1 w-12 rounded-full bg-brand lg:mx-0" />
              <p className="mt-4 text-sm leading-6 text-muted">Enter your credentials to open your assigned workspace.</p>
            </div>
            <LoginForm />
            <div className="mt-6 flex items-center justify-center gap-2 border-t pt-4 text-center text-xs leading-5 text-subtle lg:justify-start lg:text-left"><ShieldCheck size={15} className="shrink-0" />Your access is protected and activity is recorded for security.</div>
          </div>
          <p className="text-center text-[11px] text-subtle">© {new Date().getFullYear()} Bond Therapy. Internal business system.</p>
        </div>
      </section>
    </main>
  );
}
