import { proxyToApi } from "@/lib/api-proxy";

async function handle(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return proxyToApi(request, `/distributors${path?.length ? `/${path.join("/")}` : ""}`, { allowedPortals: ["ADMIN"] });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
