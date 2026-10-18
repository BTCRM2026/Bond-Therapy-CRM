import { proxyToApi } from "@/lib/api-proxy";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyToApi(request, `/orders/${encodeURIComponent(id)}/unverify-payment`, { allowedPortals: ["ADMIN"], deniedMessage: "Payments are confirmed in the admin portal." });
}
