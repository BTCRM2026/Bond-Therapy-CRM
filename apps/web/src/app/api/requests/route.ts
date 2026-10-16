import { proxyToApi } from "@/lib/api-proxy";

const handle = (request: Request) => proxyToApi(request, "/requests", { allowedPortals: ["ADMIN", "STAFF"], deniedMessage: "Requests are not available from this portal." });

export const GET = handle;
export const POST = handle;
