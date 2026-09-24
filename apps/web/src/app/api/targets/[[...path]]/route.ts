import { proxyToApi } from "@/lib/api-proxy";

async function handle(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return proxyToApi(request, `/targets${path?.length ? `/${path.join("/")}` : ""}`, { allowedPortals: ["ADMIN", "STAFF"] });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
