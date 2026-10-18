import { proxyToApi } from "@/lib/api-proxy";

type Context = { params: Promise<{ id: string }> };
const denied = "Orders are not available from this portal.";

// The distributor's bill for an order: the salesperson uploads it, the administrator checks it.
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return proxyToApi(request, `/orders/${encodeURIComponent(id)}/distributor-invoice`, { allowedPortals: ["STAFF", "ADMIN"], deniedMessage: denied });
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return proxyToApi(request, `/orders/${encodeURIComponent(id)}/bill`, { allowedPortals: ["STAFF", "ADMIN"], deniedMessage: denied });
}
