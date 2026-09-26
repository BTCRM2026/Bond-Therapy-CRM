import Link from "next/link";
import { ArrowRight, Package, ShoppingCart, Truck } from "lucide-react";
import { OrderStatus, type Order } from "@/components/orders-module";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";

const money = (value: string | number) => `₹${Number(value).toLocaleString("en-IN")}`;

export function DistributorDashboard({ orders }: { orders: Order[] }) {
  const needsReview = orders.filter((order) => ["SUBMITTED", "UNDER_REVIEW"].includes(order.status));
  const awaitingPickup = orders.filter((order) => order.status === "APPROVED");
  const fulfilled = orders.filter((order) => order.status === "DISTRIBUTOR_FULFILLED");

  return (
    <div className="space-y-5">
      <KpiStrip columns={3}>
        <KpiCell label="Needs review" value={needsReview.length} tone={needsReview.length ? "warning" : "neutral"} />
        <KpiCell label="Awaiting pickup" value={awaitingPickup.length} />
        <KpiCell label="Fulfilled orders" value={fulfilled.length} tone="success" />
      </KpiStrip>

      <section className="crm-surface">
        <div className="flex items-center justify-between gap-3 rounded-t-xl border-b px-5 py-4">
          <div><h2 className="text-sm font-semibold text-foreground">Orders needing attention</h2><p className="mt-0.5 text-xs text-muted">Routed to you by Bond Therapy salespeople</p></div>
          <Link href="/distributor/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-brand">View all<ArrowRight size={14} /></Link>
        </div>
        <div className="overflow-hidden rounded-b-xl">
          {needsReview.length || awaitingPickup.length ? (
            <div className="divide-y">{[...needsReview, ...awaitingPickup].slice(0, 5).map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{order.orderNumber}</p><OrderStatus value={order.status} /></div>
                  <p className="mt-0.5 text-xs text-muted">{order.client.salonName} · {order.client.city}</p>
                </div>
                <p className="text-sm font-semibold">{money(order.totalAmount)}</p>
              </div>
            ))}</div>
          ) : (
            <div className="px-5 py-12 text-center"><ShoppingCart className="mx-auto text-subtle" size={26} /><p className="mt-3 text-sm font-semibold">Nothing needs your attention</p><p className="mt-1 text-xs text-muted">New orders from your territory will show up here.</p></div>
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/distributor/stock" className="crm-surface flex items-center gap-3 p-4 transition-colors hover:bg-brand-soft/30">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Package size={18} /></span>
          <div className="min-w-0"><p className="text-sm font-semibold text-foreground">View my stock</p><p className="text-xs text-muted">Current quantities and movement history</p></div>
        </Link>
        <Link href="/distributor/replenishment" className="crm-surface flex items-center gap-3 p-4 transition-colors hover:bg-brand-soft/30">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Truck size={18} /></span>
          <div className="min-w-0"><p className="text-sm font-semibold text-foreground">Request replenishment</p><p className="text-xs text-muted">Restock from Bond Therapy&apos;s central warehouse</p></div>
        </Link>
      </div>
    </div>
  );
}
