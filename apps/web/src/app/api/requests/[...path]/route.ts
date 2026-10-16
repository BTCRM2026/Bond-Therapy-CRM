import { proxyToApi } from "@/lib/api-proxy";

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToApi(request, `/requests/${path.map(encodeURIComponent).join("/")}`, { allowedPortals: ["ADMIN", "STAFF"], deniedMessage: "Requests are not available from this portal." });
}

export const GET = handle;
export const POST = handle;
