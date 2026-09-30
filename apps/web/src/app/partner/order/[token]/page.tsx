import { PartnerOrderConfirmation } from "@/components/partner-order-confirmation";
import type { Order } from "@/components/orders-module";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export default async function PartnerOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let initial: Order | null = null;
  let initialError = "";
  try {
    const response = await fetch(`${API}/partner-orders/${encodeURIComponent(token)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const data = await response.json().catch(() => null);
    if (!response.ok) initialError = data?.message ?? "Unable to open this order.";
    else initial = data as Order;
  } catch {
    initialError = "This order link is temporarily unavailable.";
  }
  return <PartnerOrderConfirmation token={token} initial={initial} initialError={initialError} />;
}
