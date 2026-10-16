import { proxyToApi } from "@/lib/api-proxy";

// Read-only on purpose: staff can list and download their letters, never change them.
async function handle(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return proxyToApi(request, `/my-letters${path?.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}`, { allowedPortals: ["STAFF"], deniedMessage: "My Letters is available in the staff portal." });
}

export const GET = handle;
