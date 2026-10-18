import { proxyToApi } from "@/lib/api-proxy";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyToApi(request, `/users/${encodeURIComponent(id)}/devices/reset`, { allowedPortals: ["ADMIN"], deniedMessage: "This resource is only available in the Admin portal." });
}
