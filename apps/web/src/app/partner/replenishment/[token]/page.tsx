import { PartnerReplenishmentConfirmation } from "@/components/partner-replenishment-confirmation";
import type { ReplenishmentRequest } from "@/components/distributor-replenishment";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export default async function PartnerReplenishmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let initial: ReplenishmentRequest | null = null;
  let initialError = "";
  try {
    const response = await fetch(`${API}/partner-replenishment/${encodeURIComponent(token)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const data = await response.json().catch(() => null);
    if (!response.ok) initialError = data?.message ?? "Unable to open this request.";
    else initial = data as ReplenishmentRequest;
  } catch {
    initialError = "This request link is temporarily unavailable.";
  }
  return <PartnerReplenishmentConfirmation token={token} initial={initial} initialError={initialError} />;
}
