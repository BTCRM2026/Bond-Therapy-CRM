import { proxyToApi } from "@/lib/api-proxy";

// The administrator confirms the payment arrived; only then does the sale count.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyToApi(request, `/orders/${encodeURIComponent(id)}/verify-payment`, { allowedPortals: ["ADMIN"], deniedMessage: "Payments are confirmed in the admin portal." });
}
