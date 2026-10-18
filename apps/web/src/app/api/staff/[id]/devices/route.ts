import { proxyToApi } from "@/lib/api-proxy";

// The devices a staff account has been used from (administrator only).
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyToApi(request, `/users/${encodeURIComponent(id)}/devices`, { allowedPortals: ["ADMIN"], deniedMessage: "This resource is only available in the Admin portal." });
}
