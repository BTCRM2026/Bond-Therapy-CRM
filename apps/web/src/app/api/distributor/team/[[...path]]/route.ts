import { proxyToDistributorApi } from "@/lib/distributor-api-proxy";

async function handle(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return proxyToDistributorApi(request, `/distributors/me/users${path?.length ? `/${path.join("/")}` : ""}`);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
