import { proxyToApi } from "@/lib/api-proxy";

// An Area Sales Manager's read-only view of their own team.
async function handle(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return proxyToApi(request, `/my-team${path?.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}`, { allowedPortals: ["STAFF"], deniedMessage: "The team view is available in the staff portal." });
}

export const GET = handle;
