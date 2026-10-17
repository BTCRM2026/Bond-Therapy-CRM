import { proxyToApi } from "@/lib/api-proxy";

export const POST = (request: Request) => proxyToApi(request, "/captures", { allowedPortals: ["ADMIN", "STAFF"], deniedMessage: "The camera is not available from this portal." });
