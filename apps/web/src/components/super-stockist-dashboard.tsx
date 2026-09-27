import { ArrowDownToLine, Building2, Package, Truck } from "lucide-react";
import Link from "next/link";
import { KpiCell, KpiStrip } from "@/components/ui/kpi-strip";
import type { NetworkDistributor } from "@/components/super-stockist-network";

type Request = { id: string; requestNumber: string; status: string; distributor: { id: string; businessName: string }; sourceDistributor: { id: string; businessName: string } | null; items: Array<{ quantity: number }> };
type Stock = { quantityOnHand: number };

export function SuperStockistDashboard({ network, requests, stock, partnerId }: { network: NetworkDistributor[]; requests: Request[]; stock: Stock[]; partnerId: string }) {
  const incoming = requests.filter((item) => item.sourceDistributor?.id === partnerId && ["REQUESTED", "APPROVED"].includes(item.status));
  const restocking = requests.filter((item) => item.distributor.id === partnerId && ["REQUESTED", "APPROVED"].includes(item.status));
  return <div className="space-y-5">
    <KpiStrip columns={4}><KpiCell label="Stock on hand" value={stock.reduce((sum, item) => sum + item.quantityOnHand, 0)} /><KpiCell label="Distributor network" value={network.length} /><KpiCell label="Incoming requests" value={incoming.length} tone={incoming.length ? "warning" : "neutral"} /><KpiCell label="Mother Depot restock" value={restocking.length} /></KpiStrip>
    <div className="grid gap-4 md:grid-cols-2">
      <Link href="/distributor/replenishment" className="crm-surface group p-5 transition-colors hover:border-brand/30"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Replenishment control</p><p className="mt-1 text-xs leading-5 text-muted">Request stock from Mother Depot and process distributor requests.</p></div><span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><ArrowDownToLine size={18} /></span></div></Link>
      <Link href="/distributor/network" className="crm-surface group p-5 transition-colors hover:border-brand/30"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Distributor network</p><p className="mt-1 text-xs leading-5 text-muted">Monitor assigned partners, stock and open demand.</p></div><span className="grid size-10 place-items-center rounded-lg bg-background text-foreground"><Building2 size={18} /></span></div></Link>
      <Link href="/distributor/stock" className="crm-surface p-5 transition-colors hover:border-brand/30"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Inventory ledger</p><p className="mt-1 text-xs leading-5 text-muted">Review every receipt, partner dispatch and adjustment.</p></div><Package className="text-muted" size={20} /></div></Link>
      <div className="crm-surface p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Fulfilment priority</p><p className="mt-1 text-xs leading-5 text-muted">{incoming.length ? `${incoming.length} distributor request${incoming.length === 1 ? "" : "s"} need attention.` : "No distributor request is waiting."}</p></div><Truck className="text-muted" size={20} /></div></div>
    </div>
  </div>;
}
