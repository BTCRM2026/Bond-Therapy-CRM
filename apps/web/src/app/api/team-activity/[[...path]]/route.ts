import { proxyToApi } from "@/lib/api-proxy";

// Read-only monitoring for the administrator.
async function handle(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return proxyToApi(request, `/team-activity${path?.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}`, { allowedPortals: ["ADMIN"], deniedMessage: "Team activity is available in the admin portal." });
}

export const GET = handle;
