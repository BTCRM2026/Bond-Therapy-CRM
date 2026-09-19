import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { portalLabel, requestPortal } from "@/lib/portal";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ passwordChanged?: string }> }) {
  const portal = (await requestPortal()) ?? "ADMIN";
  const label = portalLabel(portal);
  const passwordChanged = (await searchParams).passwordChanged === "1";
  return (
    <main className="flex h-svh items-center justify-center overflow-hidden bg-background p-3 sm:p-5 lg:p-8">
      <section className="grid h-[calc(100svh-24px)] min-h-0 w-full max-w-[600px] overflow-hidden rounded-xl border bg-white shadow-[0_24px_60px_rgba(23,32,51,0.10),0_4px_16px_rgba(23,32,51,0.05)] sm:h-[calc(100svh-40px)] sm:max-h-[760px] lg:h-[calc(100svh-64px)] lg:max-h-[720px] lg:min-h-[620px] lg:max-w-[1120px] lg:grid-cols-[0.92fr_1.08fr] lg:gap-4 lg:p-4">
        <div
          className="relative hidden overflow-hidden rounded-lg bg-cover bg-center p-8 lg:flex lg:flex-col lg:justify-between"
          style={{ backgroundImage: "url('/brand/login-product.jpeg')" }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,20,72,.18)_0%,rgba(18,23,92,.40)_48%,rgba(12,16,76,.88)_100%)]" />
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
            <div className="text-center">
              <BrandMark className="mx-auto mb-5 w-[165px]" />
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{label}</p>
              <h2 className="text-[26px] font-semibold tracking-[-0.025em] text-foreground lg:text-[28px]">Welcome back</h2>
              <span className="mx-auto mt-3 block h-1 w-12 rounded-full bg-brand" />
              <p className="mt-4 text-sm leading-6 text-muted">Enter your credentials to open your assigned workspace.</p>
            </div>
            {passwordChanged && <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-center text-xs text-[#067647]">Password changed successfully. Sign in with your new password.</div>}
            <LoginForm />
            <div className="mt-6 flex items-start justify-center gap-2 border-t pt-4 text-left text-xs leading-5 text-subtle lg:justify-start"><ShieldCheck size={15} className="mt-0.5 shrink-0" />Your access is protected and activity is recorded for security.</div>
          </div>
          <p className="text-center text-[11px] text-subtle">© {new Date().getFullYear()} Bond Therapy. Internal business system.</p>
        </div>
      </section>
    </main>
  );
}
