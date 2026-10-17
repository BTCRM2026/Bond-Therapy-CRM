import { proxyToApi } from "@/lib/api-proxy";

export const PATCH = (request: Request) => proxyToApi(request, "/auth/staff-details", { allowedPortals: ["STAFF"], deniedMessage: "Personal details are submitted from the staff portal." });
