import { ArrowLeft, FileQuestion } from "lucide-react";
import Link from "next/link";
import { SidebarBrand } from "@/components/sidebar-brand";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-4 sm:p-6">
      <section className="w-full max-w-lg rounded-xl border bg-white p-6 text-center shadow-[0_12px_32px_rgba(23,32,51,0.08)] sm:p-8">
        <div className="flex justify-center border-b pb-5"><SidebarBrand /></div>
        <span className="mx-auto mt-7 grid size-12 place-items-center rounded-xl bg-brand-soft text-brand"><FileQuestion size={22} /></span>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Error 404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-foreground">Page not found</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">The page may have moved, or the address may be incorrect.</p>
        <Link href="/dashboard" className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(23,27,114,0.18)] transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
      </section>
    </main>
  );
}
