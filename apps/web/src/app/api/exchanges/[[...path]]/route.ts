import { proxyToApi } from "@/lib/api-proxy";

async function forward(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params;
  return proxyToApi(request, `/exchanges/${path.map(encodeURIComponent).join("/")}`.replace(/\/$/, ""), { allowedPortals: ["ADMIN", "STAFF"], deniedMessage: "Product exchanges are not available from this portal." });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
