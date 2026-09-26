"use client";

import { Package } from "lucide-react";
import { useState } from "react";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";

type StockRow = { id: string; quantityOnHand: number; updatedAt: string; product: { id: string; name: string; sku: string; unit: string } };
type MovementRow = { id: string; type: string; quantityChange: number; createdAt: string; product: { name: string; unit: string }; recordedBy: { name: string } };

const pretty = (value: string) => value.toLowerCase().split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function DistributorStockView({ stock, movements }: { stock: StockRow[]; movements: MovementRow[] }) {
  const [tab, setTab] = useState<"stock" | "movements">("stock");
  const lowStock = stock.filter((row) => row.quantityOnHand <= 5).length;

  return (
    <div className="space-y-4">
      <KpiStrip columns={3}>
        <KpiCell label="Products in stock" value={stock.length} />
        <KpiCell label="Total units on hand" value={stock.reduce((sum, row) => sum + row.quantityOnHand, 0)} />
        <KpiCell label="Low stock (≤5 units)" value={lowStock} tone={lowStock > 0 ? "warning" : "neutral"} />
      </KpiStrip>

      <div className="flex gap-1 rounded-lg border bg-white p-1 sm:w-fit">
        <button type="button" onClick={() => setTab("stock")} className={`flex-1 rounded-md px-4 py-2 text-xs font-semibold transition-colors sm:flex-none ${tab === "stock" ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>Current stock</button>
        <button type="button" onClick={() => setTab("movements")} className={`flex-1 rounded-md px-4 py-2 text-xs font-semibold transition-colors sm:flex-none ${tab === "movements" ? "bg-brand-soft text-brand-dark" : "text-muted hover:bg-background"}`}>Movement history</button>
      </div>

      {tab === "stock" ? (
        <section className="crm-surface">
          {stock.length ? (
            <>
              <div className="hidden overflow-visible xl:block">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b bg-background text-[10px] font-bold uppercase tracking-[0.1em] text-muted"><tr><th className="px-5 py-3">Product</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Quantity on hand</th><th className="px-5 py-3">Last updated</th></tr></thead>
                  <tbody className="divide-y">{stock.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-brand-soft/40">
                      <td className="px-5 py-4 font-semibold text-foreground">{row.product.name}</td>
                      <td className="px-4 py-4 text-muted">{row.product.sku}</td>
                      <td className="px-4 py-4 text-foreground">{row.quantityOnHand} {row.product.unit}</td>
                      <td className="px-5 py-4 text-muted">{dateLabel(row.updatedAt)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:hidden">{stock.map((row) => (
                <article key={row.id} className="rounded-lg border bg-white p-4">
                  <p className="text-sm font-semibold text-foreground">{row.product.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{row.product.sku}</p>
                  <p className="mt-3 text-lg font-semibold text-foreground">{row.quantityOnHand} <span className="text-xs font-normal text-muted">{row.product.unit}</span></p>
                  <p className="mt-1 text-xs text-muted">Updated {dateLabel(row.updatedAt)}</p>
                </article>
              ))}</div>
            </>
          ) : (
            <div className="px-5 py-14 text-center"><Package className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold">No stock yet</p><p className="mt-1 text-xs text-muted">Request replenishment from Bond Therapy to receive stock.</p></div>
          )}
        </section>
      ) : (
        <section className="crm-surface">
          {movements.length ? (
            <div className="divide-y">{movements.map((movement) => (
              <div key={movement.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{movement.product.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{pretty(movement.type)} · {movement.recordedBy.name} · {dateLabel(movement.createdAt)}</p>
                </div>
                <p className={`text-sm font-semibold ${movement.quantityChange >= 0 ? "text-success" : "text-danger"}`}>{movement.quantityChange >= 0 ? "+" : ""}{movement.quantityChange} {movement.product.unit}</p>
              </div>
            ))}</div>
          ) : (
            <div className="px-5 py-14 text-center"><Package className="mx-auto text-subtle" size={28} /><p className="mt-3 text-sm font-semibold">No movements yet</p></div>
          )}
        </section>
      )}
    </div>
  );
}
